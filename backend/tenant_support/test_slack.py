import ast
import json
import logging
import threading
from datetime import timedelta
from pathlib import Path
from unittest.mock import Mock, patch
from urllib.error import HTTPError

from django.db import connections, transaction
from django.db.migrations.executor import MigrationExecutor
from django.test import TestCase, TransactionTestCase, override_settings, skipUnlessDBFeature
from django.utils import timezone

from . import slack
from . import tests as support_tests
from .models import SlackDelivery, SupportThread

REPORT_HOOK = "https://hooks.slack.com/services/TEST/REPORTS/fixture"
SERVER_HOOK = "https://hooks.slack.com/services/TEST/SERVER/fixture"


@override_settings(
    SLACK_REPORTS_ENABLED=True,
    SLACK_SERVER_ERRORS_ENABLED=True,
    SLACK_REPORTS_WEBHOOK_URL=REPORT_HOOK,
    SLACK_SERVER_WEBHOOK_URL=SERVER_HOOK,
    SLACK_ENVIRONMENT="staging",
    APP_VERSION="release-test",
    SUPPORT_APP_URL="https://cms.example.invalid",
)
class SlackTests(TestCase):
    setUp = support_tests.SupportAPITests.setUp
    call = support_tests.SupportAPITests.call
    create_thread = support_tests.SupportAPITests.create_thread

    def report(self):
        response, _ = self.create_thread()
        self.assertEqual(response.status_code, 201, response.data)
        return SlackDelivery.objects.get()

    def test_only_new_support_bugs_are_queued_and_retry_is_idempotent(self):
        response, data = self.create_thread(title="PRIVATE TITLE", body="PRIVATE BODY")
        self.assertEqual(response.status_code, 201)
        self.assertEqual(self.call(support_tests.views.ThreadsView, "post", data).status_code, 200)
        self.create_thread(kind="question")
        self.create_thread(recipients=[f"user:{self.bob.pk}"])
        self.assertEqual(SlackDelivery.objects.count(), 1)
        message = json.dumps(slack.payload(SlackDelivery.objects.select_related("thread__tenant").get()))
        for private in ("PRIVATE TITLE", "PRIVATE BODY", "pages/42", self.anna.email):
            self.assertNotIn(private, message)
        self.assertIn("/inbox/threads/", message)
        self.assertIn("tenant=a", message)

    def test_queue_is_in_the_same_transaction_and_disabled_reports_do_not_backfill(self):
        with override_settings(SLACK_REPORTS_ENABLED=False):
            self.create_thread()
        self.assertFalse(SlackDelivery.objects.exists())
        thread = SupportThread.objects.get()
        with self.assertRaises(RuntimeError):
            with transaction.atomic():
                slack.queue_report(thread)
                raise RuntimeError("rollback")
        self.assertFalse(SlackDelivery.objects.exists())

    def test_server_groups_ignore_request_ids_but_separate_tenants_and_services(self):
        event = {"service": "backend", "error_class": "TypeError", "tenant_id": str(self.tenant.pk)}
        slack.queue_server_error({**event, "request_id": str(self.tenant.pk), "message": "PRIVATE"})
        slack.queue_server_error({**event, "request_id": str(self.other.pk)})
        slack.queue_server_error({**event, "tenant_id": str(self.other.pk)})
        slack.queue_server_error({**event, "service": "celery-worker"})
        self.assertEqual(SlackDelivery.objects.count(), 3)
        self.assertNotIn("PRIVATE", json.dumps(list(SlackDelivery.objects.values("metadata"))))

    def test_server_notice_keeps_the_release_at_capture_time(self):
        slack.queue_server_error({"service": "backend", "error_class": "TypeError", "release": "old-release"})
        delivery = SlackDelivery.objects.get()
        with override_settings(APP_VERSION="new-release"):
            text = json.dumps(slack.payload(delivery))
        self.assertIn("old-release", text)
        self.assertNotIn("new-release", text)

    def test_celery_logger_hook_is_opt_in_and_idempotent(self):
        with override_settings(CELERY_BEAT_SCHEDULE={}):
            from config.celery import attach_slack_error_handler

        logger = logging.Logger("slack-test-worker")
        with override_settings(SLACK_SERVER_ERRORS_ENABLED=False):
            attach_slack_error_handler(logger)
        self.assertEqual(logger.handlers, [])
        attach_slack_error_handler(logger)
        attach_slack_error_handler(logger)
        self.assertEqual(len(logger.handlers), 1)
        self.assertIsInstance(logger.handlers[0], slack.SlackErrorHandler)
        self.assertEqual(logger.handlers[0].level, logging.ERROR)

    def test_settings_attach_one_handler_when_logger_lists_are_shared(self):
        # Execute only the actual LOGGING declaration/Slack block, without loading .env or full settings.
        source = (Path(__file__).resolve().parents[1] / "config/settings.py").read_text()
        tree = ast.parse(source)
        selected = [
            node
            for node in tree.body
            if isinstance(node, ast.Assign)
            and any(isinstance(target, ast.Name) and target.id == "LOGGING" for target in node.targets)
            or isinstance(node, ast.If)
            and isinstance(node.test, ast.Name)
            and node.test.id == "SLACK_SERVER_ERRORS_ENABLED"
        ]
        namespace = {
            "DEBUG": False,
            "_default_handlers": ["console"],
            "_log_handlers": {},
            "SLACK_SERVER_ERRORS_ENABLED": True,
        }
        exec(compile(ast.Module(body=selected, type_ignores=[]), "logging-settings-test", "exec"), namespace)
        config = namespace["LOGGING"]
        for logger in [config["root"], *config["loggers"].values()]:
            self.assertEqual(logger["handlers"].count("slack_errors"), 1)

    def test_logger_does_not_format_or_read_messages_and_survives_broker_failure(self):
        record = logging.LogRecord(
            "django.request", logging.ERROR, "/app/core/views.py", 4, "PRIVATE %s", ("SECRET",), None
        )
        record.getMessage = Mock(side_effect=AssertionError("must not format"))
        with patch("tenant_support.tasks.enqueue_slack_server_error.apply_async") as enqueue:
            slack.SlackErrorHandler().emit(record)
            metadata = enqueue.call_args.kwargs["args"][0]
            self.assertNotIn("PRIVATE", json.dumps(metadata))
            self.assertNotIn("SECRET", json.dumps(metadata))
            self.assertEqual(metadata["frames"][0]["file"], "core/views.py")
            enqueue.side_effect = RuntimeError("broker unavailable")
            slack.SlackErrorHandler().emit(record)
        record.getMessage.assert_not_called()

    def test_repeated_log_bursts_are_suppressed_before_reaching_the_broker(self):
        handler = slack.SlackErrorHandler()
        record = logging.LogRecord("django.request", logging.ERROR, "/app/core/views.py", 4, "PRIVATE", (), None)
        with patch("tenant_support.tasks.enqueue_slack_server_error.apply_async") as enqueue:
            with patch("tenant_support.slack.time.monotonic", return_value=1000):
                for _ in range(100):
                    handler.handle(record)
            enqueue.assert_called_once()
            with patch("tenant_support.slack.time.monotonic", return_value=1601):
                handler.handle(record)
            self.assertEqual(enqueue.call_count, 2)

    def test_broker_outage_does_not_repeat_connection_attempts_for_every_log(self):
        handler = slack.SlackErrorHandler()
        record = logging.LogRecord("django.request", logging.ERROR, "/app/core/views.py", 4, "PRIVATE", (), None)
        with patch("tenant_support.tasks.enqueue_slack_server_error.apply_async", side_effect=OSError()) as enqueue:
            with patch("tenant_support.slack.time.monotonic", return_value=1000):
                for _ in range(100):
                    handler.handle(record)
            enqueue.assert_called_once()
            with patch("tenant_support.slack.time.monotonic", return_value=1031):
                handler.handle(record)
            self.assertEqual(enqueue.call_count, 2)

    @patch("tenant_support.slack.post_webhook", return_value=("sent", "", 0))
    def test_claimed_report_is_sent_once_to_report_destination(self, send):
        delivery = self.report()
        slack.deliver_one(delivery.pk)
        slack.deliver_one(delivery.pk)
        send.assert_called_once()
        self.assertEqual(send.call_args.args[0], REPORT_HOOK)
        delivery.refresh_from_db()
        self.assertEqual(delivery.state, "sent")
        self.assertEqual(delivery.attempts, 1)

    @patch("tenant_support.slack.post_webhook", return_value=("sent", "", 0))
    def test_server_destination_and_delivery_sanitization(self, send):
        slack.queue_server_error({"service": "backend", "error_class": "TypeError", "message": "PRIVATE"})
        delivery = SlackDelivery.objects.get()
        delivery.metadata["message"] = "INJECTED PRIVATE"
        delivery.save()
        slack.deliver_one(delivery.pk)
        self.assertEqual(send.call_args.args[0], SERVER_HOOK)
        self.assertNotIn("PRIVATE", json.dumps(send.call_args.args[1]))

    @patch("tenant_support.slack.post_webhook")
    def test_same_destinations_and_non_slack_urls_fail_closed(self, send):
        delivery = self.report()
        for value in (SERVER_HOOK, "https://example.invalid/services/a/b/c", REPORT_HOOK + "?token=private"):
            with override_settings(SLACK_REPORTS_WEBHOOK_URL=value):
                slack.deliver_one(delivery.pk)
        send.assert_not_called()
        delivery.refresh_from_db()
        self.assertEqual(delivery.state, "pending")
        self.assertEqual(delivery.attempts, 0)

    @patch("tenant_support.slack.post_webhook")
    def test_ineligible_report_and_disabled_delivery_do_not_send(self, send):
        delivery = self.report()
        with override_settings(SLACK_REPORTS_ENABLED=False):
            slack.deliver_one(delivery.pk)
        SupportThread.objects.update(support_target=False)
        slack.deliver_one(delivery.pk)
        delivery.refresh_from_db()
        self.assertEqual(delivery.state, "skipped")
        send.assert_not_called()

    @patch("tenant_support.slack.post_webhook", return_value=("uncertain", "provider_outcome_unknown", 0))
    def test_unknown_provider_outcomes_are_not_resent(self, send):
        delivery = self.report()
        slack.deliver_one(delivery.pk)
        slack.deliver_pending()
        self.assertEqual(send.call_count, 1)
        delivery.refresh_from_db()
        self.assertEqual(delivery.state, "uncertain")

    @patch("tenant_support.slack.post_webhook", return_value=("pending", "rate_limited", 120))
    def test_rate_limit_is_delayed_and_interrupted_claim_is_uncertain(self, send):
        delivery = self.report()
        before = timezone.now()
        slack.deliver_one(delivery.pk)
        delivery.refresh_from_db()
        self.assertEqual(delivery.state, "pending")
        self.assertGreaterEqual(delivery.next_attempt_at, before + timedelta(seconds=120))
        SlackDelivery.objects.filter(pk=delivery.pk).update(
            state="sending", next_attempt_at=before - timedelta(minutes=11)
        )
        slack.deliver_pending()
        delivery.refresh_from_db()
        self.assertEqual(delivery.state, "uncertain")
        self.assertEqual(send.call_count, 1)

    @patch("tenant_support.slack.post_webhook", return_value=("pending", "rate_limited", 60))
    def test_rate_limit_retries_are_bounded(self, send):
        delivery = self.report()
        SlackDelivery.objects.filter(pk=delivery.pk).update(attempts=4)
        slack.deliver_one(delivery.pk)
        delivery.refresh_from_db()
        self.assertEqual(delivery.state, "failed")
        self.assertEqual(delivery.error_code, "rate_limit_exhausted")

    @patch("tenant_support.slack.build_opener")
    def test_transport_refuses_redirects_and_bounds_retry_after(self, opener):
        opener.return_value.open.side_effect = HTTPError(REPORT_HOOK, 302, "PRIVATE", {}, None)
        self.assertEqual(slack.post_webhook(REPORT_HOOK, {"text": "test"})[:2], ("failed", "webhook_rejected"))
        opener.return_value.open.side_effect = HTTPError(REPORT_HOOK, 429, "PRIVATE", {"Retry-After": "999999"}, None)
        self.assertEqual(slack.post_webhook(REPORT_HOOK, {"text": "test"}), ("pending", "rate_limited", 3600))
        opener.return_value.open.side_effect = TimeoutError("PRIVATE")
        self.assertEqual(slack.post_webhook(REPORT_HOOK, {"text": "test"})[0], "uncertain")


