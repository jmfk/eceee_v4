---
id: PLAN-0001
title: Embedded CMS and Design Agent implementation plan
status: ready
created: 2026-10-14
related_prds:
  - PRD-0022
  - PRD-0023
  - PRD-0024
related_adrs:
  - ADR-0026
  - ADR-0027
  - ADR-0028
  - ADR-0029
  - ADR-0030
  - ADR-0031
  - ADR-0032
---

# PLAN-0001: Embedded CMS and Design Agent

## Outcome

Deliver one embedded, durable CMS agent runtime and a production-shaped Design Agent vertical journey. Then extend the same runtime to Pages, widget instances, Objects, and explicitly allowlisted Settings without bypassing existing workflows.

The first complete journey is:

> An assigned designer opens Design Agent in Designer, asks for a responsive layout/theme change, reviews the plan, steers the active run, sees validated previews, reloads without losing state, and leaves the coherent change in the shared Designer draft for a separate publication decision.

## How to Run This Plan in Codex

- Run one numbered batch at a time in the repository's normal local environment.
- Treat each batch as one coherent review unit; do not split backend, frontend, and tests into micro-PRs when they implement one journey.
- Before the first code change, set PRD-0022 and PRD-0023 to `started` and `locked: true`. Start PRD-0024 only when Batch 9 begins.
- Read all linked PRDs and ADRs before each batch. Do not change locked requirements; record interpretations in a new ADR.
- Inspect the current branch and dirty worktree before editing. Preserve unrelated user changes.
- Use existing APIs and services before adding abstractions. Do not add a second theme, page, object, widget, or permission source of truth.
- Keep the first runtime single-agent and single-writer. Do not add subagents unless eval evidence and a separately accepted ADR justify them.
- Use focused tests during implementation and the broader gates listed under Release Gates before push.
- Do not open a PR if relevant local checks fail or external CI is known to fail before project code runs.
- Do not deploy, publish production content, inspect secrets, or create credentials as part of these batches without the repository's separate gates.

### Suggested Codex routing

These are recommendations for separately approved Codex tasks, not automatic task creation:

| Work | Suggested model | Reasoning |
| --- | --- | --- |
| Inventory, test collection, mechanical API clients, documentation | `gpt-6-luna` | medium |
| Bounded UI or provider adapter implementation with fixed contracts | `gpt-6-luna` | medium |
| Data model, concurrency, authorization, queue recovery, and domain tool boundaries | `gpt-6-sol` | medium |
| Difficult cross-domain conflicts, security review, or repeated eval failures | `gpt-6-astra` | smallest sufficient elevated effort |

Do not delegate work that edits the same migrations, runtime state machine, or shared agent UI concurrently.

## Architecture Target

### New backend package

Create one Django app, provisionally `cms_agents`, with these internal modules:

```text
backend/cms_agents/
  models.py
  permissions.py
  capabilities.py
  state_machine.py
  services/
    queue.py
    runner.py
    context.py
    checkpoints.py
    approvals.py
  providers/
    base.py
    fake.py
    openai.py
    anthropic.py
  tools/
    registry.py
    designer.py
    pages.py
    objects.py
    settings.py
  views.py
  serializers.py
  tasks.py
  consumers.py
  tests/
```

Names may change to match established project conventions, but preserve the responsibility boundaries.

### Initial durable models

- `AgentSession`: tenant, creator, profile, title, optional current target, timestamps, archived state.
- `AgentQueueItem`: session, stable position, kind, user prompt, immutable target descriptor, base revision, status, idempotency identity, copied-from reference.
- `AgentRun`: queue item, attempt, provider/model snapshot, capability snapshot, prompt/program version, budget, status, lease owner and fencing generation, heartbeat, cancellation state, terminal result.
- `AgentEvent`: append-only public activity with a commit-ordered per-session sequence, correlation/causation, event type and schema version, sanitized payload, actor, timestamp.
- `AgentToolCall`: run, stable call/idempotency IDs, tool version, sanitized arguments/result, approval class, reviewed/resulting revisions, status.
- `AgentCheckpoint`: run, sequence, provider-neutral context summary, target/revision map, open work, validation evidence, token accounting.
- `TenantModelCredential`: tenant, provider, encrypted secret, public label/prefix, encryption version, status, created/rotated/revoked metadata.
- Optional `AgentApproval`: exact action, target/revision set, impact snapshot, expiry, approver, consumed state. Add only when Batch 7 needs it rather than speculatively in Batch 1.

