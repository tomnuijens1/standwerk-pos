// Supabase Edge Function: proxy naar Adyen's Terminal API.
//
// Bestaansreden (docs/04-betaalterminals.md): "API-sleutels en geheimen staan
// alleen op de server, nooit in de frontend." De kassa-app draait in een
// browser/WebView waar álles uit te lezen is, dus de Adyen API-sleutel mag daar
// niet staan. Deze functie draait op Supabase, houdt de sleutel geheim, en
// geeft alleen het resultaat terug.
//
// Let op: de app gebruikt anonieme Supabase-sessies, dus een geldige JWT zegt
// NIETS over wie je bent — iedereen kan er een krijgen. Daarom controleert
// deze functie zelf de medewerker-pincode-identiteit (employeeId) en de
// bijbehorende rol, net als de database-functies dat doen.
//
// Vereiste secrets:
//   ADYEN_API_KEY        — de API key van de pos_ws-credential
//   ADYEN_ENVIRONMENT    — "test" of "live" (standaard: test)
//   ADYEN_LIVE_ENDPOINT  — alleen nodig bij live: je eigen live-endpoint-prefix

import { createClient } from 'jsr:@supabase/supabase-js@2'

const TEST_ENDPOINT = 'https://terminal-api-test.adyen.com/sync'

// Bovengrens per transactie. Voorkomt dat een fout (of misbruik) in één keer
// een absurd bedrag naar de terminal stuurt. Merchandise op een festival komt
// hier in de praktijk nooit aan.
const MAX_AMOUNT_CENTS = 100_000 // € 1.000,-

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface BaseBody {
  employeeId: string
  registerId: string
  serviceId: string
}

type RequestBody =
  | (BaseBody & { action: 'payment'; amountCents: number; reference: string })
  | (BaseBody & { action: 'status'; originalServiceId: string })
  | (BaseBody & { action: 'abort'; originalServiceId: string })
  | (BaseBody & { action: 'refund'; amountCents: number; reference: string; originalPoiTransactionId?: string; originalTimestamp?: string })

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

function messageHeader(category: string, saleId: string, serviceId: string, poiId: string) {
  return {
    ProtocolVersion: '3.0',
    MessageClass: 'Service',
    MessageCategory: category,
    MessageType: 'Request',
    ServiceID: serviceId,
    SaleID: saleId,
    POIID: poiId,
  }
}

