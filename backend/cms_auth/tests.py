import json
import time
from unittest.mock import patch

from allauth.account.models import EmailAddress
from allauth.mfa.models import Authenticator
from allauth.mfa.totp.internal.auth import format_hotp_value, hotp_value
from allauth.socialaccount.models import SocialAccount, SocialLogin
from cryptography.fernet import Fernet
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import Client, TestCase, TransactionTestCase, override_settings
from rest_framework.authtoken.models import Token

from . import test_settings as isolated_settings
from .adapters import MFAAdapter, SocialAccountAdapter
from .models import AccountSecurity
from .security import SESSION_MFA, SESSION_VERSION, revoke_credentials, security_version

# Also isolate URLs, mail, cache and synthetic keys when Django's normal project
# discovery runs this module. Keep the runner's database and installed apps.
AUTH_TEST_SETTINGS = {
    name: value
    for name, value in vars(isolated_settings).items()
    if name.isupper() and name not in {"DATABASES", "INSTALLED_APPS"}
}
BASE = "/_allauth/browser/v1"


def current_code(secret):
    return format_hotp_value(hotp_value(secret, int(time.time()) // 30))


@override_settings(**AUTH_TEST_SETTINGS)
class BrowserAuthenticationTests(TestCase):
    def setUp(self):
        cache.clear()
        self.user = get_user_model().objects.create_user("editor", "editor@example.invalid", "password-123")
        EmailAddress.objects.create(user=self.user, email=self.user.email, primary=True, verified=True)
        self.initial_user_ids = set(get_user_model().objects.values_list("pk", flat=True))
        self.client = Client(enforce_csrf_checks=True)

    def write(self, path, data=None, method="post", client=None):
        client = client or self.client
        csrf = client.get("/csrf-token/").json()["csrfToken"]
        return getattr(client, method)(
            path, data=json.dumps(data or {}), content_type="application/json", HTTP_X_CSRFTOKEN=csrf
        )

    def login(self, client=None):
        return self.write(BASE + "/auth/login", {"username": "editor", "password": "password-123"}, client=client)

    def reauthenticate(self):
        return self.write(BASE + "/auth/reauthenticate", {"password": "password-123"})

    def enroll(self):
        self.assertEqual(self.login().status_code, 200)
        self.assertEqual(self.reauthenticate().status_code, 200)
        setup = self.client.get(BASE + "/account/authenticators/totp")
        self.assertEqual(setup.status_code, 404)
        secret = setup.json()["meta"]["secret"]
        with self.captureOnCommitCallbacks(execute=True):
            activated = self.write(BASE + "/account/authenticators/totp", {"code": current_code(secret)})
        self.assertEqual(activated.status_code, 200, activated.content)
        self.assertEqual(self.client.get("/protected/").status_code, 200)
        codes = self.client.get(BASE + "/account/authenticators/recovery-codes")
        self.assertEqual(codes.status_code, 200, codes.content)
        return secret, codes.json()["data"]["unused_codes"]

    def test_password_login_uses_session_and_csrf(self):
        denied = self.client.post(
            BASE + "/auth/login",
            data=json.dumps({"username": "editor", "password": "password-123"}),
            content_type="application/json",
        )
        self.assertEqual(denied.status_code, 403)
        response = self.login()
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["meta"]["is_authenticated"])
        self.assertEqual(self.client.session[SESSION_VERSION], 0)
        self.assertEqual(self.client.get("/protected/").status_code, 200)
        self.assertEqual(self.client.post("/protected/", {}).status_code, 403)
        self.assertTrue(self.client.cookies["sessionid"]["httponly"])

    def test_signup_and_passwordless_login_are_closed(self):
        result = self.write(
            BASE + "/auth/signup", {"username": "new", "email": "new@example.invalid", "password": "password-123"}
        )
        self.assertEqual(result.status_code, 403)
        self.assertEqual(self.client.get(BASE + "/auth/webauthn/login").status_code, 404)
        self.assertEqual(set(get_user_model().objects.values_list("pk", flat=True)), self.initial_user_ids)

    def test_factor_management_requires_recent_authentication(self):
        self.login()
        denied = self.client.get(BASE + "/account/authenticators/totp")
        self.assertEqual(denied.status_code, 401)
        self.assertTrue(denied.json()["meta"]["is_authenticated"])
        self.reauthenticate()
        self.assertEqual(self.client.get(BASE + "/account/authenticators/totp").status_code, 404)

    def test_no_email_record_cannot_enable_mfa(self):
        # Legacy Django accounts may not yet have allauth email records.
        self.login()
        self.reauthenticate()
        EmailAddress.objects.filter(user=self.user).update(verified=False)
        self.assertEqual(self.client.get(BASE + "/account/authenticators/totp").status_code, 409)

    def test_wrong_activation_code_does_not_enable_mfa(self):
        self.login()
        self.reauthenticate()
        self.client.get(BASE + "/account/authenticators/totp")
        response = self.write(BASE + "/account/authenticators/totp", {"code": "incorrect"})
        self.assertEqual(response.status_code, 400)
        self.assertFalse(Authenticator.objects.filter(user=self.user).exists())

    def test_mfa_enrollment_encrypts_secret_and_recovery_material(self):
        secret, codes = self.enroll()
        self.assertEqual(len(codes), 10)
        data = json.dumps(list(Authenticator.objects.filter(user=self.user).values_list("data", flat=True)))
        self.assertNotIn(secret, data)
        for code in codes:
            self.assertNotIn(code, data)
        second_view = self.client.get(BASE + "/account/authenticators/recovery-codes").json()
        self.assertNotIn("unused_codes", second_view["data"])

    def test_password_is_only_first_stage_when_mfa_enabled(self):
        secret, codes = self.enroll()
        other = Client(enforce_csrf_checks=True)
        response = self.login(other)
        self.assertEqual(response.status_code, 401)
        self.assertFalse(response.json()["meta"]["is_authenticated"])
        self.assertTrue(
            any(flow["id"] == "mfa_authenticate" and flow["is_pending"] for flow in response.json()["data"]["flows"])
        )
        self.assertEqual(other.get("/protected/").status_code, 401)
        wrong = self.write(BASE + "/auth/2fa/authenticate", {"code": "incorrect"}, client=other)
        self.assertEqual(wrong.status_code, 400)
        self.assertEqual(other.get("/protected/").status_code, 401)
        complete = self.write(BASE + "/auth/2fa/authenticate", {"code": current_code(secret)}, client=other)
        self.assertEqual(complete.status_code, 200, complete.content)
        self.assertTrue(other.session[SESSION_MFA])
        self.assertEqual(other.get("/protected/").status_code, 200)

    def test_recovery_code_cannot_be_reused(self):
        _, codes = self.enroll()
        for index in range(2):
            client = Client(enforce_csrf_checks=True)
            self.assertEqual(self.login(client).status_code, 401)
            response = self.write(BASE + "/auth/2fa/authenticate", {"code": codes[0]}, client=client)
            self.assertEqual(response.status_code, 200 if index == 0 else 400)

    def test_replacing_recovery_codes_invalidates_old_codes(self):
        _, codes = self.enroll()
        with self.captureOnCommitCallbacks(execute=True):
            response = self.write(BASE + "/account/authenticators/recovery-codes")
        self.assertEqual(response.status_code, 200, response.content)
        new_codes = response.json()["data"]["unused_codes"]
        self.assertEqual(len(new_codes), 10)
        self.assertTrue(set(codes).isdisjoint(new_codes))
        other = Client(enforce_csrf_checks=True)
        self.login(other)
        self.assertEqual(self.write(BASE + "/auth/2fa/authenticate", {"code": codes[0]}, client=other).status_code, 400)

    def test_old_sessions_and_all_legacy_tokens_are_revoked(self):
        self.login()
        old_session = Client(enforce_csrf_checks=True)
        old_session.cookies = self.client.cookies.copy()
        token_pair = self.write("/api/v1/auth/token/", {"username": "editor", "password": "password-123"}).json()
        drf_token = Token.objects.create(user=self.user)
        # enroll() starts with login; first end the current session.
        self.write(BASE + "/auth/session", method="delete")
        _, codes = self.enroll()
        self.assertEqual(old_session.get("/protected/").status_code, 401)
        for scheme, token in [("Bearer", token_pair["access"]), ("Token", drf_token.key)]:
            self.assertEqual(Client().get("/protected/", HTTP_AUTHORIZATION=f"{scheme} {token}").status_code, 401)
        self.assertEqual(
            self.write("/api/v1/auth/token/", {"username": "editor", "password": "password-123"}).status_code, 401
        )
        self.assertEqual(self.write("/api/v1/auth/token/refresh/", {"refresh": token_pair["refresh"]}).status_code, 401)
        self.assertEqual(self.write("/api/v1/auth/token/verify/", {"token": token_pair["access"]}).status_code, 401)
        with self.captureOnCommitCallbacks(execute=True):
            self.assertEqual(self.write(BASE + "/account/authenticators/totp", method="delete").status_code, 200)
        self.assertFalse(Authenticator.objects.filter(user=self.user).exists())
        self.assertEqual(
            Client().get("/protected/", HTTP_AUTHORIZATION=f"Bearer {token_pair['access']}").status_code, 401
        )
        self.assertEqual(self.write("/api/v1/auth/token/refresh/", {"refresh": token_pair["refresh"]}).status_code, 401)
        fresh = self.write("/api/v1/auth/token/", {"username": "editor", "password": "password-123"})
        self.assertEqual(fresh.status_code, 200)

    def test_password_reauthentication_cannot_replace_mfa_for_security_changes(self):
        self.enroll()
        session = self.client.session
        session["account_authentication_methods"] = []
        session.save()
        self.reauthenticate()
        self.assertEqual(self.write(BASE + "/account/authenticators/totp", method="delete").status_code, 401)

    def test_logout_removes_server_session(self):
        self.login()
        self.write(BASE + "/auth/session", method="delete")
        self.assertEqual(self.client.get("/protected/").status_code, 401)

    def test_provider_email_does_not_link_local_account(self):
        social = SocialLogin(
            account=SocialAccount(provider="google", uid="external-subject", extra_data={"email": self.user.email}),
            user=get_user_model()(email=self.user.email),
        )
        with self.assertRaises(Exception) as caught:
            SocialAccountAdapter().pre_social_login(None, social)
        self.assertEqual(caught.exception.response.url, "/login?providerError=unlinked")
        self.assertFalse(SocialAccount.objects.exists())

    def test_authorization_headers_cannot_manage_browser_security(self):
        self.login()
        result = self.client.get(BASE + "/account/providers", HTTP_AUTHORIZATION="ApiKey invalid-machine-key")
        self.assertEqual(result.status_code, 403)

    def test_missing_encryption_key_fails_closed(self):
        self.login()
        self.reauthenticate()
        with override_settings(CMS_MFA_ENCRYPTION_KEYS=[]):
            self.assertEqual(self.client.get(BASE + "/account/authenticators/totp").status_code, 503)

    def test_keyring_rotation_retains_decryption(self):
        original = MFAAdapter().encrypt("test-secret")
        new_key = Fernet.generate_key().decode()
        from django.conf import settings

        with override_settings(CMS_MFA_ENCRYPTION_KEYS=[new_key, *settings.CMS_MFA_ENCRYPTION_KEYS]):
            self.assertEqual(MFAAdapter().decrypt(original), "test-secret")

    def test_webauthn_requires_recent_auth_and_rejects_invalid_credentials(self):
        self.login()
        self.reauthenticate()
        response = self.client.get(BASE + "/account/authenticators/webauthn")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["data"]["creation_options"]["publicKey"]["rp"]["id"], "testserver")
        result = self.write(BASE + "/account/authenticators/webauthn", {"name": "Key", "credential": {"id": "invalid"}})
        self.assertEqual(result.status_code, 400)
        self.assertFalse(Authenticator.objects.filter(user=self.user, type="webauthn").exists())
        self.assertEqual(self.client.get(BASE + "/account/authenticators/webauthn?passwordless=1").status_code, 400)

    def test_webauthn_challenge_expires(self):
        self.login()
        self.reauthenticate()
        self.client.get(BASE + "/account/authenticators/webauthn")
        session = self.client.session
        session["cms_webauthn_started"] = time.time() - 301
        session.save()
        result = self.write(BASE + "/account/authenticators/webauthn", {"credential": {"id": "invalid"}})
        self.assertEqual(result.status_code, 409)

    def test_password_reset_preserves_mfa_and_revokes_credentials(self):
        self.enroll()
        before = security_version(self.user)
        from allauth.account.signals import password_reset

        password_reset.send(sender=type(self.user), request=None, user=self.user)
        self.assertTrue(Authenticator.objects.filter(user=self.user, type="totp").exists())
        self.assertGreater(security_version(self.user), before)
        self.assertEqual(self.client.get("/protected/").status_code, 401)

    def test_unverified_existing_account_verifies_email_before_access(self):
        EmailAddress.objects.filter(user=self.user).update(verified=False)
        result = self.login()
        self.assertEqual(result.status_code, 401)
        self.assertEqual(self.client.get("/protected/").status_code, 401)
        state = self.client.session["account_email_verification_code"]
        result = self.write(BASE + "/auth/email/verify", {"key": state["code"]})
        self.assertEqual(result.status_code, 200, result.content)
        self.assertTrue(EmailAddress.objects.get(user=self.user).verified)
        self.assertEqual(self.client.get("/protected/").status_code, 200)

    def test_software_webauthn_key_enrollment_and_second_factor(self):
        """Exercise real fido2 attestation/assertion verification without hardware."""
        import base64
        import hashlib
        import os
        import struct

        from cryptography.hazmat.primitives import hashes
        from cryptography.hazmat.primitives.asymmetric import ec
        from fido2 import cbor

        def b64(value):
            return base64.urlsafe_b64encode(value).rstrip(b"=").decode()

        private = ec.generate_private_key(ec.SECP256R1())
        public = private.public_key().public_numbers()
        credential_id = os.urandom(32)
        cose = {1: 2, 3: -7, -1: 1, -2: public.x.to_bytes(32, "big"), -3: public.y.to_bytes(32, "big")}
        self.login()
        self.reauthenticate()
        options = self.client.get(BASE + "/account/authenticators/webauthn").json()["data"]["creation_options"][
            "publicKey"
        ]
        client_data = json.dumps(
            {"type": "webauthn.create", "challenge": options["challenge"], "origin": "https://testserver"}
        ).encode()
        auth_data = (
            hashlib.sha256(b"testserver").digest()
            + b"\x41"
            + struct.pack(">I", 0)
            + b"\0" * 16
            + struct.pack(">H", len(credential_id))
            + credential_id
            + cbor.encode(cose)
        )
        credential = {
            "id": b64(credential_id),
            "rawId": b64(credential_id),
            "type": "public-key",
            "clientExtensionResults": {},
            "response": {
                "clientDataJSON": b64(client_data),
                "attestationObject": b64(cbor.encode({"fmt": "none", "attStmt": {}, "authData": auth_data})),
                "transports": ["internal"],
            },
        }
        with self.captureOnCommitCallbacks(execute=True):
            result = self.write(
                BASE + "/account/authenticators/webauthn", {"name": "Test passkey", "credential": credential}
            )
        self.assertEqual(result.status_code, 200, result.content)
        self.assertEqual(result.json()["data"]["name"], "Test passkey")
        second = Client(enforce_csrf_checks=True)
        self.assertEqual(self.login(second).status_code, 401)
        options = second.get(BASE + "/auth/webauthn/authenticate").json()["data"]["request_options"]["publicKey"]
        client_data = json.dumps(
            {"type": "webauthn.get", "challenge": options["challenge"], "origin": "https://testserver"}
        ).encode()
        auth_data = hashlib.sha256(b"testserver").digest() + b"\x01" + struct.pack(">I", 1)
        signature = private.sign(auth_data + hashlib.sha256(client_data).digest(), ec.ECDSA(hashes.SHA256()))
        assertion = {
            "id": b64(credential_id),
            "rawId": b64(credential_id),
            "type": "public-key",
            "clientExtensionResults": {},
            "response": {
                "clientDataJSON": b64(client_data),
                "authenticatorData": b64(auth_data),
                "signature": b64(signature),
                "userHandle": None,
            },
        }
        result = self.write(BASE + "/auth/webauthn/authenticate", {"credential": assertion}, client=second)
        self.assertEqual(result.status_code, 200, result.content)
        self.assertEqual(second.get("/protected/").status_code, 200)
        self.assertTrue(second.session[SESSION_MFA])

    @override_settings(
        SOCIALACCOUNT_PROVIDERS={"google": {"APPS": [{"client_id": "test-client", "secret": "test-only"}]}}
    )
    def test_google_callback_keeps_mfa_pending_and_never_creates_membership(self):
        from urllib.parse import parse_qs, urlsplit

        from allauth.socialaccount.providers.google.views import GoogleOAuth2Adapter
        from allauth.socialaccount.providers.oauth2.client import OAuth2Client

        _, codes = self.enroll()
        SocialAccount.objects.create(user=self.user, provider="google", uid="google-subject")
        other = Client(enforce_csrf_checks=True)
        csrf = other.get("/csrf-token/").json()["csrfToken"]
        start = other.post(
            BASE + "/auth/provider/redirect",
            {
                "provider": "google",
                "process": "login",
                "callback_url": "http://testserver/login",
                "csrfmiddlewaretoken": csrf,
            },
        )
        self.assertEqual(start.status_code, 302)
        state = parse_qs(urlsplit(start.url).query)["state"][0]
        from allauth.socialaccount.adapter import get_adapter
        from django.test import RequestFactory

        provider = get_adapter().get_provider(RequestFactory().get("/"), "google")
        social = SocialLogin(
            provider=provider,
            account=SocialAccount(provider="google", uid="google-subject"),
            user=get_user_model()(email=self.user.email),
        )
        with (
            patch.object(
                OAuth2Client, "get_access_token", return_value={"access_token": "synthetic", "token_type": "Bearer"}
            ),
            patch.object(GoogleOAuth2Adapter, "complete_login", return_value=social),
        ):
            response = other.get("/accounts/google/login/callback/", {"code": "synthetic", "state": state})
        self.assertEqual(response.status_code, 302, response.content)
        self.assertEqual(other.get("/protected/").status_code, 401)
        session = other.get(BASE + "/auth/session").json()
        self.assertTrue(
            any(flow.get("id") == "mfa_authenticate" and flow.get("is_pending") for flow in session["data"]["flows"])
        )
        response = self.write(BASE + "/auth/2fa/authenticate", {"code": codes[0]}, client=other)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(set(get_user_model().objects.values_list("pk", flat=True)), self.initial_user_ids)

    @override_settings(
        SOCIALACCOUNT_PROVIDERS={"google": {"APPS": [{"client_id": "test-client", "secret": "test-only"}]}}
    )
    def test_google_connect_callback_creates_explicit_identity_and_revokes_older_session(self):
        from urllib.parse import parse_qs, urlsplit

        from allauth.socialaccount.providers.google.views import GoogleOAuth2Adapter
        from allauth.socialaccount.providers.oauth2.client import OAuth2Client

        stale = Client(enforce_csrf_checks=True)
        self.login(stale)
        self.login()
        self.reauthenticate()
        csrf = self.client.get("/csrf-token/").json()["csrfToken"]
        result = self.client.post(
            BASE + "/auth/provider/redirect",
            {
                "provider": "google",
                "process": "connect",
                "callback_url": "http://testserver/profile",
                "csrfmiddlewaretoken": csrf,
            },
        )
        self.assertEqual(result.status_code, 302)
        state = parse_qs(urlsplit(result.url).query)["state"][0]
        social = SocialLogin(
            account=SocialAccount(provider="google", uid="new-subject"),
            user=get_user_model()(email="private-relay@example.invalid"),
        )
        with (
            patch.object(
                OAuth2Client, "get_access_token", return_value={"access_token": "synthetic", "token_type": "Bearer"}
            ),
            patch.object(GoogleOAuth2Adapter, "complete_login", return_value=social),
        ):
            result = self.client.get("/accounts/google/login/callback/", {"code": "synthetic", "state": state})
        self.assertEqual(result.status_code, 302)
        self.assertTrue(SocialAccount.objects.filter(user=self.user, uid="new-subject").exists())
        self.assertEqual(stale.get("/protected/").status_code, 401)
        self.assertEqual(self.client.get("/protected/").status_code, 200)
        self.assertEqual(self.user.email, "editor@example.invalid")

    @override_settings(
        SOCIALACCOUNT_PROVIDERS={"google": {"APPS": [{"client_id": "test-client", "secret": "test-only"}]}}
    )
    def test_callback_with_invalid_state_cannot_exchange_credentials(self):
        from allauth.socialaccount.providers.oauth2.client import OAuth2Client

        with patch.object(OAuth2Client, "get_access_token") as exchange:
            result = self.client.get("/accounts/google/login/callback/", {"code": "unused", "state": "invalid"})
        exchange.assert_not_called()
        self.assertEqual(result.status_code, 302)
        self.assertEqual(self.client.get("/protected/").status_code, 401)

    @override_settings(
        SOCIALACCOUNT_PROVIDERS={
            "apple": {
                "APPS": [
                    {
                        "client_id": "test.service",
                        "secret": "test-key-id",
                        "key": "test-team-id",
                        "settings": {"certificate_key": "synthetic-unused-by-mock"},
                    }
                ]
            }
        }
    )
    def test_apple_cross_site_post_preserves_original_session_and_requires_mfa(self):
        from urllib.parse import parse_qs, urlsplit

        from allauth.socialaccount.providers.apple.client import AppleOAuth2Client
        from allauth.socialaccount.providers.apple.views import AppleOAuth2Adapter

        _, codes = self.enroll()
        SocialAccount.objects.create(user=self.user, provider="apple", uid="apple-subject")
        browser = Client(enforce_csrf_checks=True)
        csrf = browser.get("/csrf-token/").json()["csrfToken"]
        start = browser.post(
            BASE + "/auth/provider/redirect",
            {
                "provider": "apple",
                "process": "login",
                "callback_url": "http://testserver/login",
                "csrfmiddlewaretoken": csrf,
            },
        )
        self.assertEqual(start.status_code, 302)
        state = parse_qs(urlsplit(start.url).query)["state"][0]
        # SameSite=Lax withholds the normal session cookie on Apple's POST.
        cross_site = Client(enforce_csrf_checks=True)
        post = cross_site.post(
            "/accounts/apple/login/callback/", {"code": "synthetic-code", "state": state, "id_token": "synthetic-token"}
        )
        self.assertEqual(post.status_code, 302)
        self.assertNotIn("sessionid", post.cookies)
        browser.cookies.update(post.cookies)
        with (
            patch.object(
                AppleOAuth2Client,
                "get_access_token",
                return_value={"access_token": "synthetic-access", "id_token": "synthetic-token"},
            ),
            patch.object(
                AppleOAuth2Adapter,
                "get_verified_identity_data",
                return_value={
                    "sub": "apple-subject",
                    "email": "private@privaterelay.appleid.com",
                    "email_verified": True,
                    "is_private_email": True,
                },
            ),
        ):
            finish = browser.get(post.url)
        self.assertEqual(finish.status_code, 302, finish.content)
        self.assertEqual(browser.get("/protected/").status_code, 401)
        complete = self.write(BASE + "/auth/2fa/authenticate", {"code": codes[0]}, client=browser)
        self.assertEqual(complete.status_code, 200, complete.content)
        self.user.refresh_from_db()
        self.assertEqual(self.user.email, "editor@example.invalid")
        self.assertEqual(set(get_user_model().objects.values_list("pk", flat=True)), self.initial_user_ids)

    def test_real_password_reset_flow_retains_second_factor(self):
        import re

        from django.core import mail

        self.enroll()
        self.write(BASE + "/auth/session", method="delete")
        request = self.write(BASE + "/auth/password/request", {"email": self.user.email})
        self.assertEqual(request.status_code, 200, request.content)
        self.assertIn("http://testserver/login?resetKey=", mail.outbox[-1].body)
        key = re.search(r"resetKey=([^\s]+)", mail.outbox[-1].body).group(1)
        result = self.write(BASE + "/auth/password/reset", {"key": key, "password": "new-password-123"})
        self.assertIn(result.status_code, [200, 401])
        self.assertTrue(Authenticator.objects.filter(user=self.user, type="totp").exists())
        result = self.write(BASE + "/auth/login", {"username": "editor", "password": "new-password-123"})
        self.assertEqual(result.status_code, 401)
        self.assertEqual(self.client.get("/protected/").status_code, 401)

    def test_pending_totp_secret_is_encrypted_in_stored_session(self):
        from django.contrib.sessions.models import Session

        from .session_serializer import SecuritySessionSerializer

        self.login()
        self.reauthenticate()
        response = self.client.get(BASE + "/account/authenticators/totp")
        secret = response.json()["meta"]["secret"]
        session = self.client.session
        serialized = SecuritySessionSerializer().dumps(dict(session))
        self.assertNotIn(secret.encode(), serialized)
        self.assertEqual(SecuritySessionSerializer().loads(serialized)["mfa.totp.secret"], secret)
        self.assertNotIn(secret, Session.objects.get(session_key=session.session_key).session_data)

    def test_provider_extra_data_never_retains_bearer_credentials(self):
        account = SocialAccount.objects.create(
            user=self.user,
            provider="apple",
            uid="subject",
            extra_data={
                "sub": "subject",
                "email": "relay@example.invalid",
                "access_token": "synthetic-access",
                "refresh_token": "synthetic-refresh",
                "id_token": "synthetic-id-token",
            },
        )
        account.refresh_from_db()
        self.assertEqual(set(account.extra_data), {"sub", "email"})

    def test_security_state_does_not_change_workspace_memberships(self):
        from core.models import Tenant

        other = get_user_model().objects.create_user("other-owner")
        allowed = Tenant.objects.create(identifier="allowed", name="Allowed", created_by=other)
        foreign = Tenant.objects.create(identifier="foreign", name="Foreign", created_by=other)
        allowed.members.add(self.user)
        before = set(self.user.member_tenants.values_list("pk", flat=True))
        self.enroll()
        self.assertEqual(set(self.user.member_tenants.values_list("pk", flat=True)), before)
        self.assertTrue(allowed.user_has_access(self.user))
        self.assertFalse(foreign.user_has_access(self.user))

    def test_deleting_an_account_with_factors_does_not_recreate_revocation_state(self):
        self.enroll()
        user_id = self.user.pk
        self.user.delete()
        self.assertFalse(AccountSecurity.objects.filter(user_id=user_id).exists())
        self.assertFalse(Authenticator.objects.filter(user_id=user_id).exists())