All tenant-owned rows include explicit tenant scoping in queries, relation checks, indexes, unique constraints, serializers, WebSocket subscriptions, background workers, and integration tests. Follow the repository's current application-enforced tenant boundary and fail closed when tenant context is absent; do not introduce partial agent-only PostgreSQL RLS without a separate repository-wide migration decision.

### Initial frontend package

```text
frontend/src/agent/
  api/
  components/
    AgentLauncher
    AgentDock
    AgentChat
    AgentActivity
    AgentQueue
    AgentTargetBar
    AgentApprovalReview
  context/
  hooks/
  routes/
  tests/
```

Use the existing application shell, global notifications, API client, authentication, and responsive patterns. Add one shell-level launcher/command-palette integration; do not mistake the schema-field `CommandPaletteInput` for an existing global application command palette or duplicate actions on one screen.

## Batch 0 — Baseline and Governance Lock

### Goal

Make the implementation starting state explicit and prevent accidental conflict with unfinished Designer/Layout work.

### Work

- Re-read PRD-0022, PRD-0023, ADR-0026 through ADR-0032, ADR-0003, ADR-0004, ADR-0009, ADR-0010, ADR-0015, and ADR-0016.
- Inspect current open work, migrations, test health, and the legacy `AIAgentTask` routes/components.
- Decide whether the active branch is the correct batch branch; use `codex/` prefix for a new branch if the user requests one.
- Move PRD-0022 and PRD-0023 to `started` and `locked: true` only when implementation actually begins.
- Add an implementation note recording the branch and first batch scope.
- Verify the spec index and run the spec validator.

### Verification

```bash
python /Users/jmfk/.codex/skills/prd-adr-governance/scripts/validate_specs.py "$(git rev-parse --show-toplevel)"
git diff --check
```

### Stop conditions

- Stop if current uncommitted work overlaps the files needed for Batch 1 and ownership cannot be resolved safely.
- Stop if an existing PR or branch already implements the same runtime and consolidation is needed.

## Batch 1 — Durable Agent Domain Foundation

### Goal

Create a tenant-scoped state machine and read-only API without calling a real model or mutating CMS data.

### Work

- Create the `cms_agents` app and migrations for `AgentSession`, `AgentQueueItem`, `AgentRun`, `AgentEvent`, `AgentToolCall`, and `AgentCheckpoint`.
- Use UUIDs for public/cross-service identities. Allocate each session's event sequence while holding the session's ordering lock in the same transaction that changes state, or use an equivalent commit-ordered design with explicit gap recovery.
- Define statuses and legal transitions in one state-machine module.
- Add tenant/profile capability construction and server-side target descriptors.
- Add authenticated APIs for session create/list/detail/archive, queue list/create/edit/copy/delete/reorder, run/event detail, and read-only subscription authorization.
- Editing and deletion must reject claimed/running items.
- Copy creates a new identity and preserves an auditable source link.
- Reorder all affected items in one transaction; prefer simple integer positions and bounded renumbering over a speculative ranking framework.
- Persist each append-only event in the same transaction as the state change it describes. Use `transaction.on_commit` only to notify Channels after the durable event exists.
- Do not reuse the legacy `AIAgentTask` model as the new domain record. Document coexistence.

### Tests

- Model constraints and legal/illegal transitions.
- Tenant A/B API isolation for every new table and endpoint.
- Cross-tenant relation and uniqueness rejection, missing-tenant failure, and connection-reuse tests for API, worker, and WebSocket code paths.
- Profile and target authorization, including crafted IDs.
- Concurrent queue reorder and claim behavior.
- Edit/copy/delete lifecycle rules.
- Idempotent session/queue creation where applicable.
- State/event rollback atomicity, concurrent event ordering, out-of-order completion, reconnect cursor, and sequence-gap recovery.
- Migration test and model drift check.

### Verification

```bash
cd backend
python manage.py test cms_agents.tests
python manage.py makemigrations --check --dry-run
```

