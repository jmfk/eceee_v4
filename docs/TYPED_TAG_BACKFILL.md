# Typed tag backfill runbook

The typed-tag migration is an expand-only migration. Existing page and media tag fields remain authoritative until a later read/write cutover.

## Persistence and safety

Backfill checkpoints are stored in PostgreSQL in `taxonomy_tagbackfillrun` and `taxonomy_tagbackfillunit`. The database, rather than a container filesystem, is the durable checkpoint location.

Each run is bound to:

- the ordered legacy source data fingerprint;
- the effective backfill configuration and command implementation;
- `APP_VERSION` or `GIT_COMMIT_HASH` when supplied by the deployment.

The command refuses to resume if any of those values differ. Start a new run for a changed source snapshot.

## Deployment sequence

1. Deploy and apply schema migrations normally.
2. Run a bounded canary:

   ```bash
   python manage.py backfill_typed_tags --run-id typed-tags-YYYYMMDD-canary --stop-after 100
   ```

3. Inspect the recorded run and failures. Resume the same immutable run to finish:

   ```bash
   python manage.py backfill_typed_tags --run-id typed-tags-YYYYMMDD-canary
   ```

4. Verify independently of the write path:

   ```bash
   python manage.py backfill_typed_tags --run-id typed-tags-YYYYMMDD-canary --verify-only
   ```

Use a distinct run ID if legacy tags changed after the canary. Do not delete or modify legacy tags as part of this phase.

## Interruption and resume

`SIGINT` and `SIGTERM` request a cooperative stop. The current source object is committed atomically before the run becomes `interrupted`. Re-running with the same run ID skips durably completed work units and retries failed units.

## Failure handling

The command records per-object errors and exits unsuccessfully when any unit remains failed. Correct the data or configuration problem, then resume the same run if its source fingerprint remains unchanged. Use `--verify-only` before declaring the backfill complete.

No production commands should be run directly over SSH. Use the repository deployment process and an approved deployment-script entry point when the backfill is scheduled for production.
