# Typed tag backfill runbook

The typed-tag migration is an expand-only migration. Existing page and media tag fields remain authoritative until a later read/write cutover.

## Persistence and safety

Backfill checkpoints are stored in PostgreSQL in `taxonomy_tagbackfillrun` and `taxonomy_tagbackfillunit`. The database, rather than a container filesystem, is the durable checkpoint location.

Each run is bound to:

- the ordered legacy source data fingerprint;
- the effective backfill configuration and command implementation;
- `APP_VERSION` or `GIT_COMMIT_HASH` when supplied by the deployment.

The command refuses to resume if any of those values differ. Start a new run for a changed source snapshot.

## One-command production-backup validation from development

After the reviewed version containing this workflow is deployed, run this command from the development checkout:

```bash
make validate-prod-typed-tags-backup
```

It creates a fresh production backup, obtains the exact generated filename, transfers it over SSH, restricts the local file to the operator account, compares local and remote checksums without displaying them, and runs the isolated validator. The temporary local backup is deleted when the command exits. Set `PROD_HOST` and `PROD_DIR` as for other production targets when their defaults do not apply.

To retain the fetched file under the ignored `storage/production-backups/` directory, opt in explicitly:

```bash
make validate-prod-typed-tags-backup KEEP_BACKUP=1
```

The retained database dump is sensitive production data. The command applies mode `600`, but the operator remains responsible for encryption at rest and timely deletion.

If a backup has already been transferred through an approved secure channel, the lower-level local command remains available:

```bash
chmod 600 /absolute/path/eceee_v4_TIMESTAMP.sql.gz
make validate-typed-tags-backup BACKUP_FILE=/absolute/path/eceee_v4_TIMESTAMP.sql.gz
```

The validator restores into disposable PostgreSQL 15, applies the current migrations, runs the read-only source preflight, exercises interruption/resume, verifies every canonical relation, and removes its containers and image. Backup contents and restore errors are suppressed. Delete the local backup securely when it is no longer needed.

## Production deployment sequence

1. Deploy the reviewed commit normally. Deployment stops if its mandatory backup fails.
2. Run `make validate-prod-typed-tags-backup` from development and require a passing result.
3. Run the dedicated maintenance-window entry point:

   ```bash
   make prod-backfill-typed-tags RUN_ID=typed-tags-v1 CANARY_SIZE=100
   ```

The production script determines the running immutable application version, stops the backend and Celery writers, creates another mandatory backup, checks migration state, and runs a read-only legacy-source preflight. It then runs a bounded canary, resumes the same immutable run, verifies the result independently, restores services, and waits for application health. If any step fails, application services are restarted and the script exits unsuccessfully.

Deploys, database restores, and the typed-tag maintenance workflow share a nonblocking host lock. A conflicting operation fails before changing application service state.

Use a distinct run ID if legacy tags changed after the canary. Do not delete or modify legacy tags as part of this phase.

For an operator-only dry source check after deployment, without writing canonical data or checkpoints:

```bash
python manage.py backfill_typed_tags --preflight-only
```

## Interruption and resume

`SIGINT` and `SIGTERM` request a cooperative stop. The current source object is committed atomically before the run becomes `interrupted`. Re-running with the same run ID skips durably completed work units and retries failed units.

## Failure handling

The command records per-object errors and exits unsuccessfully when any unit remains failed, including failures encountered before a bounded canary stops. Correct the data or configuration problem, then resume the same run if its source fingerprint remains unchanged. Use `--verify-only` before declaring the backfill complete.

Production operators should use the repository targets above instead of assembling ad-hoc container or Django commands.
