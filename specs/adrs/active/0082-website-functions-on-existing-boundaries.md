---
id: ADR-0082
title: Webbplatsfunktioner på befintliga gränser
status: accepted
date: 2026-11-18
related_prds: [PRD-0065]
supersedes: []
superseded_by: []
---

# ADR-0082: Webbplatsfunktioner på befintliga gränser

## Decision

Publik sökning, SEO, språk och samtycke implementeras i TypeScript-publiceraren. Versionsbundna inställningar lagras som `page_data.website` och exponeras i sidinställningarna. Översättningar refererar sid-ID:n och löses enbart inom samma publicerade sajt. Sökresultat använder sajtens faktiska detaljsidor.

Gamla sid-adresser lagras som tenant- och sajtavgränsade alias till stabilt sid-ID. Aktuell sida har företräde; alias följer aktuell publicerad målväg utan kedjor. Automatisk historik gäller sid-adresser, inte objektsluggar.

Befintliga formulär behåller den begränsade skrivarens behörigheter. Separata modereringskolumner kan inte sättas från publika formulärdata. Godkännande är en granskningsstatus, inte publicering. CMS använder befintlig Django-session och rättighetsmodell.

Statistik återanvänder befintlig ingestion via en sajtupplöst same-origin proxy. Inga cookies eller beständiga besöks-ID:n skapas av spårningen. Samtyckesvalet sparas lokalt och kan ändras. Kontoexport omfattar kontouppgifter och egna supportmeddelanden; radering hanteras som spårbar supportbegäran med manuell identitets- och bevarandeprövning.

## Rationale

Undvik ett parallellt konto-, formulär- och statistiksystem. Medlemsbundna externa evenemang inväntar medlemsgrunden; befintliga formulär kan ta emot förslag nu.

## Consequences

- Ett additivt Django-schema behövs för alias och moderering.
- Ingen ny leverantör eller publikt skrivkonto införs.
- Exportens avgränsning visas tydligt; den är inte en automatisk juridisk fullständighetsbedömning.

## Verification finding

Ren installationsverifiering blockerades i äldre migration 0080 eftersom den anropar ett växande layoutstandardvärde som nu överstiger PostgreSQLs gräns för katalograden för kolumnstandardvärden. Installationsvägen använder därför ett litet tomt objekt vid kolumntillägget, fyller layoutdokumenten och återställer modellens Python-standardvärde utan ett stort SQL-standardvärde. Redan tillämpade migrationer ändrar inga befintliga databaser.

## Final boundary details

Nexts slashless canonical-path policy används även i sitemap och aliasmål. Sökning/sitemap hämtar den effektiva publicerade detaljwidgetens typkontrakt; dess vinnande objekt per slug bestäms innan arkivets text-/typ-/datumfilter och paginering. Riktiga undersidor har företräde. Även tomma eller fasta dynamiska fallbackvyer får pröva tidigare sid-adresser.

Sidflyttar läser tidigare väg under radlås. Första publiceringen förmedlar om sidan var publik före publiceringsmutationen, så ett aldrig publikt utkast inte kan ersätta en existerande historisk omdirigering. BCP 47-nycklar i `translations` undantas från DRF:s rekursiva casingkonvertering. Privata inskick kräver både läs- och redigeringsrätt, har kontobunden cache och tas bort ur cache när vyn lämnas.

## Dependency patch

Byggverktygets säkerhetsvarning verifierades mot npm:s aktuella rådgivning: Next 16.4.2 omfattades av GHSA-mfr8-8qww-v76h och GHSA-vc7v-qv4w-wrv8. Befintlig beroendestil behålls och Next uppdateras till 16.4.6 inom samma patchserie, med ny låsfil, byggverifiering och produktionsberoendeaudit. Detta undviker att leverera den nya tenantavgränsade publiceraren med ett känt cacherelaterat säkerhetsfynd.
