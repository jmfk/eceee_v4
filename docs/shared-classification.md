# Klassificering: migrering, verifiering och driftsättning

Produktförklaringen finns i [Klassificering och obligatorisk mediataggning](klassificering-och-mediataggning.md). Beslut: [ADR-0043](../specs/adrs/active/0043-classification-governance.md) och [ADR-0050](../specs/adrs/active/0050-classification-cutover-and-media-integrity.md). Omfattning: PRD-0031 och PRD-0035.

## Modell och skrivkontrakt

`ClassificationType` äger typens stabila nyckel, namespace, tillåtna användningar och rättigheter. `Tag` behåller UUID och `tag_type`. Strukturella ändringar låser typen, kontrollerar revision och rättighet och sparar en atomisk historikpost. Sammanslagning behåller källan och läsningar följer hänvisningen. Återställning av operationer avvisas konservativt vid efterföljande strukturändringar.

Tilldelningar lagras i ordnade relationer: `PageVersionTag`, `ObjectVersionTag`, `MediaFileClassification` och `MediaCollectionClassification`. Sid- och objekttilldelningar är versionsbundna. Mediefil och samling har oberoende tilldelningar. API-fältet heter `classification_ids`, frontendfältet `classificationIds`.

`replace_assignments` är den gemensamma tilldelningsgränsen. Äldre media-M2M och versionsfält speglas atomiskt. Äldre HTTP-skrivningar och stödda bakgrundsimporter anger faktisk aktör och passerar samma behörighetskontroll. Interna projektioner har avgränsat rekursionsskydd. Ny integrationskod ska använda tilldelningstjänsten och explicit användare, inte ändra relationstabeller eller kompatibilitetsfält direkt.

Godkända medier och samlingar kräver minst en klassificering. Pending-media kan vara otaggade tills de godkänns. Nya tilldelningar kräver godkända termer i rätt scope och med tillåten användning. Historiska arkiverade tilldelningar bevaras. Föreslagna termer tillåts i sid-/objektutkast men stoppar publicering. AI-text sparas som förslag.

`ClassificationRollout` lagrar namespace-fas och verifierat kör-ID. Saknad rad betyder äldre fas. Schemaändringar aktiverar aldrig automatiskt ett namespace. Efter aktivering kontrollerar PostgreSQL uppskjutet att aktiva mediefiler och samlingar har giltiga tilldelningar. Kontrollen gäller även vid ORM/bulk och relevanta ändringar av term, typ och hänvisning. Uppskjutningen möjliggör atomiskt skapande och byte av tilldelningar. SQLite ger inte detta databasskydd.

## API och läsningar

Taxonomirutter kräver autentisering och medlemskap i vald tenant. Listor är paginerade och kan sökas och scopes till namespace.

- `/api/v1/taxonomy/types/`: definitioner; `configure/` kräver aktuell revision. `members/` och `role_templates/` stöder rättighetsförvaltning.
- `/api/v1/taxonomy/terms/`: filtrera på `classification_type`, `status`, `use`, `descendant_of` och `search`.
- Termåtgärder `edit/`, `move/`, `merge/`, `archive/` tar `{revision, payload}`. Flytt använder `parent_id`; sammanslagning använder `target_id` och `target_revision`.
- Termens `usage/` visar behörighetsfiltrerad användning och begränsade länkar.
- `/api/v1/taxonomy/proposals/`: förslag och `decide/` med beslut och skäl.
- `/api/v1/taxonomy/grants/`: namngivna tilläggsrättigheter per typ. Medlemmar har normalt use/propose; ägare/superuser har samtliga rättigheter.
- `/api/v1/taxonomy/history/`: ändringshistorik och revisionskontrollerad `restore/`.

Tillåtna användningar är `pages`, `media_files`, `media_collections` och `object:<object-type-id>`. Klassificeringsrättigheter ersätter inte innehållets egna rättigheter.

Listfilter accepterar upprepade eller kommaseparerade `classification_ids`; `include_descendants=false` stänger av standardutvidgningen till underordnade termer. Historiska sammanslagnings-ID:n matchar ersättaren. Publicerade objektlistor filtreras mot exakt publicerad version före sortering/begränsning. Publisherns databasroll får enbart nödvändiga läskolumner genom den befintliga `provision_publisher_roles`-rutinen.

Överföringspaket innehåller termernas typ, hierarki, alternativa namn, status, hänvisning och ordning. Importen mappar till destinationens identiteter och rättigheter; konflikter stoppar importen. Checkpoint-återställning återställer ordnade tilldelningar och kompatibilitetsfält. Nytillkomna klassificeringsidentiteter behålls spårbara och oanvända termer arkiveras i stället för att raderas.

## Förberedelser och stoppvillkor

Använd först en isolerad återställd kopia av representativa data och därefter staging. Enhetstester med fixtures är inte bevis på att produktionsdata kan migreras utan manuell klassificering. Inventera alla berörda namespaces och identifiera tenantägaren som får aktivera respektive namespace.

