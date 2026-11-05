# Datamodel

Zo slaat het prototype de gegevens op (JSON-documenten). Bedragen zijn in het prototype euro's als getal. **Gebruik in productie integers in centen.** Tijden zijn Unix-tijd in milliseconden.

## Product
Elke variant (maat of kleur) is een eigen product met een eigen SKU. Varianten horen bij elkaar als `name` (en `category`) gelijk zijn.

| Veld | Type | Toelichting |
|---|---|---|
| id | string | uuid |
| sku | string | uniek, niet hoofdlettergevoelig |
| name | string | productnaam, gedeeld door varianten |
| category | string | bijvoorbeeld T-shirts, Hoodies, Accessoires |
| variant | string | maat of kleur, mag leeg zijn |
| price | number | verkoopprijs incl. btw |
| cost | number | inkoopprijs excl. btw |
| stock | number | actuele voorraad |
| minStock | number of "" | leeg = standaard uit Instellingen |
| barcode | string | EAN, optioneel |

**Aanbevolen voor productie**: een aparte tabel `product_groups` (naam, categorie, afbeelding, btw-tarief) met `variants` eronder, en een veld `vat_rate` per product of groep.

## Sale (verkoop)
```json
{
  "id": "uuid", "type": "sale", "ts": 1762243200000,
  "register": "Hoofdpodium", "method": "Pin",
  "receiptNo": "HOO-243200",
  "items": [{ "pid": "uuid", "sku": "TOUTEEZWA-M", "name": "Tour Tee Zwart",
              "variant": "M", "category": "T-shirts", "price": 35, "cost": 9.5, "qty": 2 }],
  "subtotal": 70, "discount": 7, "total": 63,
  "paid": 63,
  "credit": 0, "creditRef": null,
  "received": 100
}
```
- `method`: Pin, Contant of QR.
- `total` = subtotal − discount. Dit is de omzet van de bon.
- `paid` = total − credit. Dit is het bedrag dat via `method` is betaald.
- `credit` en `creditRef`: alleen bij omruilen. Bevat het tegoed en het nummer van de retourbon.
- `received`: alleen bij contant. Wisselgeld = received − paid.
- Item-velden zijn een momentopname: naam, prijs en inkoop zoals ze waren op het moment van verkoop.

## Refund (retour)
```json
{
  "id": "uuid", "type": "refund", "ts": 1762246800000,
  "register": "Hoofdpodium", "method": "Omruil",
  "reason": "Verkeerde maat", "restock": true,
  "refOf": "uuid-van-originele-bon", "refReceipt": "HOO-243200",
  "receiptNo": "RET-246800",
  "items": [{ "pid": "uuid", "sku": "TOUTEEZWA-M", "name": "Tour Tee Zwart", "variant": "M",
              "category": "T-shirts", "price": 35, "unit": 31.5, "cost": 9.5, "qty": 1 }],
  "subtotal": -31.5, "discount": 0, "total": -31.5
}
```
- `method`: Pin, Contant, QR of Omruil.
- `unit` is het terugbetaalde bedrag per stuk. Bij een bon met korting is dat price × (total ÷ subtotal) van de originele bon.
- `refOf` en `refReceipt` zijn `null` bij een retour zonder bon.
- Bedragen zijn negatief, zodat optellen van alle boekingen direct de netto omzet geeft.
- Hoeveel er van een bon al retour is, volgt uit alle refunds met dezelfde `refOf`.

## StockMovement (voorraadmutatie)
| Veld | Type | Toelichting |
|---|---|---|
| id | string | uuid |
| ts | number | tijdstip |
| pid, sku, name, variant | | product (momentopname) |
| delta | number | + of − |
| after | number | voorraad na de mutatie |
| reason | string | Verkoop, Retour, Levering, Telling, Correctie, Import, Handmatig |
| ref | string | bonnummer, pakbon, bestandsnaam of notitie |
| register | string | kassa |

**In productie**: maak dit de bron van waarheid en bereken `stock` als som van de mutaties (of houd het bij in dezelfde transactie). Voeg `user_id` toe.

## Closing (dagafsluiting)
| Veld | Type | Toelichting |
|---|---|---|
| id, ts | | |
| date | string | YYYY-MM-DD |
| register | string | kassanaam of "Alle kassa's" |
| float | number | wisselgeld bij opening |
| expected | number | float + contant in − contant uit |
| counted | number | geteld |
| diff | number | counted − expected |
| tx, net, gross, refunds, discount, vat, items | | samenvatting van de dag |
| methods | object | per methode `{ in, out, n }` |
| note | string | |

## Settings
`event`, `registers[]`, `vat`, `lowDefault`, `float`, `retDays`.

## Ontbreekt nog (voor productie)
- **Users en rollen**: kassamedewerker, standmanager, admin. Inloggen met een pincode per medewerker op een gedeeld apparaat.
- **Events of tours en locaties**: voorraad per locatie, plus overboekingen tussen stands of het magazijn.
- **Devices**: geregistreerde kassa's met een vaste bonnummerreeks per kassa.
- **Payments**: per betaling de terminal-transactie-id, status en het bewijs van de leverancier.
- **Audit log**: wie wijzigde welke prijs of instelling.
