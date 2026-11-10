# Roadmap

## Fase 1: fundament (eerste werkende productieversie)
- Projectopzet: PWA (React + TypeScript), backend met Postgres en auth.
- Datamodel uit doc 02, met bedragen in centen, btw per product en voorraadmutaties als bron van waarheid.
- Alle schermen uit het prototype nagebouwd met hetzelfde design (doc 05).
- Kassa: verkopen, varianten, korting, contant met wisselgeld, barcode scannen.
- Veilige voorraad: atomaire afboeking, zodat twee kassa's niet hetzelfde laatste stuk verkopen.
- Excel importeren en exporteren (zelfde kolomherkenning en controlescherm).
- Realtime synchronisatie tussen kassa's.
- Tests voor alle geldberekeningen.

## Fase 2: retouren, afsluiting en rapportage
- Retour met en zonder bon, omruilen met tegoed, retourtermijn.
- Dagafsluiting met kastelling en verschillen.
- Dashboard met alle widgets, vergelijkingen en Excel-export (9 tabbladen).
- Voorraadmutaties-logboek met export.

## Fase 3: gebruikers en events
- Medewerkers met rollen. Inloggen met pincode, wisselen van medewerker op een gedeeld apparaat.
- Rechten: korting boven X%, retouren en voorraadcorrecties alleen voor een manager.
- Meerdere events of tours, met voorraad per locatie of stand en overboekingen tussen locaties.
- Kassa's registreren als apparaat, met een eigen bonnummerreeks.

## Fase 4: offline en betaalterminals
- Offline verkopen met een lokale wachtrij (IndexedDB), automatische synchronisatie en conflictafhandeling.
- Koppeling met de gekozen betaalterminal-leverancier (doc 04): bedrag naar de terminal, status terug, annuleren en terugbetalen op de terminal.
- Bonprinter (bijvoorbeeld via ESC/POS) en digitale bon via QR of e-mail.

## Fase 5: uitbreidingen
- Productafbeeldingen op de kassategels.
- Bundels en acties (bijvoorbeeld shirt + cap voor € 55).
- Nabestel-advies op basis van de voorraadprognose.
- Koppeling met de boekhouding (bijvoorbeeld Exact of Moneybird) en met een webshop.
- Klantgerichte display voor het bedrag.