Run the repository's backend formatter/linter commands for touched files.

### Done when

- A user can manage a durable queue through API calls, but no worker or model can run it yet.

## Batch 2 — Fake Provider, Tool Registry, and Recoverable Runner

### Goal

Prove the complete agent loop, queue claim, checkpoints, steer, stop, recovery, and tool authorization using deterministic fakes.

### Work

- Define provider request/event/result and capability contracts.
- Add a scripted fake provider supporting messages, public plan output, tool requests, streaming events, usage, injected delay, failure, and cancellation behavior.
- Define the tool registry and strict tool descriptor contract from ADR-0027.
- Start with read-only diagnostic tools: current time-free static response, session target echo, and authorized theme metadata read.
- Implement a Celery runner that claims one item transactionally, acquires a target lease and monotonically increasing fencing generation, runs bounded model/tool steps, records events, checkpoints, usage, and terminal state.
- Poll steer/cancel state at every safe boundary.
- Check lease owner and fencing generation atomically inside every mutating tool transaction. Implement lease heartbeat, abandoned-run recovery, bounded retries, and idempotent tool-call reuse.
- Treat Celery delivery as a best-effort wakeup. Add a periodic PostgreSQL reconciler that re-dispatches eligible unclaimed queue items and abandoned runs, with bounded per-tenant concurrency so one tenant cannot starve others.
- Route committed public events through Channels; polling remains a recovery fallback.
- Cap steps, wall time, tool calls, tokens, and budget in the runner.

### Tests

- Deterministic complete run and streaming event order.
- Steer before first tool, between tools, and during an uncancellable provider wait.
- Cooperative stop and discarded obsolete provider result.
- Worker crash before tool, after tool commit, before checkpoint, and after checkpoint.
- Duplicate Celery delivery and duplicate provider tool-call identity.
- Lost initial broker wakeup and repeated reconciler delivery.
- Lease expiry, paused stale-worker resumption, fencing rejection, and one-writer enforcement.
- Per-tenant concurrency/fairness under a noisy queue.
- Tool capability missing, permission revoked, target moved, and stale revision.
- Sanitized event output and absence of hidden reasoning/provider payloads.

### Verification

```bash
cd backend
python manage.py test cms_agents.tests.test_runner cms_agents.tests.test_queue cms_agents.tests.test_tools
```

### Done when

- The fake provider can run, be steered, recover from every injected crash boundary, and never duplicate a fake mutation.

## Batch 3 — Embedded CMS Agent Shell

### Goal

Expose the durable runtime throughout the authenticated CMS without yet enabling design mutations.

### Work

- Add a global Agent launcher and command-palette action.
- Add a docked, resizable panel with Chat, Activity, and Plan/Queue modes.
- Add a full agent workspace route for sessions and history.
- Display tenant, profile, target, reviewed revision, connection state, and budget.
- Implement queue edit/copy/delete/reorder and active steer/stop controls.
- Stream committed events; reconnect from the last contiguous sequence without duplicates, detect gaps, and replay them from PostgreSQL before advancing the cursor.
- Preserve the panel/session across CMS navigation and browser reload.
- Add contextual launch hooks for Designer and Layout without registering mutating tools.
- Errors remain inline and say what happens next. Use recoverable actions and Undo where applicable instead of generic confirmation dialogs.
- Register keyboard shortcuts and ensure full keyboard/screen-reader operation.

### Tests

- Component tests for empty, loading, streaming, reconnect, error, waiting, completed, and cancelled states.
- Queue lifecycle and steer interaction tests.
- Route/auth/tenant switching tests.
- Keyboard navigation, focus retention, accessible names, zoom-safe layout, reduced motion, light mode, and dark mode.
- End-to-end reload/reconnect test against the fake provider.

### Verification

```bash
cd frontend
npm run test:run -- src/agent
npm run lint -- --quiet
npm run build
```

### Done when

- The fake agent is usable from the CMS shell and Designer/Layout entry points, survives reload, and manages its queue without mutation tools.

## Batch 4 — Design Agent Read Context and Plan

### Goal

Give the `designer` profile accurate, bounded theme/layout context and useful plans without writing the draft.

### Work

