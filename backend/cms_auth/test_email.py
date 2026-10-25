"""Production mail configuration tests with synthetic credentials and no network."""

import json
import os
import runpy
from pathlib import Path
from unittest.mock import patch

from decouple import Config, RepositoryEmpty
from django.core.mail import EmailMultiAlternatives, get_connection
from django.test import SimpleTestCase, override_settings
from requests import Response


def production_mail_settings(**environment):
    # Execute the real settings defaults without reading environment files or
    # inheriting a runner's console/locmem override or production credentials.
    env = {
        "DEBUG": "False",
        "POSTMARK_API_KEY": "synthetic-postmark-token",
        "DEFAULT_FROM_EMAIL": "sender@example.invalid",
        **environment,
    }
    with patch.dict(os.environ, env, clear=True), patch("decouple.config", Config(RepositoryEmpty())):
        return runpy.run_path(str(Path(__file__).resolve().parents[1] / "config/settings.py"))


def postmark_success():
    response = Response()
    response.status_code = 200
    response._content = json.dumps(
        {"ErrorCode": 0, "Message": "OK", "MessageID": "synthetic-message-id", "To": "editor@example.invalid"}
    ).encode()
    return response


class ProductionMailConfigurationTests(SimpleTestCase):
    def test_production_backend_sends_text_and_html_over_https(self):
        config = production_mail_settings()
        with (
            override_settings(ANYMAIL=config["ANYMAIL"]),
            patch("requests.sessions.Session.request", return_value=postmark_success()) as request,
        ):
            backend = get_connection(backend=config["EMAIL_BACKEND"])
            message = EmailMultiAlternatives(
                "Synthetic subject",
                "Synthetic text",
                config["DEFAULT_FROM_EMAIL"],
                ["editor@example.invalid"],
                connection=backend,
            )
            message.attach_alternative("<p>Synthetic HTML</p>", "text/html")
            self.assertEqual(message.send(), 1)
        request.assert_called_once()
        self.assertEqual(request.call_args.kwargs["method"], "POST")
        self.assertEqual(request.call_args.kwargs["url"], "https://api.postmarkapp.com/email")
        self.assertEqual(request.call_args.kwargs["headers"]["X-Postmark-Server-Token"], "synthetic-postmark-token")
        payload = json.loads(request.call_args.kwargs["data"])
        self.assertEqual(payload["TextBody"], "Synthetic text")
        self.assertEqual(payload["HtmlBody"], "<p>Synthetic HTML</p>")
        self.assertTrue(payload["TrackOpens"])
        self.assertFalse(backend.debug_api_requests)

    def test_test_mode_uses_non_delivery_token_and_preserves_tracking_preference(self):
        config = production_mail_settings(POSTMARK_TEST_MODE="True", POSTMARK_TRACK_OPENS="False")
        self.assertEqual(config["ANYMAIL"]["POSTMARK_SERVER_TOKEN"], "POSTMARK_API_TEST")
        self.assertFalse(config["ANYMAIL"]["SEND_DEFAULTS"]["track_opens"])

    def test_development_keeps_console_backend(self):
        config = production_mail_settings(DEBUG="True")
        self.assertEqual(config["EMAIL_BACKEND"], "django.core.mail.backends.console.EmailBackend")

    def test_explicit_backend_override_is_preserved(self):
        config = production_mail_settings(EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend")
        self.assertEqual(config["EMAIL_BACKEND"], "django.core.mail.backends.locmem.EmailBackend")
