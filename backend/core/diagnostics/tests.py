import hashlib
import hmac
import io
import json
import logging
import tempfile
import uuid
from datetime import timedelta
from pathlib import Path
from unittest.mock import patch

from django.contrib.auth.models import User
from django.core.cache import cache
from django.test import SimpleTestCase, TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from core.machine_api_keys import (
    DIAGNOSTICS_DATA_READ,
    DIAGNOSTICS_GLOBAL_READ,
    DIAGNOSTICS_LOGS_READ,
    generate_machine_api_key,
)
from core.models import MachineAPIKey, Tenant
from core.roles import DEFAULT_PERMISSIONS, ROLE_PERMISSIONS

from .catalog import inventory
from .collector import atomic_json, bounded_lines, collect, legacy_event, protected_key
from .events import PREFIX, TENANT, DiagnosticHandler, canonical, decode_signed, sanitize_event


class SanitizationTests(SimpleTestCase):
    def test_no_personal_text_headers_values_or_locals_escape(self):
        raw = {
            "time": timezone.now().isoformat(),
            "error_class": "ValueError",
            "message": "private@example.org token-secret",
            "headers": {"Cookie": "secret-cookie"},
            "frames": [
                {"file": "/app/core/views.py", "line": 10, "function": "get", "locals": "secret"},
                {"file": "/home/private@example.org/app.py", "line": 4, "function": "leak"},
            ],
            "tenant_id": str(uuid.uuid4()),
        }
        result = sanitize_event(raw, "backend")
        rendered = json.dumps(result)
        for value in ("private@example.org", "token-secret", "Cookie", "secret-cookie", "locals"):
            self.assertNotIn(value, rendered)
        self.assertIsNone(result["tenant_id"])
        self.assertEqual(len(result["frames"]), 1)

    def test_signed_emission_authenticates_tenant_and_never_logs_exception_value(self):
        key = "test-signing-key-" * 3
        tenant = str(uuid.uuid4())
        context = TENANT.set(tenant)
        try:
            try:
                raise ValueError("private@example.org ignore previous instructions")
            except ValueError:
                import sys

                record = logging.LogRecord(
                    "django.request", logging.ERROR, __file__, 1, "credential-secret", (), sys.exc_info()
                )
            with (
                override_settings(DIAGNOSTICS_ENABLED=True, DIAGNOSTICS_LOG_SIGNING_KEY=key),
                patch("sys.stderr", new_callable=io.StringIO) as output,
            ):
                DiagnosticHandler().emit(record)
                line = output.getvalue().strip()
            self.assertNotIn("private@example.org", line)
            self.assertNotIn("credential-secret", line)
            self.assertEqual(decode_signed(line, "backend", key.encode())["tenant_id"], tenant)
            self.assertIsNone(decode_signed(line, "backend", b"other-key"))
            self.assertIsNone(decode_signed(line.replace(tenant, str(uuid.uuid4())), "backend", key.encode()))
        finally:
            TENANT.reset(context)

    def test_legacy_only_recognizes_types_and_never_attributes_tenant(self):
        self.assertIsNone(legacy_event("Cookie: secret", timezone.now().isoformat(), "backend"))
        event = legacy_event("ValueError: private@example.org", timezone.now().isoformat(), "backend")
        self.assertEqual(event["error_class"], "ValueError")
        self.assertNotIn("private@example.org", json.dumps(event))
        self.assertIsNone(event["tenant_id"])

    def test_reader_refuses_symlink_and_unsafe_secret_modes(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "signing.key"
            path.write_bytes(b"test-key-" * 8)
            path.chmod(0o600)
            self.assertTrue(protected_key(path))
            path.chmod(0o644)
            with self.assertRaises(ValueError):
                protected_key(path)
            link = path.with_name("link")
            link.symlink_to(path)
            with self.assertRaises(OSError):
                protected_key(link)

    def test_bounded_subprocess_stops_large_lines_and_failure(self):
        import sys
        import time

        budget = [1024]
        with self.assertRaises(TimeoutError):
            list(bounded_lines([sys.executable, "-c", "print('x'*4096)"], time.monotonic() + 2, budget))
        self.assertEqual(budget[0], 0)
        with self.assertRaises(RuntimeError):
            list(bounded_lines([sys.executable, "-c", "raise SystemExit(4)"], time.monotonic() + 2, [1024]))

    def test_exhausted_input_is_incomplete_even_if_the_producer_has_exited_successfully(self):
        import time
        from unittest.mock import MagicMock

        process = MagicMock()
        process.__enter__.return_value = process
        process.__exit__.return_value = False
        process.poll.return_value = 0
        selector = MagicMock()
        selector.select.return_value = [(None, None)]
        with (
            patch("core.diagnostics.collector.subprocess.Popen", return_value=process),
            patch("core.diagnostics.collector.selectors.DefaultSelector", return_value=selector),
            patch("core.diagnostics.collector.os.read", side_effect=[b"one\n", b"two\n", b""]),
            self.assertRaises(TimeoutError),
        ):
            list(bounded_lines(["fixture"], time.monotonic() + 2, [4]))

    def test_normal_discovery_never_requires_the_optional_diagnostic_database(self):
        from django.conf import settings
        from django.test.runner import DiscoverRunner

        if settings.SETTINGS_MODULE == "core.diagnostics.postgres_test_settings":
            self.skipTest("Dedicated diagnostic database explicitly enabled")
        runner = DiscoverRunner(verbosity=0)
        suite = runner.build_suite(["core.diagnostics.test_postgres"])
        self.assertNotIn("diagnostics", runner.get_databases(suite))

    def test_interrupted_publish_replays_without_duplicate_persisted_events(self):
        when = timezone.now().isoformat()

        def output(command, deadline, budget):
            return iter(["a" * 64] if "ps" in command else [when + " ValueError: withheld"])

        def interrupt(path, value):
            if path.name == ".positions.json":
                raise OSError("simulated interruption")
            return atomic_json(path, value)

        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            with patch("core.diagnostics.collector.bounded_lines", side_effect=output):
                with patch("core.diagnostics.collector.atomic_json", side_effect=interrupt), self.assertRaises(OSError):
                    collect(root, root, b"test-key-" * 8)
                collect(root, root, b"test-key-" * 8)
            rows = [
                event for segment in (root / "segments").glob("*.json") for event in json.loads(segment.read_text())
            ]
            self.assertEqual(len(rows), 10)
            self.assertEqual(len({row["id"] for row in rows}), 10)

    def test_collector_marks_failures_and_preserves_checkpoint(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            with patch("core.diagnostics.collector.bounded_lines", side_effect=RuntimeError()):
                result = collect(root, root, b"test-key-" * 8)
            self.assertEqual(result["status"], "incomplete")
            manifest = json.loads((root / "latest.json").read_text())
            self.assertTrue(manifest["incomplete"])
            self.assertEqual(json.loads((root / ".positions.json").read_text()), {})

    def test_collection_deduplicates_overlap_and_reports_container_changes(self):
        now = timezone.now().isoformat()
        event = {
            "time": now,
            "error_class": "IntegrityError",
            "tenant_id": str(uuid.uuid4()),
            "event_id": str(uuid.uuid4()),
        }
        key = b"test-signing-key-" * 4
        envelope = {"event": event, "signature": hmac.new(key, canonical(event), hashlib.sha256).hexdigest()}
        line = now + " " + PREFIX + json.dumps(envelope)

        def output(command, deadline, budget):
            return iter(["a" * 64] if "ps" in command else [line])

        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            with patch("core.diagnostics.collector.bounded_lines", side_effect=output):
                first = collect(root, root, key)
                second = collect(root, root, key)
            # The same event in each source has a distinct service identity, but overlap adds none.
            self.assertEqual(first["events"], 10)
            self.assertEqual(second["events"], 0)
            current = json.loads((root / "latest.json").read_text())
            self.assertTrue(current["incomplete"])  # Initial source coverage is explicitly uncertain.
            for segment in (root / "segments").glob("*.json"):
                self.assertLessEqual(segment.stat().st_size, 512 * 1024)

    def test_registered_files_resume_and_report_rotation_without_exposing_raw_values(self):
        key = b"test-key-" * 8
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / "export"
            source = Path(directory) / "worker.log"
            source.write_text(timezone.now().isoformat() + " ValueError: private@example.org\n")
            config = [{"id": "worker-file", "service": "backend", "path": str(source)}]
            with patch("core.diagnostics.collector.bounded_lines", side_effect=RuntimeError()):
                first = collect(root, Path(directory), key, config)
                second = collect(root, Path(directory), key, config)
                self.assertEqual(first["events"], 1)
                self.assertEqual(second["events"], 0)
                source.rename(source.with_suffix(".old"))
                source.write_text(timezone.now().isoformat() + " TypeError: secret-cookie\n")
                collect(root, Path(directory), key, config)
            manifest = json.loads((root / "latest.json").read_text())
            self.assertTrue(manifest["sources"]["file:worker-file"]["rotation_gap_possible"])
            for segment in (root / "segments").glob("*.json"):
                self.assertNotIn("private@example.org", segment.read_text())
                self.assertNotIn("secret-cookie", segment.read_text())

    def test_catalog_defaults_every_unreviewed_field_to_excluded(self):
        catalog = {item["table"]: item for item in inventory(include_global=True)}
        user = {item["name"]: item["classification"] for item in catalog["auth_user"]["columns"]}
        self.assertEqual(user["password"], "excluded")
        self.assertEqual(user["email"], "masked")
        self.assertEqual(user["is_superuser"], "excluded")
        self.assertFalse(catalog["core_machineapikey"]["queryable"])
        self.assertFalse(any(p.startswith("diagnostics.") for p in DEFAULT_PERMISSIONS | set(ROLE_PERMISSIONS)))


@override_settings(
    ROOT_URLCONF="core.diagnostics.test_urls",
    DIAGNOSTICS_ENABLED=True,
    DEPLOYMENT_ENVIRONMENT="development",
    MIDDLEWARE=[
        "django.contrib.sessions.middleware.SessionMiddleware",
        "django.contrib.auth.middleware.AuthenticationMiddleware",
        "core.middleware.TenantContextMiddleware",
    ],
    CACHES={"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}},
    ALLOWED_HOSTS=["testserver"],
)
class DiagnosticAPITests(TestCase):
    def setUp(self):
        cache.clear()
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        self.override = override_settings(DIAGNOSTICS_EXPORT_ROOT=str(self.root))
        self.override.enable()
        self.addCleanup(self.override.disable)
        self.user = User.objects.create_user(username="diagnostic-test", password=None)
        self.tenant = Tenant.objects.create(name="One", identifier="one", created_by=self.user)
        self.other = Tenant.objects.create(name="Two", identifier="two", created_by=self.user)
        self.outside = Tenant.objects.create(name="Outside", identifier="outside", created_by=self.user)
        secret, digest, prefix = generate_machine_api_key()
        self.key = MachineAPIKey.objects.create(
            name="test",
            principal=self.user,
            created_by=self.user,
            key_hash=digest,
            key_prefix=prefix,
            environment="development",
            scopes=[DIAGNOSTICS_LOGS_READ, DIAGNOSTICS_DATA_READ],
        )
        self.key.tenants.set([self.tenant, self.other])
        self.client = APIClient()
        self.client.credentials(HTTP_AUTHORIZATION="ApiKey " + secret)
        self.now = timezone.now()
        self.generation = self.now.strftime("%Y%m%dT%H%M%S%f") + "-" + uuid.uuid4().hex
        self.segment = self.generation + ".json"
        (self.root / "segments").mkdir()
        (self.root / "generations").mkdir()
        events = []
        for tenant in (self.tenant.pk, self.other.pk, self.outside.pk, None):
            events.append(
                sanitize_event(
                    {
                        "time": (self.now - timedelta(minutes=1)).isoformat(),
                        "tenant_id": str(tenant) if tenant else None,
                        "error_class": "ValueError",
                        "message": "raw-secret",
                        "event_id": str(uuid.uuid4()),
                    },
                    "backend",
                    trusted=True,
                )
            )
        atomic_json(self.root / "segments" / self.segment, events)
        manifest = {
            "generation": self.generation,
            "created_at": self.now.isoformat(),
            "segments": [self.segment],
            "sources": {},
            "incomplete": False,
        }
        atomic_json(self.root / "latest.json", manifest)
        atomic_json(self.root / "generations" / self.segment, manifest)

    def search(self, **kwargs):
        return self.client.post("/api/v1/diagnostics/logs/search/", {"tenants": "all_allowed", **kwargs}, format="json")

    def test_multi_tenant_reads_without_header_do_not_leak_other_or_global_records(self):
        response = self.search()
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(
            {row["tenant_id"] for row in response.data["results"]}, {str(self.tenant.pk), str(self.other.pk)}
        )
        self.assertNotIn("raw-secret", json.dumps(response.data))
        self.assertEqual(response["Cache-Control"], "no-store")
        self.assertEqual(self.search(tenants=[str(self.tenant.pk), str(self.outside.pk)]).status_code, 403)
        self.assertEqual(self.search(include_global=True).status_code, 403)

    def test_global_requires_explicit_extra_scope_and_details_check_visibility(self):
        self.key.scopes.append(DIAGNOSTICS_GLOBAL_READ)
        self.key.save()
        response = self.search(include_global=True)
        self.assertEqual(len(response.data["results"]), 3)
        global_event = next(row for row in response.data["results"] if row["tenant_id"] is None)
        url = "/api/v1/diagnostics/logs/events/" + global_event["id"] + "/"
        self.assertEqual(self.client.get(url, {"tenants": str(self.tenant.pk)}).status_code, 404)
        self.assertEqual(
            self.client.get(url, {"tenants": str(self.tenant.pk), "include_global": "true"}).status_code, 200
        )
        self.key.scopes.remove(DIAGNOSTICS_GLOBAL_READ)
        self.key.save()
        self.assertEqual(
            self.client.get(url, {"tenants": str(self.tenant.pk), "include_global": "true"}).status_code, 403
        )

    def test_scopes_expiry_revocation_wrong_environment_and_human_auth(self):
        for scopes in (["server.full_access"], ["content.read"], [DIAGNOSTICS_GLOBAL_READ], [DIAGNOSTICS_DATA_READ]):
            self.key.scopes = scopes
            self.key.save()
            self.assertEqual(self.search().status_code, 403)
        self.key.scopes = [DIAGNOSTICS_LOGS_READ]
        for field, value in (
            ("expires_at", self.now - timedelta(seconds=1)),
            ("is_active", False),
            ("environment", "production"),
        ):
            old = getattr(self.key, field)
            setattr(self.key, field, value)
            self.key.save()
            self.assertEqual(self.search().status_code, 401)
            setattr(self.key, field, old)
        self.key.save()
        self.client.force_authenticate(user=self.user)
        self.assertEqual(self.search().status_code, 403)

    def test_cursor_binds_key_query_tenants_and_generation_and_expires(self):
        response = self.search(limit=1)
        cursor = response.data["next_cursor"]
        self.assertTrue(cursor)
        continued = self.search(limit=1, cursor=cursor)
        self.assertEqual(continued.status_code, 200, continued.data)
        self.assertNotEqual(response.data["results"][0]["id"], continued.data["results"][0]["id"])
        self.assertEqual(self.search(limit=1, text="different", cursor=cursor).status_code, 410)
        self.key.tenants.set([self.tenant])
        self.assertEqual(self.search(limit=1, cursor=cursor).status_code, 410)
        self.key.tenants.set([self.tenant, self.other])
        (self.root / "generations" / self.segment).unlink()
        self.assertEqual(self.search(limit=1, cursor=cursor).status_code, 410)

    def test_cursor_cannot_be_reused_by_another_key_and_rejects_expiry(self):
        response = self.search(limit=1)
        cursor = response.data["next_cursor"]
        secret, digest, prefix = generate_machine_api_key()
        other_key = MachineAPIKey.objects.create(
            name="other-key",
            principal=self.user,
            created_by=self.user,
            key_hash=digest,
            key_prefix=prefix,
            environment="development",
            scopes=[DIAGNOSTICS_LOGS_READ],
        )
        other_key.tenants.set([self.tenant, self.other])
        self.client.credentials(HTTP_AUTHORIZATION="ApiKey " + secret)
        self.assertEqual(self.search(limit=1, cursor=cursor).status_code, 410)
        own_cursor = self.search(limit=1).data["next_cursor"]
        with patch("django.core.signing.time.time", return_value=timezone.now().timestamp() + 7200):
            self.assertEqual(self.search(limit=1, cursor=own_cursor).status_code, 410)

    def test_response_size_limit_and_stale_source_metadata(self):
        with patch("core.diagnostics.views.search_logs", return_value={"results": [{"message": "x" * (1024 * 1024)}]}):
            self.assertEqual(self.search().status_code, 422)
        response = self.client.get("/api/v1/diagnostics/sources/")
        self.assertNotIn("stale", response.data)
        self.key.scopes.append(DIAGNOSTICS_GLOBAL_READ)
        self.key.save()
        response = self.client.get("/api/v1/diagnostics/sources/")
        self.assertFalse(response.data["stale"])

    def test_source_gap_history_stays_within_the_response_budget(self):
        self.key.scopes.append(DIAGNOSTICS_GLOBAL_READ)
        self.key.save()
        path = self.root / "latest.json"
        current = json.loads(path.read_text())
        current["gaps"] = [
            {"time": self.now.isoformat(), "source": "celery-worker", "reason": "source_changed_or_incomplete"}
        ] * 10000
        atomic_json(path, current)
        response = self.client.get("/api/v1/diagnostics/sources/")
        self.assertEqual(response.status_code, 200)
        self.assertLessEqual(len(response.data["gaps"]), 100)
        self.assertEqual(response.data["gap_count"], 10000)
        self.assertTrue(response.data["gaps_limited"])

    def test_validation_disabled_state_rate_and_database_fail_closed(self):
        self.assertEqual(self.search(limit=201).status_code, 400)
        self.assertEqual(self.search(start=(self.now - timedelta(days=2)).isoformat()).status_code, 400)
        self.assertEqual(self.search(shell="grep anything").status_code, 400)
        self.assertEqual(
            self.client.post(
                "/api/v1/diagnostics/logs/search/", "x" * 16385, content_type="application/json"
            ).status_code,
            400,
        )
        with override_settings(DIAGNOSTICS_ENABLED=False):
            self.assertEqual(self.search().status_code, 503)
        response = self.client.post(
            "/api/v1/diagnostics/data/query/",
            {"tenants": "all_allowed", "table": "auth_user", "columns": ["password"]},
            format="json",
        )
        self.assertEqual(response.status_code, 403)  # Global dataset requires global scope first.
        response = self.client.post(
            "/api/v1/diagnostics/data/query/", {"tenants": "all_allowed", "table": "core_tenant"}, format="json"
        )
        self.assertEqual(response.status_code, 503)
        cache.clear()
        for _ in range(30):
            self.assertEqual(self.client.get("/api/v1/diagnostics/sources/").status_code, 200)
        self.assertEqual(self.client.get("/api/v1/diagnostics/sources/").status_code, 429)

    def test_provisioning_installs_separate_credential_without_printing_and_requires_explicit_rotation(self):
        from django.core.management import call_command
        from django.core.management.base import CommandError

        destination = self.root / ".env.local"
        output = io.StringIO()
        arguments = {"tenant": [str(self.tenant.pk)], "logs": True, "env_file": destination, "stdout": output}
        call_command("provision_diagnostics_access", **arguments)
        self.assertEqual(destination.stat().st_mode & 0o777, 0o600)
        self.assertNotIn("mapi_", output.getvalue())
        first = destination.read_text()
        key = MachineAPIKey.objects.get(name="Dedicated diagnostic access")
        self.assertEqual(key.scopes, [DIAGNOSTICS_LOGS_READ])
        self.assertFalse(key.principal.is_staff)
        self.assertFalse(key.principal.has_usable_password())
        with self.assertRaises(CommandError):
            call_command("provision_diagnostics_access", **arguments)
        self.assertTrue(destination.read_text() == first)
        call_command("provision_diagnostics_access", rotate=True, **arguments)
        self.assertTrue(destination.read_text() != first)

    def test_unsigned_tenant_header_does_not_authenticate_log_attribution_and_context_resets(self):
        client = APIClient()
        response = client.get("/test-diagnostic-context/", HTTP_X_TENANT_ID=str(self.tenant.pk))
        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.json()["tenant"])
        client.force_login(self.user)
        response = client.get("/test-diagnostic-context/", HTTP_X_TENANT_ID=str(self.tenant.pk))
        self.assertEqual(response.json()["tenant"], str(self.tenant.pk))
        self.assertEqual(response["X-Request-ID"], response.json()["request_id"])
        self.assertIsNone(TENANT.get())
        with self.assertRaises(ValueError):
            client.get("/test-diagnostic-context/?fail=1", HTTP_X_TENANT_ID=str(self.tenant.pk))
        self.assertIsNone(TENANT.get())

    def test_audit_does_not_include_search_values(self):
        with patch("core.diagnostics.views.logger.info") as audit:
            self.search(text="private@example.org")
        entry = audit.call_args.kwargs["extra"]["diagnostic_audit"]
        self.assertEqual(entry["key_id"], str(self.key.pk))
        self.assertNotIn("private@example.org", json.dumps(entry))
