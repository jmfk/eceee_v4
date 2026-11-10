# Nattlista: kompletterande skärmbilder

Målet är att fånga stabila nyckelvyer som stöd till animeringen. För musrörelser och övergångar ska Playwright spela in flödet direkt från webbsidan; skärmbilderna behöver därför inte täcka varje mellanruta.

## Regler för fångsten

- Fånga med samma Chrome-inloggning och jämför med de befintliga JPG-bilderna.
- Fånga produktionsvyer endast för läsning. Skapa, ändra, godkänn, publicera eller ångra inget i prod.
- Använd staging med särskilda demodata och konto-roller för flöden som kräver ändringar eller testförslag.
- Varje bild ska vara en ren vy utan personlig information, öppna utvecklarverktyg eller andra appar.
- Spara JPG i videons `screenshots/`-mapp. Lägg en kort bildtext och den tillhörande berättarrösten i samma `screenshots/README.md`.

## Publisher: arbeta med objekt

Befintliga fem bilder visar objekttyper, sökresultat, innehållseditor, sparläge och publiceringsstatus.

- [ ] Filtermenyn öppen: objekttyp och status innan ett filter väljs.
- [ ] New-formuläret öppet för en demotyp; lämna tomt och avbryt utan att skapa.
- [ ] Settings-fliken för ett befintligt publicerat objekt, med fältgrupperna synliga.
- [ ] Objektträdet med rot, underobjekt och relaterat objekt; fånga både hopfällt och utfällt läge.
- [ ] Widgetens More actions-meny öppen, inklusive tillgängliga val.
- [ ] Widget configuration-dialogen öppen; avbryt utan att spara.
- [ ] Publish-fliken med versionshistorik och tillgängliga kontroller; ingen publicering eller restore.

## Taggar: gemensam struktur

Befintliga bilder visar taggregistret, taggdetalj, innehållsväljaren, typfilter och tillåtna användningsområden.

- [ ] Filtermenyn öppen med hela listan av taggtyper.
- [ ] Taggdetalj som visar typ, plats, beskrivning och alternativa namn för en komplett term.
- [ ] Hierarkisk tagg med överordnad kategori utfälld och en underterm vald.
- [ ] Borttagbar typfilter-pill efter att söktext också angetts.
- [ ] Innehållsredigerarens taggsökning med en godkänd träff, utan att ändra taggar på objektet.

## Taggar: förslag och godkännande

Prod-kön var tom vid senaste fångsten. Bilder på ett verkligt granskningsflöde kräver staging.

- [ ] Staging: förslagsställarkonto öppnar New tag och ser knappen Submit proposal.
- [ ] Staging: ifyllt, oskickat exempel med namn, kort definition och alternativt namn; inga verkliga person- eller kunduppgifter.
- [ ] Staging: bekräftelse direkt efter inskickning och förslaget i kön med väntande status.
- [ ] Staging: granskningsvy med typ, plats, beskrivning, alternativa namn och före/efter.
- [ ] Staging: beslutsknapparna synliga innan beslut; separat slutbild efter testgodkännande.
- [ ] Staging: avslag med skäl och slutlig status.
- [ ] Staging: mediafil som saknar godkänd tagg och den synliga spärren mot godkännande.
- [ ] Staging: samma mediavy efter att en godkänd tagg valts; lämna filen opublicerad.
- [ ] Prod, endast läsning: öppna Rights och visa rättighetskontroller utan att välja användare eller spara.

## Designer: marginaler, padding och typografi

Temaarbetsytan fastnade vid “Loading Designer workspace…” för två kontrollerade teman. Ta dessa först när arbetsytan laddar. Använd staging eller en särskild demakopia för ändringar.

- [ ] Öppnad temaarbetsyta med navigation, förhandsvisning och Save draft/Publish changes synliga.
- [ ] Marginal/padding-sektion med den aktuella komponenten markerad i förhandsvisningen.
- [ ] Kontrollpanel med nuvarande värden och enheter för yttre marginal respektive inre padding.
- [ ] Responsiv vy/breakpoint-växling med samma komponent vald.
- [ ] Typografipanel med familjlista öppen och tillgängliga typsnitt/varianter synliga.
- [ ] Typografipanel med storlek, vikt och radavstånd; fånga nuvarande värden utan att publicera.
- [ ] Före/efter i förhandsvisningen efter en liten, reversibel staging-ändring.
- [ ] Save draft-dialog eller bekräftelse efter teständring.
- [ ] Publish changes-bekräftelsen före klick och slutstatus efter testpublicering.
- [ ] Undo publish före klick och återställd status efter teståterställning.

## För ljud och undertexter

- [ ] Bestäm svensk röst efter att ha lyssnat på samma korta provtext med två eller tre röster.
- [ ] Läs upp produktnamn, engelska UI-etiketter och vanliga taggtermer; lägg till uttalslexikon där det behövs.
- [ ] Behåll en slutlig berättarrösttext per scen så att ljud och bildtext kan tidsättas om utan att manus och videon glider isär.
