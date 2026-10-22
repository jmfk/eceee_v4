---
id: PRD-0035
title: Klassificeringens läsbyte och obligatorisk mediataggning
status: in-progress
locked: true
created: 2026-10-22
related_adrs:
  - ADR-0050
---

# PRD-0035: Klassificeringens läsbyte och obligatorisk mediataggning

## Problem

PRD-0031 har en lokal expansion men saknar färdig övergång för alla äldre skrivvägar, samlingar, uppladdning, import och publicering. Ägaren har uttryckligen begärt att hela leveransen färdigställs för säker migrering och driftsättning och att obligatorisk, taxonomistyrd mediataggning bevaras.

## Requirements

- Slutför PRD-0031:s befintliga omfattning. Befintliga UUID:n, taggkopplingar, versionsgränser, tenant- och namespace-isolering ska bevaras.
- Godkända mediafiler och mediasamlingar måste ha minst en giltig taxonomiklassificering. Varken gränssnitt, bulk, äldre API:er, ZIP, import eller direkt skrivväg får kringgå detta.
- Väntande filer får invänta taggning; godkännande kräver godkända, tillåtna termer i rätt namespace. AI-förslag uppfyller inte kravet.
- Uppladdning till samling ärver samlingens godkända termer, med oberoende efterföljande tilldelningar på fil och samling.
- Arkiverade befintliga tilldelningar bevaras. Arkiverade termer får inte användas för nya medier eller ny tilldelning.
- Det ska finnas en tydlig källa per övergångsfas, atomiska kompatibilitetsadaptrar och återupptagbar migrering med avstämning, verifiering, lokal canary och staging-underlag.
- Miljööverföring måste bevara hierarki, alternativa namn, hänvisningar, ordning och destinationens behörighetsgräns.
- Skapa ett Markdown-dokument på svenska som förklarar förändringen och konkret påverkan på taggning och mediataggning.
- Förbered granskbar driftsättning med preflight, backupkrav, stoppvillkor, verifiering och återhämtningsväg. Produktionskörning och driftsättning kräver repositoryts separata ägargodkännanden.

## Implementation Notes

- 2026-10-22: Started. Additive schema and existing pending Object workflow changes are preserved; production is untouched.

- 2026-10-22: Completed native media/collection selectors; compatibility actor/projection boundaries; taxonomy-aware transfer and historical restoration; published-version filters; guarded cutover, deferred PostgreSQL constraints and least-privilege function grants. The deployment runner takes backup and an operation lock, verifies schema and resumes a bounded canary; namespace activation is a separate step.
- 2026-10-22: Preserved the established legacy News import labels through the governed taxonomy service. AI results remain unapproved suggestions. Added Swedish product documentation and an operator runbook. Existing unrelated working-tree changes remain intact.

## Linked ADRs

- [ADR-0050](../adrs/active/0050-classification-cutover-and-media-integrity.md)
- [PRD-0031](0031-shared-classification.md)

## Completion Evidence

- Local implementation and verification are complete. Release acceptance remains pending representative-data reconciliation, staging, CI/review and the separate production gates.
- Isolated PostgreSQL candidate verification: 281 tests passed across taxonomy governance, populated-schema upgrade, interruption/resume and activation, mandatory media constraints, Object/site transfers and checkpoint restoration, media/ZIP APIs, Object workflow, legacy News import and publisher role provisioning. After the final merged-ID removal fix, all 12 mandatory-media tests passed again, including the added regression case.
- Frontend: 27 focused tests passed; taxonomy/media-picker ESLint passed without warnings; production Vite build passed (existing chunk-size warnings). Publisher: 50 database/model tests passed.
- Migration drift check: no changes detected. Specs validation and `git diff --check` passed. Mocked runner scenarios for success, canary failure and backup failure passed; activation is never automatic.
- No representative production-data copy, staging run, browser light/dark acceptance, CI, PR review, production command or deployment is claimed by these results.


### PR candidate integrated with current main

- Prepared in a separate managed worktree to preserve unrelated original changes. Includes the documentation dependency from PR #268. Document IDs are aligned to that dependency: shared classification PRD-0031/ADR-0043; cutover PRD-0035/ADR-0050.
- PostgreSQL candidate gate: 289 tests passed, including the populated schema upgrade. After final import/lint cleanup, all 51 non-migration taxonomy tests passed again. Frontend 27 focused tests and build passed; publisher 51 database/model tests and TypeScript passed. Changed Python files pass Black/isort/flake8. Frontend lint has zero errors and existing warnings; new taxonomy components lint without warnings. Schema drift, specs and mocked deployment runner checks passed.
- No staging or production operation is authorized or claimed. GitHub CI and submitted review are separate from this local verification.