function buildAdyenRequest(body: RequestBody, saleId: string, poiId: string): Record<string, unknown> {
  switch (body.action) {
    case 'payment':
      return {
        SaleToPOIRequest: {
          MessageHeader: messageHeader('Payment', saleId, body.serviceId, poiId),
          PaymentRequest: {
            SaleData: {
              SaleTransactionID: { TransactionID: body.reference, TimeStamp: new Date().toISOString() },
            },
            PaymentTransaction: {
              AmountsReq: { Currency: 'EUR', RequestedAmount: body.amountCents / 100 },
            },
          },
        },
      }

    case 'status':
      return {
        SaleToPOIRequest: {
          MessageHeader: messageHeader('TransactionStatus', saleId, body.serviceId, poiId),
          TransactionStatusRequest: {
            ReceiptReprintFlag: true,
            DocumentQualifier: ['CashierReceipt', 'CustomerReceipt'],
            MessageReference: { MessageCategory: 'Payment', SaleID: saleId, ServiceID: body.originalServiceId },
          },
        },
      }

    case 'abort':
      return {
        SaleToPOIRequest: {
          MessageHeader: messageHeader('Abort', saleId, body.serviceId, poiId),
          AbortRequest: {
            AbortReason: 'MerchantAbort',
            MessageReference: { MessageCategory: 'Payment', SaleID: saleId, ServiceID: body.originalServiceId },
          },
        },
      }

    case 'refund':
      return {
        SaleToPOIRequest: {
          MessageHeader: messageHeader('Reversal', saleId, body.serviceId, poiId),
          ReversalRequest: {
            OriginalPOITransaction: body.originalPoiTransactionId
              ? {
                  POIID: poiId,
                  POITransactionID: {
                    TransactionID: body.originalPoiTransactionId,
                    TimeStamp: body.originalTimestamp ?? new Date().toISOString(),
                  },
                }
              : undefined,
            ReversedAmount: body.amountCents / 100,
            ReversalReason: 'MerchantCancel',
          },
        },
      }
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  const apiKey = Deno.env.get('ADYEN_API_KEY')
  if (!apiKey) {
    return json({ error: 'Serverconfiguratie onvolledig' }, 500)
  }

  let body: RequestBody
  try {
    body = (await req.json()) as RequestBody
  } catch {
    return json({ error: 'Ongeldig verzoek' }, 400)
  }

  // --- Invoer controleren -------------------------------------------------
  if (!body.employeeId || !body.registerId || !body.serviceId) {
    return json({ error: 'Onvolledig verzoek' }, 400)
  }
  if (!/^[A-Za-z0-9]{1,10}$/.test(body.serviceId)) {
    return json({ error: 'Ongeldige serviceId' }, 400)
  }
  if ((body.action === 'payment' || body.action === 'refund')) {
    if (!Number.isInteger(body.amountCents) || body.amountCents <= 0 || body.amountCents > MAX_AMOUNT_CENTS) {
      return json({ error: 'Bedrag buiten toegestane grenzen' }, 400)
    }
  }

  // --- Wie doet dit, en mag dat? -----------------------------------------
  // De anonieme JWT bewijst niets over identiteit, dus we controleren de
  // medewerker tegen de database met de service role (die RLS omzeilt maar
  // hier alleen gebruikt wordt om te lézen wie iemand is).
  const admin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false } },
  )

  const { data: register, error: registerError } = await admin
    .from('registers')
    .select('id, event_id, terminal_id, active')
    .eq('id', body.registerId)
    .maybeSingle()

  if (registerError || !register || !register.active || !register.terminal_id) {
    return json({ error: 'Onbekende kassa of geen terminal gekoppeld' }, 403)
  }

  const { data: employee, error: employeeError } = await admin
    .from('employees')
    .select('id, role, active, event_id')
    .eq('id', body.employeeId)
    .maybeSingle()

  if (employeeError || !employee || !employee.active || employee.event_id !== register.event_id) {
    return json({ error: 'Log eerst in met een pincode' }, 403)
  }

  // Terugbetalen naar een kaart is de gevaarlijkste actie: alleen een manager.
  if (body.action === 'refund' && employee.role !== 'manager') {
    return json({ error: 'Alleen een manager mag terugbetalen op de terminal' }, 403)
  }

  // Het terminal-ID komt uit de database, niet uit het verzoek: anders kan
  // iemand een willekeurige terminal van een andere klant aansturen.
  const poiId = register.terminal_id
  const saleId = register.id.replace(/-/g, '').slice(0, 10)

  // --- Doorsturen naar Adyen ---------------------------------------------
  const environment = Deno.env.get('ADYEN_ENVIRONMENT') ?? 'test'
  const endpoint = environment === 'live' ? `${Deno.env.get('ADYEN_LIVE_ENDPOINT')}/sync` : TEST_ENDPOINT

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'x-API-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(buildAdyenRequest(body, saleId, poiId)),
    })

    const text = await response.text()

    if (!response.ok) {
      // Adyen's ruwe antwoord niet doorgeven: dat kan interne details over de
      // account- en terminalconfiguratie bevatten. Wel loggen voor onszelf.
      console.error('Adyen-fout', response.status, text)
      return json({ error: 'De betaalterminal gaf een fout' }, 502)
    }

    return new Response(text, { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } })
  } catch (error) {
    console.error('Adyen onbereikbaar', error)
    return json({ error: 'Betaalterminal niet bereikbaar' }, 502)
  }
})
