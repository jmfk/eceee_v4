---
id: PRD-0058
title: Sömlös automatisk laddning av publika listor
status: started
locked: true
created: 2026-11-18
related_adrs: [ADR-0075]
---

# Sömlös automatisk laddning av publika listor

## Mål och omfattning

Alla publika listor som hämtar innehåll i omgångar ska automatiskt hämta nästa omgång när besökaren scrollar, med god framförhållning. Kravet gäller befintliga och nya listor, även filtrerade listor, sökresultat och listor på subsajter. Första införandet omfattar News, Columnists och kalendern. Seminarier, kommande evenemang, biblioteket och andra paginerade vyer omfattas när de byggs eller uppdateras. Korta listor som redan visar hela sitt avsedda urval är färdigladdade.

## Krav

- Starta nästa hämtning långt innan besökaren når slutet på det som är inläst. Vid normal scrollning på dator och mobil ska innehållet redan finnas på plats när besökaren når skarven.
- Lägg nya poster efter de befintliga. Bevara scrollposition, tangentbordsfokus, sorteringsordning och aktiva filter. I kalendern fortsätter poster i samma månad under befintlig rubrik.
- Ett nytt filter eller en ny sökning startar ett nytt urval. Sena svar från ett tidigare urval ska aldrig blandas in.
- Behåll inläst innehåll vid fel och ge ett tillgängligt sätt att försöka igen. Erbjud manuell laddning som reserv när automatisk laddning saknas. Det ska gå att nå sidfoten med tangentbord.
- Stoppa när hela urvalet eller listans redaktionellt satta maxantal har visats.

## Acceptans

- Långa listor på News, Columnists och Events hämtar nästa omgång före skarven på dator och mobil. Verifiera även i mobilens nätverkssimulering och dokumentera vid vilka förhållanden väntan blir synlig.
- En omgång tillkommer utan dubbletter, hopp eller fokusförflyttning. En månad som fortsätter över en sidgräns har en enda rubrik.
- Snabba filterbyten visar endast det senast valda urvalet. Ett simulerat nätfel bevarar listan och ett manuellt omförsök fungerar utan dubbla poster.
- Tomma och korta listor stoppar korrekt. Endast en hämtning per lista pågår åt gången och ingen hämtning görs efter slutet.

## Beslut

[ADR-0075 om tidig förhämtning](../adrs/active/0075-prefetch-public-list-batches.md).