@override_settings(
    SLACK_REPORTS_ENABLED=True,
    SLACK_SERVER_ERRORS_ENABLED=True,
    SLACK_REPORTS_WEBHOOK_URL=REPORT_HOOK,
    SLACK_SERVER_WEBHOOK_URL=SERVER_HOOK,
    APP_VERSION="sql-test",
    SUPPORT_APP_URL="https://cms.example.invalid",
)
@skipUnlessDBFeature("has_select_for_update")
class SlackPostgresTests(TransactionTestCase):
    def test_competing_workers_claim_once_before_external_io(self):
        slack.queue_server_error({"service": "backend", "error_class": "TypeError"})
        delivery = SlackDelivery.objects.get()
        entered, release = threading.Event(), threading.Event()
        failures = []

        def send(*args):
            entered.set()
            if not release.wait(10):
                raise RuntimeError("test transport timed out")
            return "sent", "", 0

        def run():
            try:
                slack.deliver_one(delivery.pk)
            except Exception as error:
                failures.append(type(error).__name__)
            finally:
                connections["default"].close()

        first, second = threading.Thread(target=run, daemon=True), threading.Thread(target=run, daemon=True)
        with patch("tenant_support.slack.post_webhook", side_effect=send) as transport:
            try:
                first.start()
                self.assertTrue(entered.wait(10))
                self.assertEqual(SlackDelivery.objects.get(pk=delivery.pk).state, "sending")
                second.start()
                second.join(10)
                self.assertFalse(second.is_alive())
            finally:
                release.set()
                first.join(10)
            self.assertEqual(failures, [])
            transport.assert_called_once()
        delivery.refresh_from_db()
        self.assertEqual(delivery.state, "sent")

    def test_concurrent_server_events_create_one_group(self):
        barrier, failures = threading.Barrier(3), []

        def run():
            try:
                barrier.wait(10)
                slack.queue_server_error({"service": "backend", "error_class": "TypeError"})
            except Exception as error:
                failures.append(type(error).__name__)
            finally:
                connections["default"].close()

        workers = [threading.Thread(target=run, daemon=True) for _ in range(3)]
        with patch("tenant_support.slack.timezone.now", return_value=timezone.now()):
            for worker in workers:
                worker.start()
            for worker in workers:
                worker.join(10)
            self.assertFalse(any(worker.is_alive() for worker in workers))
        self.assertEqual(failures, [])
        self.assertEqual(SlackDelivery.objects.count(), 1)

    def test_upgrade_preserves_existing_report_and_reapplication_is_noop(self):
        import uuid

        connection = connections["default"]
        old_target, new_target = [("tenant_support", "0005_message_labels")], [("tenant_support", "0006_slackdelivery")]
        try:
            executor = MigrationExecutor(connection)
            executor.migrate(old_target)
            old_apps = executor.loader.project_state(old_target).apps
            user = old_apps.get_model("auth", "User").objects.create(username="slack-upgrade-fixture")
            tenant = old_apps.get_model("core", "Tenant").objects.create(
                name="Upgrade fixture", identifier="slack-upgrade", created_by_id=user.pk
            )
            thread = old_apps.get_model("tenant_support", "SupportThread").objects.create(
                tenant_id=tenant.pk, creator_id=user.pk, kind="bug", title="Preserved report", request_id=uuid.uuid4()
            )
            MigrationExecutor(connection).migrate(new_target)
            current = SupportThread.objects.get(pk=thread.pk)
            self.assertEqual(current.title, "Preserved report")
            slack.queue_report(current)
            self.assertEqual(SlackDelivery.objects.count(), 1)
            MigrationExecutor(connection).migrate(new_target)
            self.assertEqual(SlackDelivery.objects.get().thread_id, thread.pk)
        finally:
            MigrationExecutor(connection).migrate(new_target)