Före förändring ska det finnas en verifierad databasbackup och bevarade medieobjekt/lagringsreferenser. Den befintliga `validate-typed-tags-backup.sh` kan användas för återläsningskontroll i isolerad miljö. Kör aldrig återläsning mot levande databas som ett verifieringssteg.

Stoppa vid ofullständig backup, saknad schemaändring, namn-/scopekonflikt, förändrat källfingeravtryck, misslyckad arbetsenhet, saknade tilldelningar, projektionsskillnad eller felaktig publisherbehörighet. Lägg inte på en generell standardtagg för att dölja brister. Rapportera resurs-ID och låt redaktör fatta klassificeringsbeslut.

Migreringskommandona läser flera tenants. Planera en sammanhängande skrivpaus för alla berörda redaktörs- och bakgrundsflöden. Tidigare kod ska inte skriva parallellt med ny kod. Rullande blandversioner stöds inte under dataövergången. Vanlig driftsättning startar tjänsterna; håll därför redaktörstrafiken spärrad tills efterföljande avstämning och acceptans är färdig. Detta är en uttrycklig extra underhållspåverkan som ska ingå i produktionsgodkännandet.

## Körordning i isolerad miljö och staging

Nedan är management-kommandon avsedda att köras med miljöns vanliga backend-runner. Ersätt kör-ID:n, namespace-ID och aktörs-ID med verifierade värden. Kör-ID är högst 100 tecken. Spara resultat tillsammans med release-taggen och exakt commit.

1. Installera kandidatens schema med den vanliga migrationsrutinen och kontrollera `python manage.py migrate --check`. Migrationskedjan är additiv och behåller gamla tabeller/identiteter.
2. Kör den första taggmigreringen på en oföränderlig källbild:

   ```sh
   python manage.py backfill_typed_tags --preflight-only
   python manage.py backfill_typed_tags --run-id typed-release-canary --stop-after 100
   python manage.py backfill_typed_tags --run-id typed-release-canary
   python manage.py backfill_typed_tags --run-id typed-release-canary --verify-only
   ```

3. Kör utvidgningen med ett eget kör-ID:

   ```sh
   python manage.py reconcile_classifications --preflight-only
   python manage.py reconcile_classifications --run-id classification-release-canary --stop-after 100
   python manage.py reconcile_classifications --run-id classification-release-canary
   python manage.py reconcile_classifications --run-id classification-release-canary --verify-only
   ```

   Kommandot initierar definitioner, ansluter befintliga UUID:n, kopierar medietilldelningar, mappar fem separata News-dimensioner och kopierar versionernas kopplingar. Det vägrar skriva över redan avvikande redaktionella tilldelningar.

4. Spara färsk avstämning för varje namespace:

   ```sh
   python manage.py classification_cutover --namespace 123 --report classification-123.json
   ```

   `ready=false` ger felkod och blockerar aktivering. Rapporten skiljer bland annat saknad obligatorisk klassificering, ogiltigt scope/status, omappade äldre taggar och projektionsskillnader. Otaggade historiska filer och samlingar måste klassificeras manuellt. Efter redaktionella rättningar har källbilden ändrats: kör och verifiera en ny reconciliation med ett nytt kör-ID.

5. Kontrollera praktiskt: otaggad fil kan vara pending men inte godkännas; godkänd term fungerar; sista taggen kan inte tas bort; annan tenants term avvisas; samlingsuppladdning kopierar godkända termer; efterföljande ändringar är oberoende. Kontrollera bulk, ZIP, import/återställning, utkast/publicerad version och filtrerad publicerad lista. Verifiera väljaren med tangentbord och i ljus/mörk vy.
6. Aktivera uttryckligen, först när rapporten är grön och det senaste kör-ID:t är verifierat:

   ```sh
   python manage.py classification_cutover --namespace 123 --activate --actor 456 --run-id classification-release-canary --report classification-123-active.json
   ```

   Aktivering kontrollerar om körningens kod/config/källfingeravtryck fortfarande stämmer och gör en ny avstämning under namespace-lås. Tenantägare eller superuser krävs. En gammal rapport räcker inte.
7. Upprepa funktionell kontroll efter aktivering, verifiera tjänsternas hälsa och publisherns läsning, och släpp därefter redaktörstrafiken. Bevara rapporter, kör-ID, backupreferens och testutfall som releaseunderlag.

## Avbrott, återupptagning och återhämtning

`TagBackfillRun` och `TagBackfillUnit` är beständiga checkpoints. Varje arbetsenhet och dess utdata skrivs i samma transaktion. `--stop-after` och processignaler stoppar mellan enheter; samma kör-ID återupptar oförändrad kod/config/källbild och hoppar över färdiga enheter. Sammanfattningsräknare räknas om från beständiga enheter. En dödad process kan lämna körstatus running; samma identitet kan ändå återupptas.

