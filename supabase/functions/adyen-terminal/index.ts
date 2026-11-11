// Supabase Edge Function: proxy naar Adyen's Terminal API.
//
// Bestaansreden (docs/04-betaalterminals.md): "API-sleutels en geheimen staan
// alleen op de server, nooit in de frontend." De kassa-app draait in een
// browser/WebView waar álles uit te lezen is, dus de Adyen API-sleutel mag daar
// niet staan. Deze functie draait op Supabase, houdt de sleutel geheim, en
// geeft alleen het resultaat terug.
//
// Vereiste secrets (zet je met `supabase secrets set`, of via het dashboard):
//   ADYEN_API_KEY        — de API key van de pos_ws-credential
//   ADYEN_ENVIRONMENT    — "test" of "live" (standaard: test)
//   ADYEN_LIVE_ENDPOINT  — alleen nodig bij live: je eigen live-endpoint-prefix

const TEST_ENDPOINT = 'https://terminal-api-test.adyen.com/sync'

interface PaymentBody {
  action: 'payment'
  poiId: string
  saleId: string
  serviceId: string
  amountCents: number
  currency: string
  reference: string
}

interface StatusBody {
  action: 'status'
  poiId: string
  saleId: string
  serviceId: string
  originalServiceId: string
}

interface AbortBody {
  action: 'abort'
  poiId: string
  saleId: string
  serviceId: string
  originalServiceId: string
}

interface RefundBody {
  action: 'refund'
  poiId: string
  saleId: string
  serviceId: string
  amountCents: number
  currency: string
  reference: string
  originalPoiTransactionId?: string
  originalTimestamp?: string
}

type RequestBody = PaymentBody | StatusBody | AbortBody | RefundBody

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function messageHeader(category: string, body: RequestBody) {
  return {
    ProtocolVersion: '3.0',
    MessageClass: category === 'Abort' ? 'Service' : 'Service',
    MessageCategory: category,
    MessageType: 'Request',
    ServiceID: body.serviceId,
    SaleID: body.saleId,
    POIID: body.poiId,
  }
}

function buildAdyenRequest(body: RequestBody): Record<string, unknown> {
  // Adyen rekent in minor units (centen), net als wij — geen omrekening nodig.
  switch (body.action) {
    case 'payment':
      return {
        SaleToPOIRequest: {
          MessageHeader: messageHeader('Payment', body),
          PaymentRequest: {
            SaleData: {
              SaleTransactionID: { TransactionID: body.reference, TimeStamp: new Date().toISOString() },
            },
            PaymentTransaction: {
              AmountsReq: { Currency: body.currency, RequestedAmount: body.amountCents / 100 },
            },
          },
        },
      }

    case 'status':
      return {
        SaleToPOIRequest: {
          MessageHeader: messageHeader('TransactionStatus', body),
          TransactionStatusRequest: {
            ReceiptReprintFlag: true,
            DocumentQualifier: ['CashierReceipt', 'CustomerReceipt'],
            MessageReference: {
              MessageCategory: 'Payment',
              SaleID: body.saleId,
              ServiceID: body.originalServiceId,
            },
          },
        },
      }

    case 'abort':
      return {
        SaleToPOIRequest: {
          MessageHeader: messageHeader('Abort', body),
          AbortRequest: {
            AbortReason: 'MerchantAbort',
            MessageReference: {
              MessageCategory: 'Payment',
              SaleID: body.saleId,
              ServiceID: body.originalServiceId,
            },
          },
        },
      }

    case 'refund':
      return {
        SaleToPOIRequest: {
          MessageHeader: messageHeader('Reversal', body),
          ReversalRequest: {
            OriginalPOITransaction: body.originalPoiTransactionId
              ? {
                  POIID: body.poiId,
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
    return new Response(JSON.stringify({ error: 'ADYEN_API_KEY ontbreekt in de serverconfiguratie' }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }

  const environment = Deno.env.get('ADYEN_ENVIRONMENT') ?? 'test'
  const endpoint =
    environment === 'live' ? `${Deno.env.get('ADYEN_LIVE_ENDPOINT')}/sync` : TEST_ENDPOINT

  try {
    const body = (await req.json()) as RequestBody
    const adyenRequest = buildAdyenRequest(body)

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'x-API-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(adyenRequest),
    })

    const text = await response.text()
    if (!response.ok) {
      // Adyen's foutmelding doorgeven, maar nooit de API-sleutel zelf.
      return new Response(JSON.stringify({ error: `Adyen gaf status ${response.status}`, details: text }), {
        status: 502,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }

    return new Response(text, {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }
})
