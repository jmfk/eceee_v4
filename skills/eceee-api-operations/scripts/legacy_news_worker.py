"""Dev-only adapter; receives credentials privately through stdin, never through argv."""

import contextlib
import io
import json
import logging
import os
import sys


def run(payload):
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
    logging.disable(logging.CRITICAL)
    import django

    django.setup()
    from core.machine_api_keys import deployment_environment
    from content.models import Namespace
    from content_migration.legacy_news.repository import LegacyNewsRepository
    from content_migration.management.commands.migrate_legacy_news import Command

    if deployment_environment() != "development":
        return {"status": "denied", "reason": "development_environment_required"}, 1
    command_output = io.StringIO()
    command = Command(stdout=command_output, stderr=io.StringIO())
    tenant = command._tenant(payload["tenant"])
    namespace = command._namespace(tenant, payload.get("namespace"))
    user = command._user(tenant, "codex-local")
    if not tenant.user_has_access(user):
        return {"status": "denied", "reason": "tenant_access_required"}, 1
    if payload["mode"] == "check":
        definitions_ready = True
        sample_accepted = True
        try:
            LegacyNewsRepository(tenant=tenant, namespace=namespace, user=user)
        except Exception:
            definitions_ready = False
        try:
            command._require_sample_acceptance(tenant)
        except Exception:
            sample_accepted = False
        return {
            "status": "checked", "environment": "development", "tenant": tenant.identifier,
            "namespace": namespace.slug,
            "namespaces": list(Namespace.objects.filter(tenant=tenant, is_active=True).values_list("slug", flat=True)),
            "definitionsReady": definitions_ready, "goldenSampleAccepted": sample_accepted,
        }, 0
    argv = ["--api", "--tenant", tenant.identifier, "--namespace", namespace.slug,
            "--user", user.username, "--limit", str(payload["limit"]), "--newest-first", "--resume"]
    if payload["mode"] != "apply":
        argv.append("--dry-run")
    options = vars(command.create_parser("manage.py", "migrate_legacy_news").parse_args(argv))
    options["api_config"] = payload["api_config"]
    counts = command.handle(**options)
    summary = None
    reconciliation = None
    for line in command_output.getvalue().splitlines():
        if line.startswith("Legacy read-only summary: "):
            summary = json.loads(line.split(": ", 1)[1])
        if line.startswith("Legacy dry-run reconciliation: "):
            reconciliation = json.loads(line.split(": ", 1)[1])
    return {"status": "completed", "mode": payload["mode"], "tenant": tenant.identifier,
            "namespace": namespace.slug, "limit": payload["limit"], "newestFirst": True,
            "counts": counts, "sourceSummary": summary, "reconciliation": reconciliation}, 0


def main():
    # Importers and framework startup can log exception details. Keep all such output private.
    try:
        payload = json.load(sys.stdin)
        with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
            output, status = run(payload)
    except Exception as exc:
        output, status = {"status": "failed", "category": type(exc).__name__}, 1
    print(json.dumps(output))
    return status


if __name__ == "__main__":
    raise SystemExit(main())