Ändrad kod/config/källbild kräver en ny bedömning och ett nytt kör-ID. `--verify-only` ska passera före aktivering. Starta inte en ny körning för att dölja ett dataintegritetsfel; rätta först orsaken och bevara föregående felrapport.

Före aktivering kan skrivpausen behållas och körningen repareras/återupptas utan att aktivera namespace. Efter aktivering är den föredragna återhämtningen en framåtriktad kompatibel rättning. Äldre applikationsversioner som inte kan skriva klassificering får inte återställas direkt mot ett aktiverat namespace. Ändra inte fasen till legacy för att kringgå integritetsfel. Produktionsåterställning, databasrestore, avaktivering och breda datarättningar kräver egna godkända återhämtningsplaner. Tagg- och paketåterställning är behörighetskontrollerad och kan avvisas vid senare konflikter.

## Produktion

Ingen produktionsåtgärd godkänns av detta dokument. Repositoryts aktuella `AGENTS.md` gäller för miljö/host, separat exakt datamigreringsgodkännande och release-taggets exakta commit.

- Distribuera endast granskad release med `make prod-deploy TAG=<release-tag>` efter dess separata ägargodkännande. Deployrutinen ansvarar för preflight, backup, schema, publisherroll och hälsokontroll.
- För första backfill finns `make prod-backfill-typed-tags`; för utvidgningen finns `make prod-reconcile-classifications`, med explicita `RUN_ID` och `CANARY_SIZE`. Båda är separata dataoperationer som måste omfattas av egna ägargodkännanden.
- `reconcile-classifications.sh` använder den driftsatta versionen, gemensamt produktionslås, stoppar backend/Celery, tar obligatorisk backup, kontrollerar schema, gör canary/resume/verifiering och återstartar med hälsokontroll. EXIT återstartar tjänster efter ett avbrott; vid återhämtningsfel stoppar operatören och begär separat återhämtningsbeslut. Skriptet aktiverar inga namespaces.
- Namespace-avstämning och aktivering är uttryckliga efterföljande operationer. Kör readiness först och begär därefter den exakta aktiveringens godkännande. Meddela förlängd skrivpaus och residualrisker. Produktionskommandon får inte improviseras runt deployrutinen.

## Verifieringsstatus

PR-granskningen kompletterar databasskyddet med migration `0008_serialize_media_guards`. Samtidiga borttagningar låser medieobjektet innan kravet på minst en tagg kontrolleras. Nya kopplingar låser även term, eventuella sammanslagningsmål och klassificeringstyp så att samtidig ändring av taxonomin inte kan lämna en ogiltig koppling. Nya kopplingar i ett aktiverat namespace måste använda en klassificeringstyp som tillåter respektive medieslag. Befintliga historiska kopplingar behålls vid omordning även om typens tillåtna användning senare begränsas. Migrationen ändrar funktioner och triggers utan att skriva om befintliga data; bakåtmigrering återställer föregående skydd.

Vid sidsparande med både gamla `tags` och nya `classification_ids` är den nya klassificeringen styrande. En objektsparning som utelämnar klassificeringsfältet behåller befintliga taggar; en uttrycklig tom lista tar bort dem där tom klassificering är tillåten. Jämförelsen vid återimport är läsande och återaktiverar inte arkiverade termer.

Godkännande av en dubblett lägger till valda taggar och behåller filens befintliga klassificering, inklusive historiska taggar. Filens vanliga åtkomstkontroll gäller även här. Om godkännandet samtidigt begär en ny samling måste taggtypen tillåta både filer och samlingar; ett samlingsfel lämnar uppladdningen väntande och rapporteras till användaren. Import som hittar en befintlig destinationstagg med samma namn men annan status avvisas utan en etablerad identitetsmappning, så att befintligt innehåll inte ändras av en namnkollision.

Kandidaten verifierades med 281 backendtester i en ny isolerad PostgreSQL-databas. Efter den sista rättningen för äldre sammanslagna mediatagg-ID:n passerade samtliga 12 obligatoriska mediatester igen. Frontendens 27 riktade tester, 50 publishertester, ESLint för de nya väljarkomponenterna och produktionsbygget passerade. Det finns inga modelländringar som saknar migration. Runnerns lyckade körning, avbrutna canary och misslyckade backup verifierades med mockade tjänster. Detaljer dokumenteras i PRD-0035:s completion evidence.

 Verkliga lokala datakopior, staging-acceptans, CI/granskning och produktionsgodkännanden måste registreras separat före release. Detta dokument påstår inte att dessa miljöåtgärder redan har utförts.

Efter PR-granskningen passerade 235 backendtester, en separat uppgraderings- och integritetskontroll med 13 tester, 1 868 frontendtester och 46 webbläsartester. Migrationskedjan installerades även i en ny isolerad PostgreSQL-databas. Detaljer och kommandon finns i PRD-0035:s senaste verifieringsanteckning.