### PR #271 review verification

- Review fixes cover mandatory-media database concurrency and allowed-use enforcement, namespace-first mutation locks, partial Object saves, canonical Page field precedence, destination-owned transfer identity/status, and atomic collection/duplicate approval with the existing media access gate.
- Final PostgreSQL application gate: `pytest taxonomy/tests --ignore=taxonomy/tests/test_migrations.py file_manager/tests/test_soft_delete.py object_storage/test_object_transfer.py webpages/tests/test_site_packages.py --reuse-db -q`: **235 passed**. An earlier gate also passed publisher-role provisioning tests.
- Final upgrade gate: `pytest taxonomy/tests/test_migrations.py taxonomy/tests/test_required_media.py object_storage/test_object_transfer.py -k 'populated_schema_upgrade or concurrent or disallowed_links or namespace_before or checkpoint_restores_pre_import' --reuse-db -q`: **13 passed**, covering a populated legacy schema, resumable backfill, direct SQL interleavings for files/collections and redirect targets, allowed-use rejection, retained historical rows, namespace-first resource updates and soft-deleted media restoration. The migration chain also installed into a new isolated PostgreSQL database with **60 taxonomy tests passed**; its final guard lock refinement was exercised by the subsequent populated-upgrade gate.
- Complete frontend unit suite: **1,868 passed** with two workers. Complete admin Playwright suite: **46 passed** with one worker, including classification selection/save/reload. The first unrestricted parallel attempt was interrupted after local resource contention/timeouts; the bounded reruns passed. Production Vite build, changed-file ESLint, Black/isort/flake8, migration drift check and `git diff --check` passed.
- These are local test/fixture results. Representative-data reconciliation, live staging acceptance, current-head GitHub CI and separate owner merge/data/deployment gates remain release requirements.

### Merge integration with tenant Kanban and support

- Integrated `main` at `68304c49`. Retained the main-branch support/Kanban PRD and ADR identities; moved this branch's draft article PRD to PRD-0035, article decision to ADR-0046 and classification cutover decision to ADR-0050. PRD-0031 and this PRD-0035 retain their identities and requirements.
- Kanban media imports use the shared approved-term picker and native classification IDs, validate the destination media use, explicitly write canonical assignments with the actor and retain prior classifications on deduplication. Designer import behavior is unchanged. Native typed same-name selection, member permissions, duplicate preservation and empty/proposed rejection have regression coverage.
- PostgreSQL clean-install and populated-legacy upgrade passed with the new main-branch migrations. All 40 Kanban tests pass after selecting approved taxonomy IDs in the private-destination fixture. All 1,886 frontend tests, 46 admin browser tests and the production build pass. Changed Kanban files pass Black/isort/flake8 and ESLint; specs validation and whitespace checks pass. Independent integration/risk review found no remaining verified P0–P3 issue. Current-head full CI and owner merge sign-off remain separate gates.

### Integration with merged main — 2026-10-23

The import implementation is already merged under PRD-0034 / ADR-0047. Its IDs, requirements, implementation evidence and transaction-safe media repair decision ADR-0049 are preserved. This cutover PRD uses the previously unused PRD-0035 / ADR-0050 identifiers; earlier candidate evidence above refers to the original branch and is not current-head verification. New guard migrations append after main’s migration 0006, without modifying the merged migration files. Current-head integration verification and review are required before merge.

### Current main integration verification — 2026-10-23

Rebased onto main `5a78cbfe` with the merged editorial importer and Profile/help changes intact. Existing migration files are unchanged; guard migrations append as 0007/0008 after main’s 0006. The isolated PostgreSQL integration run passed 347 tests; the five initial integration failures were corrected and the eight affected/new regressions passed on rerun, including a populated 0006-to-0008 upgrade. The 43 focused frontend tests plus two new inline-editor tests, Vite production build, changed-file ESLint, 51 publisher DB/model tests and TypeScript passed. Python Black/isort/flake8, schema drift, specs and mocked reconciliation runner checks passed. Independent P0–P3 review found and resolved three P2 defects in page clone namespace selection, renamed-term export and inline media editing; no verified remaining findings or ignored findings. These results do not claim representative production-data acceptance, live staging or current-head GitHub CI.