- Add read tools for assigned theme, Designer workspace, layout document, selected layout/node, theme tokens, preview documents, layout usage, widget quick reference, and relevant validation rules.
- Build a Designer context pack from explicit IDs and fresh server reads.
- Register context from Designer and Layout selection without sending complete unauthorized tenant content.
- Add a versioned Design Agent system contract and structured plan schema.
- Show proposed affected subsystems, commands, approvals, risks, validation, and preview steps.
- Add deterministic token-budget trimming with provenance and tests.
- Create an initial eval dataset of at least 30 Design Agent briefs covering responsive layout, typography, palette, slots, special pages, preview documents, invalid requests, and authorization.

### Tests and evals

- Every read tool enforces assignment/tenant boundaries.
- Context contains current draft/live versions and selected target, not stale client copies.
- Context budget retains invariants and drops low-priority material deterministically.
- Plans never include unavailable tools or real page/object mutation under `designer`.
- Golden tasks score tool availability, target correctness, required validation, and publication separation.

### Done when

- Design Agent can inspect and plan representative work accurately with no write capability.

## Batch 5 — Design Agent Draft Mutations

### Goal

Complete the deterministic design-mutation integration path by applying validated, recoverable changes to the shared Designer draft. The useful model-driven alpha is complete only after the real-provider work in Batch 8.

### Work

- Add typed operations for palette, fonts, allowed spacing/style properties, layouts, nodes, slots, responsive overrides, special pages, authorized theme-asset replacement, and theme-owned preview documents.
- Keep advanced full-theme fields outside the initial `designer` profile unless already supported by the restricted Designer API.
- Apply each coherent operation batch through `save_designer_draft` or a narrow service that preserves the same row locks, `draft_version`, `base_sync_version`, patch validation, and snapshot behavior.
- Use stable node/layout/widget IDs and reject index-only addressing.
- Validate `validate_theme_layouts`, layout compatibility, theme field constraints, assets, and preview documents before commit.
- Before a high-impact batch, persist an immutable pre-mutation Designer-draft snapshot or validated inverse operation tied to the tenant, theme, starting draft version, base sync version, affected paths, and referenced assets. Do not rely on live-theme history to restore an unpublished shared draft.
- Extend `delete_unreferenced_designer_assets` (or its canonical successor) so every unexpired agent recovery point, including a validated inverse operation, counts as a persisted asset reference. Define recovery retention and cleanup together so assets become collectible only after every live draft, revision, export, and recovery reference is gone.
- Return structural diffs and resulting draft version.
- On conflict, re-read and require replan; do not auto-overwrite.
- Restore is explicit and may apply only when the current draft still matches the mutation's resulting revision; otherwise show the diff and require a new plan.

### Tests

- Authorized designer and theme admin in restricted profile.
- Unauthorized theme, changed assignment, cross-tenant theme, stale draft, stale live theme.
- Required layouts, duplicate keys/IDs, invalid depth/node counts, referenced slot removal, unsupported styles, invalid special-page references, and authorized asset replacement through the canonical Designer service.
- Tool idempotency and crash recovery around the draft transaction.
- Clean recovery to the pre-agent draft plus refusal to overwrite unrelated changes made after the agent mutation.
- Asset cleanup retains an object referenced only by an unexpired snapshot or inverse recovery point, then removes it after that recovery point expires or is deleted and no other persisted reference remains.
- Preservation of unrelated full-theme fields and snake/camel boundaries.
- Theme preview documents remain independent of live pages/objects.

### Verification

```bash
cd backend
python manage.py test webpages.tests.test_designer_theme cms_agents.tests.test_designer_tools

cd ../frontend
npm run test:run -- src/pages/__tests__/DesignerThemeWorkspacePage.test.jsx src/pages/__tests__/LayoutWorkspacePage.test.jsx src/components/designer/__tests__/LayoutDesignerWorkspace.test.jsx
```

### Done when

- The first journey can plan, apply, conflict safely, validate, and leave the live theme untouched.

## Batch 6 — Preview, Render Parity, and Design Review

### Goal

Make Design Agent visually useful and prevent valid-but-broken draft output.

### Work

