---
id: PRD-0065
title: Medlemsmejl och kontaktformulär
status: draft
locked: false
created: 2026-11-19
related_adrs: []
---

# Medlemsmejl och kontaktformulär

Medlemmar ska kunna slutföra kontoärenden via e-post. Besökare ska kunna kontakta ECEEE från den publika sajten och få veta att meddelandet kom fram.

## Krav

- Skicka inbjudan, e-postverifiering, lösenordsåterställning och besked när medlemskap börjar eller avslutas. Meddelandet ska ange vad som hände och vad mottagaren kan göra härnäst. Länkar ska gå till rätt webbplats.
- Återanvänd befintlig e-postleverans där den uppfyller kraven. Dubbletter i köhanteringen får inte skicka samma besked två gånger. Leveransfel ska kunna följas upp utan att exponera lösenord, engångslänkar eller innehåll i supportloggar.
- Återanvänd Publisherns formulär för kontaktsidan. Det ska gå att skicka meddelandet med tangentbord, korrigera valideringsfel utan att fylla i formuläret på nytt och få en tydlig bekräftelse när meddelandet har sparats. ECEEE ska kunna ta emot och läsa meddelandet.
- Testa formulärets spamfälla och anropsbegränsning tillsammans med normal inskickning. Hanteringen ska hålla formulärsvar och eventuella mottagarinställningar inom rätt tenant.

## Acceptans

- En testmottagare får varje medlemsmejl och kan följa rätt länk från mobil och dator. Testa saknad leverans, kontrollerat nytt utskick, utgången länk och upprepad händelse.
- Besökaren får bekräftelse på sidan när formuläret tagits emot. Ett misslyckat inskick lämnar ett begripligt fel och ger möjlighet att försöka igen. Spamfällan ska inte lägga ett ärende i mottagarens kö.
- Nyhetsbrev hanteras separat.

## Relaterade dokument

- [PRD-0059 – Medlemskonton och Mina sidor](0059-eceee-member-accounts.md)
- [PRD-0010 – Public form submissions](0010-public-form-submissions.md)
- [PLAN-0007 – Verifiering av medlemsgrundpaketet](../plans/0007-eceee-member-foundation-verification.md)
