---
id: PLAN-0005
title: Omkartläggning av legacyinnehåll mot gemensam klassificering
status: in-progress
created: 2026-10-27
related_prds:
  - PRD-0034
  - PRD-0031
  - PRD-0035
related_adrs:
  - ADR-0056
  - ADR-0046
  - ADR-0047
  - ADR-0050
---

# PLAN-0005: Omkartläggning av legacyinnehåll

Den granskade mappningen för källsite 2 är implementerad som versionsstyrt inventarium (`backend/content_migration/legacy_content/site2_terms.json`), uttryckliga beslut (`site2_decisions.json`) och validerande kompilator (`term_plan.py`). De 698 använda identiteterna blir 703 portabla måltermer inklusive tre innehållsslag. Den godkända termmodellen, alla ämnes-ID:n och sammanslagningar följer den beslutade genomförandeplanen i denna session. Inga källhierarkier observerades. Nya källtermer eller ändrade källnamn stoppar stage tills beslutsfilen granskats på nytt.

`news`, `columns`, `columnists`, `events` och `organizations` är standardurvalet. `publications` och `ReportPage` ingår inte; `library_item` behålls som måltyp. Nyckelord kan användas av Artikel, Krönikör, Evenemang och Organisation. Importen skapar inga termer när den granskade kartan används. En separat portabel termberedning går via taxonomins rättighetskontrollerade API. Importmanifestet innehåller kartans digest, målterm-UUID:n och en fingerprint för termrevisioner. Full import kräver ett accepterat devprov med samma karta och termtillstånd.

Den gamla isolerade lokala site-0-importen säkerhetskopierades och rensades med exakta skyddsvillkor 2026-10-27. Därefter bereddes 703 termer och ett blandat site-2-prov med två poster per resurs importerades som 10 utkast utan blockerade poster. En återkörning skapade inga extra versioner. Proveniens, exakta antal, kommandon och kvarvarande manuell granskning finns i [importguiden](../../docs/legacy-editorial-import.md).

**Återstående gate:** granska provets innehåll, relationer, klassificeringar och fyra mediafiler redaktionellt; acceptera därefter manifestet bara om utfallet är korrekt. Före full import krävs ny inventering av aktuell källa, avvikelseanalys mot de 698 identiteterna, större blandade prov och separat miljö-/ägargate. Produktionsåtgärder ingår inte här. Om postgranskningen visar annan betydelse för en ämnesterm ändras beslutsfilen och provacceptansen görs om.