- Add tools to render the draft using the existing iframe/standalone render model at mobile, tablet, and desktop widths.
- Return bounded preview artifacts and machine-readable validation rather than injecting image bytes into normal context.
- Add deterministic checks for overflow, missing slots, invalid media, contrast where measurable, inaccessible semantics, empty/error states, and breakpoint regressions.
- Add a public visual-review summary and optional model vision review when the selected provider supports it.
- Keep edit and render components separate; update fixtures and parity tests only when product behavior actually changes.
- Add a representative visual eval corpus with long Swedish text, empty content, nested layouts, tables, forms, images, navigation, and errors.

### Tests

```bash
cd frontend
npm run test:run -- src/rendering/__tests__/registryParity.test.ts src/rendering/__tests__/PageRenderer.test.tsx
npm run test:run -- src/rendering/__tests__/themeLayoutRenderer.test.tsx src/rendering/__tests__/StandaloneRenderRuntime.test.tsx
npm run test:run -- src/components/__tests__/PagePreview.iframe.test.jsx src/rendering/__tests__/RenderFrameRuntime.test.tsx
npm run test:run -- src/pages/__tests__/DesignerThemeWorkspacePage.test.jsx
npm run lint -- --quiet
npm run build
```

Run browser checks for Editor Preview, standalone React render, and the existing public/Django parity route at relevant widths.

### Done when

- Each material design batch produces traceable previews and the relevant parity gates pass.

## Batch 7 — Human Review and Publication Boundary

### Goal

Add exact-state approval for Designer publication without conflating validation with authorization.

### Work

- Add the minimal `AgentApproval` model if needed by the chosen interaction.
- Create an impact review for theme subsystems, current draft/live versions, validation, previews, recovery checkpoint, and expected public effect.
- Bind approval to tenant, theme, draft version, live sync version, profile, action, and user.
- Invalidate approval on any relevant version or capability change.
- Execute only the existing Designer/Layout publication service.
- Show progress, result, new revision, and available undo/restore action.
- Do not add generic approval to safe draft tools.

### Tests

- Valid, stale, replayed, expired, cross-user, cross-tenant, and changed-permission approvals.
- Publication remains atomic and creates the expected Designer revision.
- Failed publication does not consume recovery evidence or partially change the theme.

### Done when

- A reviewed current draft can be published once through the existing workflow, and stale approval cannot publish.

## Batch 8 — Tenant Credentials and Real Providers

### Goal

Turn the deterministic integration preview into a useful opt-in Design Agent alpha by replacing the fake provider with secure OpenAI and Anthropic adapters.

### Work

- Apply the `inspect-secrets-safely` and secret lifecycle instructions before credential implementation or testing.
- Add `TenantModelCredential` and write-only create/rotate/revoke/status APIs.
- Reuse or deliberately extend the existing application encryption pattern with a separate purpose/context; never log or return secrets.
- Add provider/model registry, capability snapshots, allowlist/kill switches, per-run limits, rate-limit normalization, and usage/cost attribution.
- Implement OpenAI and Anthropic adapters against their current official APIs.
- Use structured tool outputs and provider-native streaming where supported.
- Use native compaction only as an optimization behind the provider-neutral checkpoint contract.
- Add redacting test adapters; live acceptance tests are opt-in and return boolean/status evidence without exposing credentials.
- Keep Gemini, Grok, and DeepSeek disabled until separate adapter contract batches pass.

### Tests

- Encryption round trip through internal helpers without secret output.
- API never serializes ciphertext or plaintext.
- Tenant isolation, role restrictions, rotation, revocation, disabled provider/model, bad credentials, rate limit, timeout, malformed tool calls, unavailable usage, cancellation, and provider outage.
- Boolean-only leak scans of captured logs/events/errors/test output.
- Shared recorded-contract suite for both adapters.

### Done when

- Both providers can complete the Design Agent eval smoke set with secure tenant credentials and bounded costs.

## Batch 9 — Page and Widget-Instance Agent

### Goal

Start PRD-0024 and deliver one complete CMS editor journey for Pages and existing widget instances.

### Work

- Set PRD-0024 to `started` and `locked: true`.
- Add `cms_editor` read tools for page tree/search, page workflow, working copy, layout/theme choices, widget registry, slots, objects for references, and preview.
- Add Page create/structural tools and complete working-copy mutation tools carrying expected version and edit revision.
- Add stable-ID widget instance add/update/move/copy/remove operations against the complete working snapshot.
- Validate schemas, slot containment, nested widgets, references, theme/layout compatibility, and render parity before commit.
- Add page preview and structural diff.
- Add exact-state review for publish/schedule/unpublish, but leave them disabled until tests prove the gate.

