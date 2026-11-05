# Standwerk POS: instructies voor Claude Code

## Wat we bouwen
Een kassasysteem (POS) met voorraadbeheer voor grote merchandise-operaties: festivals, tours en evenementen met meerdere stands of kassa's tegelijk. Denk aan honderden SKU's (shirts en hoodies in maten, caps, vinyl, posters) en piekdrukte waarin elke seconde per klant telt.

Er is al een werkend prototype: `prototype/standwerk-pos.html`. Dat is de referentie voor functionaliteit, schermen en look & feel. De echte versie moet dezelfde functies hebben, maar dan productierijp.

## Lees eerst
1. `docs/01-functionele-specificatie.md`: alle functies zoals ze in het prototype werken
2. `docs/02-datamodel.md`: entiteiten en velden
3. `docs/03-roadmap.md`: fasering en wat er in v1 moet
4. `docs/04-betaalterminals.md`: eisen voor de pinkoppeling
5. `docs/05-design.md`: kleuren, typografie en layout

Open het prototype in een browser om het te zien werken. Lokaal valt het terug op localStorage. Via Instellingen kun je voorbeelddata laden.

## Uitgangspunten
- **Taal**: de interface is volledig Nederlands. Code, variabelen en commentaar in het Engels.
- **Geld**: reken in hele centen (integers), nooit met floats. Het prototype rondt floats af; dat moet anders.
- **Btw per product**: het prototype heeft één btw-tarief. In Nederland vallen sommige producten onder 9% (bijvoorbeeld boeken, zoals een tourboek). Maak het tarief per product of categorie instelbaar.
- **Voorraad**: de voorraad volgt uit voorraadmutaties (stock movements). Een verkoop, retour, levering, telling of import is altijd een mutatie; de actuele voorraad wordt nooit los overschreven zonder mutatie. Twee kassa's mogen nooit tegelijk het laatste stuk verkopen: gebruik database-transacties of een atomaire decrement met controle.
- **Bonnen**: verkopen en retouren zijn onveranderlijke boekingen met een uniek, oplopend bonnummer per kassa. Een retour is een aparte boeking die verwijst naar de originele bon. Corrigeer nooit een bestaande bon.
- **Offline**: festivals hebben slecht internet. Kassa's moeten offline door kunnen verkopen en later synchroniseren.
- **Meerdere kassa's**: alle kassa's van één event delen dezelfde voorraad, realtime.
- **Snelheid**: een verkoop van één product moet in twee tikken kunnen. Barcode scannen werkt via het zoekveld (scanner als toetsenbord, Enter = toevoegen).

## Voorgestelde stack (overleg met de gebruiker voordat je kiest)
- Frontend: React + TypeScript als PWA (installeerbaar op tablet, telefoon en desktop), met IndexedDB voor offline.
- Backend: Postgres (bijvoorbeeld via Supabase) met realtime updates en auth.
- Excel: SheetJS voor import en export, zoals in het prototype.
- Grafieken: Chart.js of Recharts.
- Betalingen: een adapter-interface per terminalleverancier (zie doc 04).

## Werkwijze
- Bouw in de fases uit de roadmap en laat na elke fase iets werkends zien.
- Schrijf tests voor geldberekeningen (korting, btw, retour na korting, omruiltegoed) en voorraadmutaties.
- Vraag de gebruiker bij keuzes over betaalleverancier, hosting en kosten.