@override_settings(**AUTH_TEST_SETTINGS)
class WebSocketAuthenticationTests(TransactionTestCase):
    def setUp(self):
        cache.clear()
        self.user = get_user_model().objects.create_user("socket-editor", password="password-123")
        self.client.force_login(self.user, backend="django.contrib.auth.backends.ModelBackend")

    def test_real_websocket_session_and_revocation(self):
        from asgiref.sync import async_to_sync
        from channels.auth import AuthMiddlewareStack
        from channels.db import database_sync_to_async
        from channels.generic.websocket import AsyncJsonWebsocketConsumer
        from channels.testing import WebsocketCommunicator

        from .asgi import AccountSecurityASGIMiddleware
        from .security import websocket_session_is_valid

        class Probe(AsyncJsonWebsocketConsumer):
            async def connect(inner):
                user = inner.scope.get("user")
                if not user or not user.is_authenticated:
                    await inner.close(code=4401)
                else:
                    await inner.accept()

            async def receive_json(inner, content):
                valid = await database_sync_to_async(websocket_session_is_valid)(inner.scope["user"], inner.scope)
                if not valid:
                    await inner.close(code=4401)
                else:
                    await inner.send_json({"authenticated": True})

        application = AuthMiddlewareStack(AccountSecurityASGIMiddleware(Probe.as_asgi()))
        cookie = self.client.cookies["sessionid"].value

        async def scenario():
            anonymous = WebsocketCommunicator(application, "/ws/")
            connected, _ = await anonymous.connect()
            self.assertFalse(connected)
            socket = WebsocketCommunicator(application, "/ws/", headers=[(b"cookie", f"sessionid={cookie}".encode())])
            connected, _ = await socket.connect()
            self.assertTrue(connected)
            await socket.send_json_to({"ping": True})
            self.assertEqual(await socket.receive_json_from(), {"authenticated": True})
            await database_sync_to_async(revoke_credentials)(self.user)
            await socket.send_json_to({"ping": True})
            self.assertEqual((await socket.receive_output())["type"], "websocket.close")
            await socket.disconnect()
            stale = WebsocketCommunicator(application, "/ws/", headers=[(b"cookie", f"sessionid={cookie}".encode())])
            connected, _ = await stale.connect()
            self.assertFalse(connected)

        async_to_sync(scenario)()

    def test_signing_out_revokes_live_websocket_session(self):
        from .security import websocket_session_is_valid

        scope = {"session": self.client.session}
        self.assertTrue(websocket_session_is_valid(self.user, scope))
        self.client.logout()
        self.assertFalse(websocket_session_is_valid(self.user, scope))

    def test_kanban_ticket_websocket_rejects_revoked_security_state(self):
        from asgiref.sync import async_to_sync
        from channels.db import database_sync_to_async
        from channels.layers import get_channel_layer
        from channels.testing import WebsocketCommunicator
        from rest_framework.exceptions import AuthenticationFailed

        from core.models import Tenant
        from kanban.access import issue_ticket, resolve_ticket
        from kanban.consumers import KanbanConsumer

        tenant = Tenant.objects.create(identifier="socket-tenant", name="Socket tenant", created_by=self.user)
        ticket = issue_ticket(self.user, tenant)
        self.assertEqual(resolve_ticket(ticket)[0].pk, self.user.pk)

        async def scenario():
            socket = WebsocketCommunicator(KanbanConsumer.as_asgi(), "/ws/", subprotocols=["kanban", ticket])
            socket.scope["url_route"] = {"kwargs": {"tenant_id": str(tenant.pk)}}
            connected, _ = await socket.connect()
            self.assertTrue(connected)
            await database_sync_to_async(revoke_credentials)(self.user)
            await get_channel_layer().group_send(f"kanban_{tenant.pk}", {"type": "kanban.changed"})
            self.assertEqual((await socket.receive_output())["type"], "websocket.close")
            await socket.disconnect()

        async_to_sync(scenario)()
        with self.assertRaises(AuthenticationFailed):
            resolve_ticket(ticket)