### Tests

- Reuse the full Page workflow and collaboration suites.
- Independent human/agent changes rebase where supported; overlaps return explicit conflict.
- Unauthorized page/theme/object/widget references and cross-tenant IDs fail closed.
- Duplicate delivery and crash recovery do not create duplicate pages/widgets.
- Page remains unpublished after the default journey.

### Verification

```bash
cd backend
python manage.py test webpages.tests.test_page_version_workflow cms_agents.tests.test_page_tools

cd ../frontend
npm run test:run -- src/components/__tests__/PageEditor.dirty.test.js src/rendering/__tests__/registryParity.test.ts src/components/__tests__/PagePreview.iframe.test.jsx
```

### Done when

- An editor can create or edit a working page with existing widget types and previews without silent overwrite or publication.

## Batch 10 — Object Revision Safety, Objects, and References

### Goal

Establish a safe Object mutation boundary before enabling Object Agent writes.

### Work

- Audit ObjectInstance/ObjectVersion mutation and publication paths, schema validation, references, and concurrency.
- If no explicit reviewed revision exists, create a separate PRD/ADR or linked implementation decision before changing the object model.
- Add monotonic revision and canonical complete-snapshot mutation behavior equivalent in safety, not necessarily implementation, to Page versions.
- Add `cms_editor` object read/create/edit tools, schema-bound fields, stable widgets, tenant-scoped references, preview, and separate publish/schedule actions.
- Re-read and validate object type schema immediately before mutation.

### Tests

- Clean creation, stale writes, independent/overlapping changes, delete-versus-edit, schema changed mid-run, invalid reference, cross-tenant reference, widget nesting, publication review, retry, and recovery.
- Existing object editor tests and transfer/import contracts remain green.

### Stop condition

- Keep Object tools read-only if the reviewed-revision contract cannot be introduced safely in the same coherent batch.

### Done when

- Object mutations cannot silently overwrite a newer human or agent change.

## Batch 11 — Allowlisted Settings and Theme/Admin Profile

### Goal

Add useful administration without creating a generic settings supertool.

### Work

- Inventory Settings routes and classify each as read, safe mutation, reviewed high-impact mutation, secret-bearing, destructive, operational, or machine-denied.
- Record the inventory in code and tests using stable capabilities.
- Start with read access plus narrowly typed value-list and additive object-type operations if their recovery and impact analysis are adequate.
- Reuse full Theme workflows for `theme_admin`; do not expose raw theme row mutation.
- Keep users/roles, credentials, machine keys, remote connections, data connections, migrations, experiments, destructive schema changes, and operational controls denied until separately specified.
- Show affected object counts, compatibility, validation, and roll-forward/rollback for schema changes.

### Tests

- Every Settings endpoint is classified; unclassified endpoints default deny.
- Client-crafted tool names/capabilities cannot register denied tools.
- Secret-bearing serializers never return values to agent context.
- Additive schema/value-list changes validate existing records and recover from failure.

### Done when

- The Theme/Admin profile has a small, explicit, tested settings surface and no generic CRUD escape hatch.

## Batch 12 — Retrieval, Evals, and DSPy Readiness

### Goal

Improve context quality based on measured failures and make prompt optimization reproducible.

### Work

- Expand profile evals toward 100 representative cases, retaining a held-out test set.
- Record metrics for target correctness, tool selection, schema validity, conflict behavior, repair loops, visual checks, human acceptance, undo rate, latency, tokens, and cost.
- Add a curated knowledge corpus only for gaps shown by evals. Start with provenance-labelled PostgreSQL lexical search.
- Add embeddings/pgvector only if a controlled comparison materially improves held-out retrieval without authorization regressions.
- Version context-builder, prompt/program, tool schema, and eval dataset identifiers on every run.
- Add offline candidate comparison and regression reports.
- Introduce DSPy only when ADR-0032 prerequisites are met. Keep it in development tooling, compile per provider/model family, and require reviewed artifacts.

