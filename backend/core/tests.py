from django.test import TestCase, override_settings

from config.celery import app


@override_settings(APP_VERSION="build-123")
class ApplicationVersionTest(TestCase):
    def test_version_endpoint_and_header_match_deployed_build(self):
        response = self.client.get("/api/v1/app-version/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"version": "build-123"})
        self.assertEqual(response["X-App-Version"], "build-123")
        self.assertEqual(response["Cache-Control"], "no-store")


class CeleryScheduleTest(TestCase):
    def test_scheduled_publication_refresh_is_in_effective_beat_schedule(self):
        task = app.conf.beat_schedule["refresh-scheduled-publication-caches"]

        self.assertEqual(task["task"], "webpages.tasks.refresh_scheduled_publication_caches")
