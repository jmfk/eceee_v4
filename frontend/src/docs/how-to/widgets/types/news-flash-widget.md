# News Flash

Visar publicerade nyheter i den valda ordningen: först fullbreda kort, sedan halvbreda och till sist tredjedelsbreda. Standard är en fullbred och två halvbreda nyheter. Ange valfritt antal i varje grupp; noll döljer gruppen. Långa listor laddas i mindre omgångar vid scrollning, med en knapp som alternativ.

Välj objekttyp och eventuell klassificering i widgetens inställningar. Ange också sökvägen till nyheternas detaljsida, till exempel `/news/`.

**Image shape** väljer kvadratisk bild (1:1) eller liggande bild (7:4). Rubriken ligger ovanför texten och bilden. På smala ytor staplas innehållet utan att bildens proportioner ändras. Sidans layout står för widgetens yttre marginaler; korten har egen inre luft.

Prioritering ställs in på nyhetsobjektet, inte i widgeten:

- **Prioriterad nyhet** gör den senast publicerade prioriterade nyheten till huvudnyhet.
- **Prioriterad till** är ett valfritt datum och klockslag. Utan slutdatum gäller prioriteringen tills en nyare prioriterad nyhet publiceras.
- Publicera objektets ändringar för att de ska synas på webbplatsen.

När den senaste prioriteringen löper ut visas de senaste nyheterna. En äldre prioritering återaktiveras inte. Den utgångna nyheten kan fortfarande visas om den ingår bland de senaste.

I sloteditorn visas kort som platshållare för layouten. Platshållare visas också när publicerade nyheter saknas eller inte kan laddas. Vid laddningsfel kan du försöka igen.

På befintliga installationer behöver objekttypen Artikel ha fälten `newsPriority` (boolean) och `newsPriorityUntil` (datetime) i sin definition för att prioriteringskontrollerna ska visas. De ingår i profilen för nya installationer. Uppdatering av en befintlig definition görs separat i objekttypseditorn utan att ersätta övriga fält.