### Tests

- Retrieval permission filtering, source invalidation, commit/schema version mismatch, prompt injection in retrieved content, context budget stability, checkpoint continuity, and provider switching.
- Candidate prompt/program must beat baseline on held-out quality without failing any safety invariant or materially exceeding approved cost/latency.

### Done when

- Agent changes can be justified by repeatable eval evidence rather than anecdotal prompting.

## Batch 13 — Hardening, Rollout, and Legacy Disposition

### Goal

Prepare a controlled beta and decide the future of the old generic AI task surface.

### Work

- Run authorization, tenant-isolation, prompt-injection, tool-confusion, SSRF/path, secret-redaction, budget-abuse, and recovery reviews.
- Load test queue claim, event delivery, reconnect, heartbeat, provider throttling, and long-session compaction.
- Add retention and deletion policies for messages, events, tool payloads, previews, and credentials.
- Add operational dashboards and kill switches for provider/model/profile/tool.
- Run an internal feature-flagged pilot with Design Agent, then selected CMS editors.
- Define support and incident runbooks.
- Inventory consumers of legacy `AIAgentTask`; migrate, deprecate, or retain it explicitly. Do not delete it as incidental cleanup.
- Update user documentation only for enabled capabilities.

### Release gates

- Zero known cross-tenant access paths in automated and manual tests.
- Zero secret values in API responses, model inputs, public events, logs, traces, screenshots, or captured exceptions.
- All mutating tools pass idempotency, stale-state, permission-change, and crash-boundary tests.
- Design Agent parity and responsive preview gates pass.
- Page/Object workflows retain their full existing suites.
- Held-out eval meets the product's agreed task-completion, correction, cost, and latency thresholds.
- Rollback/kill-switch behavior is rehearsed.

### Done when

- The beta can be enabled per tenant/profile without deploying new code and can be disabled without losing CMS data.

## Cross-Batch Verification Gates

Run focused tests after each batch. Before every push that changes a shared contract, run the relevant broader gate:

```bash
python /Users/jmfk/.codex/skills/prd-adr-governance/scripts/validate_specs.py "$(git rev-parse --show-toplevel)"
git diff --check

cd backend
python manage.py makemigrations --check --dry-run

cd ../frontend
npm run lint -- --quiet
npm run build
```

Use `make test` or the repository's current broader test target before a release candidate. Record exact commands, results, skipped checks, and residual risk in each batch handoff.

## Testing Matrix

| Area | Required evidence |
| --- | --- |
| Models/migrations | Constraints, indexes, status transitions, clean install, upgrade, no drift |
| Tenancy/permissions | A/B isolation for API, WebSocket, worker, retrieval, tools, events, credentials |
| Queue/concurrency | Claim race, reorder race, single writer, stale target, revoked capability |
| Idempotency/recovery | Duplicate delivery, provider retry, crash at every tool/checkpoint boundary |
| Steering/cancel | All safe boundaries, uncancellable call, obsolete result discard, reconnect |
| Providers | Shared capability contract, malformed output, limits, errors, usage, cancellation |
| Context/RAG | Fresh authoritative state, compaction continuity, provenance, injection, invalidation |
| Design | Theme preservation, layout validation, responsive preview, render parity, recovery |
| Pages/Objects/widgets | Canonical revision workflows, schema/slot/reference validation, publication separation |
| Settings | Explicit inventory, default deny, impact analysis, secret redaction |
| UI/accessibility | Keyboard, screen reader, focus, resize, zoom, light/dark, reduced motion, inline errors |
| Evals | Golden tasks, adversarial tasks, held-out results, quality/cost/latency regression |

## Expected Delivery Shape

- Batches 0–3: runtime foundation and embedded shell.
- Batches 4–7: deterministic Design Agent workflow integration preview.
- Batch 8: useful tenant-BYOK Design Agent alpha with real providers.
- Batches 9–11: CMS content and safe administration expansion.
- Batches 12–13: measured optimization and production hardening.

For one experienced full-time engineer, expect approximately five to eight months to complete the broad beta, with a useful Design Agent alpha after Batch 8. Two engineers can shorten calendar time only where files and invariants do not overlap; keep the runtime state machine, migrations, and shared agent shell under single-owner coordination.
