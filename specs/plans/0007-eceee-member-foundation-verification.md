---
id: PLAN-0007
title: Verifiering av medlemsgrundpaketet
status: proposed
date: 2026-11-19
related_prds: [PRD-0059, PRD-0060, PRD-0065]
---

# Verifiering av medlemsgrundpaketet

## Nuläge 2026-11-19

CMS har lösenordsinloggning, lösenordsåterställning och anslutning av Google och Apple för befintliga konton. Den publika sajten saknar medlemsinloggning, medlemsregister och Mina sidor. Mediebibliotekets etikett för medlemmar kontrollerar CMS-inloggning. Publishern behöver en egen kontroll av aktivt webbplatsmedlemskap för sidor, API och skyddade original.

Publishern kan validera och lagra formulärsvar, visa bekräftelse på sidan och använda spamfälla och anropsbegränsning. ECEEE:s kontaktsida och hantering av inkomna meddelanden behöver verifieras i en samlad resa. CMS:ets autentiseringsmejl ger en befintlig leveransväg att utvärdera för medlemsmejl.

- [CMS-autentisering och befintligt teststöd](../../docs/authentication.md)
- [Publisherns formulärfunktion](../prds/0010-public-form-submissions.md)

Den lokala baslinjen omfattar 68 godkända CMS-autentiseringstester på PostgreSQL, 47 komponenttester för CMS-konto och formulär, två tester av publik formulärrendering, 27 tester av Publisherns formulär inklusive PostgreSQL-kontrollen och tre Playwright-tester för CMS-inloggning med simulerade API-svar. Riktiga leverantörsinloggningar, mejlleverans och den publika medlemsresan återstår.

## Leveransordning

1. Bjud in en testmedlem i CMS. Personen verifierar sin adress, väljer lösenord, loggar in på den publika sajten och ser sin status på Mina sidor. Leverera lösenordsåterställning, giltighet och avslut i samma medlemsresa.
2. Anslut Google och Apple till samma medlem. Prova de riktiga leverantörerna på en registrerad HTTPS-testdomän efter automatiserade tester med simulerade leverantörssvar.
3. Publicera en rapport med publik beskrivning och medlemslåst PDF. Kör samma åtkomstfall genom sidrendering, API och nedladdning.
4. Slutför medlemsbeskeden och kontaktsidan. Kontrollera både besökarens bekräftelse och att ECEEE kan läsa inskickade meddelanden.

Piloten använder inbjudna testmedlemmar i två testtenants. FileMakers roll som källa för medlemsstatus är öppen. Organisationsmedlemskap kräver fastställda regler för vem som får åtkomst, dess giltighet och vem som kan återkalla den.

## Obligatoriska scenarier

| Område | Tester före godkännande |
| --- | --- |
| Inbjudan och e-post | Giltig, använd, återkallad och utgången inbjudan, fel mottagare, verifiering, nytt utskick och samtidiga försök att lösa in samma länk. Bekräfta att medlemmen bara får ett konto. |
| Lösenord och session | Inloggning, utloggning, omstartad webbläsare, utgången session, fel lösenord, glömt lösenord för både känd och okänd adress, ogiltig eller använd återställningslänk och ny inloggning efter återställning. |
| Google och Apple | Första inloggning och återbesök, avbrutet flöde, leverantörsfel, Apple med dold e-post, uttrycklig kontokoppling, identitet som redan är kopplad och återkomst till den rapport användaren öppnade. |
| Mina sidor och register | Medlemmen ser sin profil och aktuell status. Administratören kan söka, bjuda in, sätta giltighet och avsluta. Loggen visar aktör, tid, medlemskap och ändring. En andra tenant saknar åtkomst till både posten och loggen. En medlem saknar CMS-roll. |
| Skyddad sida, API och PDF | Testa publik beskrivning och skyddad resurs som utloggad, overifierad, aktiv, utgången, avslutad och medlem i annan tenant. Prova opublicerad rapport, direkt filadress, miniatyrer, sök, cache mellan två sessioner och en redan utfärdad länks dokumenterade giltighetstid. |
| Mejl och kontakt | Inbjudan, verifiering, återställning, medlemsbesked, leveransfel och nytt utskick. Kontakta ECEEE med giltiga och felaktiga fält, spamfälla, för många anrop och tillfälligt serverfel. Kontrollera bekräftelsen på sidan och ECEEE:s faktiska mottagning. |

## UI och webbläsare

- Kör de huvudsakliga resorna i Chrome och Safari på dator samt i Safari på iPhone och Chrome på Android. Använd riktiga enheter för minst de mobila inloggnings- och nedladdningsflödena. Gå igenom hela resan med tangentbord, lösenordshanterare och VoiceOver.
- Bedöm om en testperson hittar rätt mellan inloggning, glömt lösenord, Mina sidor, uppdaterad medlemsstatus och rapporten. Kontrollera läsordning, synligt fokus, tillgängliga fältnamn, fel som pekar ut rätt fält, zoom och att layouten fungerar vid smal skärm.
- Granska vänteläge, tom sökning, fel, avbrott, utgången länk och lyckad åtgärd för varje berörd vy. Spara skärmbilder med testdata från publika medlemsvyer och CMS och skriv ned hur varje allvarligt fynd åtgärdades.

## Underlag för godkännande

- Automatisera beteende och negativa fall genom ordinarie HTTP-ingångar. Använd PostgreSQL, privat testlagring och testmejl för de integrerade resorna. Kör Full CI för ändringar som påverkar autentisering, behörighet, tenantgränser eller persistenta medlemsdata.
- Dokumentera commit, testmiljö, testfallens resultat, webbläsare och enhetsmodell. Komplettera automatiska tester med riktiga Google- och Apple-flöden, riktiga testmejl och manuell UI-granskning på förhandsvisningen. Skärmbilder och loggar ska vara fria från inloggningsuppgifter och engångslänkar.
- Grundpaketet kan godkännas när varje obligatoriskt scenario är kört och godkänt samt när blockerande användbarhets- och tillgänglighetsfynd är åtgärdade. Ett test som hoppats över ska markeras som återstående.
