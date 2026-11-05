# Betaalterminals

## Huidige situatie
In het prototype registreert de knop "Pin" alleen de betaalmethode. Het bedrag gaat niet naar een terminal. Met een losse terminal tikt de medewerker het bedrag apart in.

## Doel
Een **semi-geïntegreerde koppeling**:
1. De kassa stuurt het bedrag en een referentie (het bonnummer) naar de terminal.
2. De klant betaalt.
3. De terminal meldt het resultaat terug: geslaagd, geweigerd of geannuleerd, met een transactie-id.
4. Pas bij "geslaagd" wordt de bon geboekt en de voorraad afgeboekt.
5. Terugbetalingen naar pin gaan via dezelfde koppeling (refund op de transactie-id, of een losse terugbetaling).

## Eisen aan de leverancier
- **API voor eigen kassasoftware** (cloud terminal API of een lokale/LAN-koppeling), met openbare documentatie en een sandbox of testterminal.
- **4G of een eigen simkaart** in de terminal, omdat festivalwifi onbetrouwbaar is.
- **Duidelijk offline-beleid**: wat gebeurt er zonder verbinding?
- **Contactloos** (inclusief Apple Pay en Google Pay), Maestro/V Pay, Mastercard en Visa. Eventueel ook QR-betalingen.
- **Terugbetalen op de terminal.**
- **Webhooks of status-polling**, voor betrouwbare afhandeling als de kassa-app tussentijds wegvalt.
- **Bij voorkeur Android-terminals waarop een eigen app kan draaien.** Dan kan de kassa op het betaalapparaat zelf, wat handig is voor rondlopende verkopers.
- **Tarieven per transactie en huur- of koopkosten**, voor jullie volumes.

## Leveranciers om te vergelijken
Partijen die in Nederland terminals met kassakoppelingen aanbieden zijn onder andere Adyen, CCV, Mollie, SumUp, myPOS en Worldline. Controleer per partij de actuele API-mogelijkheden, de tarieven en of jullie bestaande contract (bijvoorbeeld via Twelve) het toelaat.

## Technische opzet
Maak in de code een `PaymentProvider`-interface, zodat de leverancier later te wisselen is:
```ts
interface PaymentProvider {
  startPayment(input: { amountCents: number; reference: string; terminalId: string }): Promise<{ paymentId: string }>;
  getStatus(paymentId: string): Promise<'pending' | 'succeeded' | 'failed' | 'cancelled'>;
  cancel(paymentId: string): Promise<void>;
  refund(input: { paymentId?: string; amountCents: number; reference: string; terminalId: string }): Promise<{ refundId: string }>;
}
```
Bouw eerst een `ManualProvider`, die het huidige gedrag nadoet: de medewerker bevestigt zelf dat de pinbetaling gelukt is. Dan werkt alles al voordat de echte koppeling er is.

API-sleutels en geheimen staan alleen op de server, nooit in de frontend.
