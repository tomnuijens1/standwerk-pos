# Design

Het prototype is de visuele referentie. Hieronder de vaste waarden.

## Kleuren (licht)
| Token | Waarde | Gebruik |
|---|---|---|
| --bg | #ECEEF3 | achtergrond |
| --surface | #FFFFFF | panelen en kaarten |
| --surface-2 | #F5F6F9 | subtiele vlakken, tabelkop |
| --ink | #17162B | tekst, primaire knoppen, hero-kaart |
| --muted | #676B80 | secundaire tekst |
| --line | #E1E3EA | randen |
| --side | #17162B | zijbalk |
| --accent | #FFC23D | merkgeel: Pin-knop, actief menu-item, accenten |
| --brand | #4F46E5 | grafieken, links, focus |
| --ok / --warn / --bad | #14805A / #B86A00 / #C93636 | status, met zachte achtergronden |

## Kleuren (donker)
--bg #0E0D1A, --surface #191830, --surface-2 #211F3A, --ink #EEEDF7, --muted #9C9DB4, --line #2D2B48, --side #090813, --brand #8C86FF, --ok #3FCB91, --warn #F2A93B, --bad #FF6B6B. Volgt standaard het systeem, maar is ook handmatig te kiezen.

## Categoriekleuren
#FFC23D, #8C86FF, #5ED3A4, #FF8A7A, #6EC6FF, #F49AD8, #C7D36B, #FFB27A (op volgorde van de alfabetisch gesorteerde categorieën).

## Typografie
- **Bricolage Grotesque** (600, 700, 800) voor koppen, grote getallen en bedragen.
- **Figtree** (400–700) voor de rest van de tekst.
- Paginatitel 30px/800. Hoofdcijfer op het dashboard 40–58px/800. Kengetallen 28px/700. Basistekst 15px.
- Getallen in tabellen met `font-variant-numeric: tabular-nums`.

## Vormen
- Afronding: 18px voor panelen, 12px voor tegels en knoppen, 8–10px voor kleine elementen.
- Schaduwen zacht en subtiel.
- De hero-kaart op het dashboard is donker (--ink), met een gedraaid geel vlak rechtsboven als merkaccent.

## Layout
- **Desktop**: zijbalk van 232px en content met 32px marge.
- **Kassa**: producttegels links (raster, minimaal 160px breed) en de bon rechts (380px, sticky).
- **Onder 860px**: het menu wordt een balk onderin, de bon komt onder de tegels, en een gele zwevende knop toont het aantal items en het totaal.
- **Retourmodus**: rode rand en een melding bovenin de bon.

## Tekst en toon
- Nederlands, kort en direct, en zinnen beginnen met een hoofdletter.
- Knoppen zeggen wat er gebeurt: "Product toevoegen", "Afsluiting opslaan".
- Foutmeldingen zeggen wat er mis is en wat je kunt doen: "Niet genoeg voorraad van Tour Tee Zwart M".
- Lege schermen geven een volgende stap, zoals "Importeer je assortiment uit Excel".
