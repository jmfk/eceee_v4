from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient


class LanguagePreferenceTests(TestCase):
    def test_authenticated_user_can_save_and_clear_language_override(self):
        user = User.objects.create_user("language-editor", password="test")
        client = APIClient()
        client.force_authenticate(user)
        url = "/api/v1/utils/current-user/"

        self.assertEqual(client.get(url).data["preferredLanguage"], "")
        self.assertEqual(client.patch(url, {"preferredLanguage": "sv-se"}).data["preferredLanguage"], "sv-se")
        self.assertEqual(client.get(url).data["preferredLanguage"], "sv-se")
        another_user = User.objects.create_user("another-language-editor", password="test")
        client.force_authenticate(another_user)
        self.assertEqual(client.get(url).data["preferredLanguage"], "")
        client.force_authenticate(user)
        self.assertEqual(client.patch(url, {"preferredLanguage": ""}).data["preferredLanguage"], "")

    def test_rejects_other_languages_and_requires_authentication(self):
        user = User.objects.create_user("language-editor", password="test")
        client = APIClient()
        url = "/api/v1/utils/current-user/"
        self.assertIn(client.patch(url, {"preferredLanguage": "sv-se"}).status_code, (401, 403))
        client.force_authenticate(user)
        self.assertEqual(client.patch(url, {"preferredLanguage": "fr-fr"}).status_code, 400)
        self.assertEqual(client.get(url).data["preferredLanguage"], "")
