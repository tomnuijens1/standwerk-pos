# Functionele specificatie

Dit beschrijft wat het prototype doet. De productieversie moet minimaal dit kunnen.

## Navigatie
Vijf schermen: Dashboard, Kassa, Voorraad, Transacties, Instellingen. Op desktop en tablet staat het menu in een donkere zijbalk links, op telefoon als balk onderin. In de zijbalk staan ook de eventnaam, de gekozen kassa en de opslagstatus.

## Dashboard
- **Filters**: periode (Vandaag, 7 dagen, Alles) en kassa (alle of één).
- **Hoofdcijfer**: netto omzet incl. btw (verkopen min retouren), met omzet excl. btw, brutomarge (alleen als er inkoopprijzen zijn) en vergelijking met de vorige periode.
- **Zes kengetallen**: transacties, gemiddelde bon, items verkocht (netto), retouren (bedrag, aantal en items), korting gegeven (bedrag en % van bruto), voorraadwaarde (verkoopwaarde en stuks).
- **Vergelijking**: Vandaag wordt vergeleken met gisteren tot hetzelfde tijdstip, 7 dagen met de 7 dagen daarvoor. Je ziet ▲/▼ en een percentage.
- **Omzetverloop**: staafgrafiek per uur (vandaag) of per dag, met een stippellijn voor de vorige periode.
- **Per categorie**: donut met netto omzet per categorie.
- **Bestsellers**: top 6 producten (varianten samengevoegd) op netto omzet.
- **Kassa's en betaling**: netto omzet per kassa en een balk per betaalmethode. Omruiltegoed telt niet mee als betaalmethode.
- **Bijna op**: producten met voorraad op of onder het minimum, of uitverkocht.
- **Verkoop per maat**: netto stuks per maat (XXS t/m 4XL) voor kleding.
- **Voorraadprognose**: per variant het gemiddelde verkooptempo over de laatste 7 dagen (alle kassa's) en het aantal dagen voorraad dat er nog is. Rood onder 2 dagen, oranje onder 5.
- **Laatste bonnen**: de 8 meest recente bonnen, retouren in rood. Klik opent de bon.
- **Exporteren naar Excel**, met 9 tabbladen: Samenvatting (met vorige periode en verschil-%), Omzetverloop, Categorieën, Producten (verkocht, retour, netto, omzet, marge, voorraad, doorverkoop-%), Kassa's, Betaalmethodes, Maten, Voorraadprognose en Retouren.

## Kassa
- **Kassa kiezen**: per apparaat te kiezen; de keuze wordt op het apparaat onthouden.
- **Producten**: tegels per productnaam met categoriekleur, prijs (of "vanaf"-prijs) en totale voorraad. Oranje bij lage voorraad, uitgeschakeld bij 0.
- **Categoriefilter** (chips) en een **zoekveld**. Een barcode of SKU met Enter voegt het product direct toe. Een bonnummer met Enter opent die bon.
- **Varianten**: heeft een product meerdere varianten, dan opent een keuzevenster met maten (in logische volgorde S, M, L, XL...) en per maat de voorraad.
- **Bon**: regels met + en −, subtotaal, korting, btw en totaal. Je kunt niet meer verkopen dan er op voorraad is.
- **Korting**: op de hele bon, als percentage (snelknoppen 5, 10, 15, 20%) of als bedrag.
- **Afrekenen**: Pin, Contant of QR/Tikkie. Bij contant voer je het ontvangen bedrag in (met snelknoppen) en zie je het wisselgeld. Na afrekenen verschijnt een bevestiging met bon, en de voorraad gaat omlaag.
- **Bon parkeren**: de huidige bon apart zetten en later terugzetten. Wordt per apparaat bewaard.
- **Retour** (knop bovenin): bonnummer scannen of typen, of een recente bon van deze kassa kiezen. Of kies "Retour zonder bon".
- **Retour zonder bon**: de kassa schakelt naar retourmodus (rode rand). Je tikt de producten aan die terugkomen en kiest Terug op pin, Contant terug of Omruilen.
- **Dagafsluiting** (knop bovenin): zie hieronder.

## Retouren en omruilen
- **Met bon**: per product kies je hoeveel er terugkomt, ook gedeeltelijk. Wat al geretourneerd is, telt mee: je kunt niet meer terugnemen dan er gekocht is.
- **Bedrag na korting**: had de originele bon korting, dan is het terug te betalen bedrag per stuk de prijs × (totaal ÷ subtotaal).
- **Reden** (verplicht): Verkeerde maat, Defect of beschadigd, Klant ontevreden, Verkeerd aangeslagen, Anders.
- **Terugboeken op voorraad**: aan of uit. Bij "Defect" staat het standaard uit.
- **Terugbetalen via**: de originele methode, Pin, Contant, QR of Omruilen.
- **Retourtermijn**: in te stellen. Is een bon ouder, dan verschijnt een waarschuwing, maar de retour is nog wel mogelijk.
- **Omruilen**: er ontstaat een retourboeking met methode "Omruil" en het bedrag komt als tegoed op een nieuwe bon. De klant betaalt alleen het verschil bij. Is het tegoed hoger dan de nieuwe bon, dan kun je niet afrekenen tot er genoeg producten op staan. Verwijder je het tegoed, dan wordt de retour omgezet naar contant terugbetaald.
- **Bon bekijken**: bij een bon staan de bijbehorende retouren, en "Retour of omruilen" zolang er nog iets terug kan.

## Voorraad
- **Totalen bovenaan**: aantal SKU's en stuks, verkoopwaarde, inkoopwaarde (met marge in voorraad), lage voorraad en uitverkocht.
- **Tabblad Producten**: tabel met zoeken, filter op categorie en status (Alles, Laag, Uitverkocht). Kolommen: product (met SKU en barcode), variant, categorie, prijs, inkoop, voorraad met +/−, status, verkocht (netto, met doorverkoop-%), waarde.
- **Voorraad bijwerken**: kies Levering bijboeken (aantal erbij) of Telling invoeren (nieuwe stand), met een optioneel kenmerk zoals een pakbon.
- **Product toevoegen of bewerken**: naam, categorie, variant, SKU (automatisch als je hem leeg laat), barcode, verkoopprijs incl. btw, inkoopprijs excl. btw, voorraad en minimumvoorraad. Verwijderen vraagt om een tweede klik ter bevestiging.
- **Tabblad Voorraadmutaties**: logboek van alle wijzigingen (Verkoop, Retour, Levering, Telling, Correctie, Import, Handmatig) met datum, mutatie, nieuwe stand, kenmerk en kassa. Te filteren en te exporteren.
- **Excel importeren** (knop of bestand erop slepen; .xlsx, .xls of .csv):
  - Kolommen worden herkend aan veelgebruikte namen, bijvoorbeeld Artikelnummer → SKU, Maat → Variant, Verkoopprijs → Prijs. Zie het sjabloon.
  - Bedragen als "12,50" en "1.234,50" worden goed gelezen.
  - Je krijgt eerst een controlescherm met het aantal nieuwe, bij te werken en overgeslagen rijen, plus de redenen.
  - Bestaande SKU's worden bijgewerkt. Bij bestaande producten kies je of de voorraad wordt overschreven of opgeteld.
  - Rijen zonder SKU krijgen er automatisch een.
- **Excel exporteren**: alle productvelden plus status, verkocht, verkoopwaarde en inkoopwaarde.
- **Sjabloon**: een leeg importbestand met voorbeeldregels.

## Transacties
- **Tabblad Bonnen**: zoeken op bonnummer of product, filter op kassa en type (Alles, Verkopen, Retouren). Labels "Retour", "Deels retour" en "+ tegoed". Klik opent de bon.
- **Tabblad Dagafsluitingen**: opgeslagen afsluitingen met verschil (groen als het klopt, rood als het afwijkt).
- **Exporteren**: tabbladen Transacties, Verkoopregels (retouren negatief) en Dagafsluitingen.

## Dagafsluiting
- Kies een kassa (of alle kassa's) en een datum.
- Je ziet het aantal bonnen, de netto omzet, retouren, korting, items en btw.
- Per betaalmethode: ontvangen, terugbetaald en netto.
- Je vult het wisselgeld bij opening (standaard uit Instellingen) en het getelde contante geld in.
  - Verwacht contant = wisselgeld + contant ontvangen − contant terugbetaald.
  - Je ziet het verschil direct.
- Opslaan (geteld bedrag is verplicht) en exporteren naar Excel, met de afsluiting en alle bonnen van die dag.

## Instellingen
- Eventnaam, kassa's (komma-gescheiden), btw-percentage, standaard minimumvoorraad, standaard wisselgeld en retourtermijn.
- Thema: systeem, licht of donker.
- Voorbeelddata laden: 32 artikelen, een week aan verkopen en enkele retouren.
- Alle gegevens wissen, met een tweede klik ter bevestiging.
