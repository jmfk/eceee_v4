import json

from django.test import SimpleTestCase

from .diagnostics import redact


class DiagnosticRedactionTests(SimpleTestCase):
    def test_quoted_json_credentials_and_truncated_values_are_redacted(self):
        values = [
            "Authorization: Bearer private-credential",
            '{"password":"private text' + "\\",
            '{"password":"private value", "accessToken":"private token"}',
            "{'refresh_token': 'private value', 'AWS_SECRET_ACCESS_KEY': 'private key'}",
            json.dumps({"password": 'private "quoted" value'}),
            '{"password":"' + "private " * 300,
        ]
        for value in values:
            with self.subTest(value=value[:50]):
                self.assertNotIn("private", redact(value))
