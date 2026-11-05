import json
import time
from importlib import import_module

from asgiref.sync import async_to_sync
from django.conf import settings
from django.contrib.auth import get_user_model
from django.test import Client, TestCase, TransactionTestCase, override_settings

from .asgi import AccountSecurityASGIMiddleware, UserPerspectiveASGIMiddleware
from .impersonation import CONTROL_PATH, SESSION_KEY
from .security import SESSION_MFA, SESSION_VERSION, revoke_credentials, security_version, websocket_session_is_valid
from .tests import AUTH_TEST_SETTINGS

PERSPECTIVE_SETTINGS = {
    **AUTH_TEST_SETTINGS,
    "MIDDLEWARE": [
        *AUTH_TEST_SETTINGS["MIDDLEWARE"],
        "cms_auth.impersonation.UserPerspectiveMiddleware",
    ],
}


@override_settings(**PERSPECTIVE_SETTINGS)
class UserPerspectiveTests(TestCase):
    def setUp(self):
        users = get_user_model()
        self.admin = users.objects.create_superuser("owner", password="synthetic-test-password")
        self.target = users.objects.create_user("editor", password="synthetic-test-password")
        self.client = Client(enforce_csrf_checks=True)
        self.sign_in(self.admin)

    def sign_in(self, user, client=None):
        client = client or self.client
        client.force_login(user, backend="django.contrib.auth.backends.ModelBackend")
        session = client.session
        session[SESSION_VERSION] = security_version(user)
        session[SESSION_MFA] = True
        session.save()

    def write(self, path=CONTROL_PATH, data=None, method="post", **headers):
        csrf = self.client.get("/csrf-token/").json()["csrfToken"]
        return getattr(self.client, method)(
            path, data=json.dumps(data or {}), content_type="application/json", HTTP_X_CSRFTOKEN=csrf, **headers
        )

    def start(self):
        return self.write(data={"userId": self.target.pk})

    def test_effective_reads_and_writes_use_target_and_preserve_real_login(self):
        with self.assertLogs("cms_auth.impersonation", level="INFO") as audit:
            self.assertEqual(self.start().status_code, 200)
            self.assertEqual(self.client.get("/protected/").json()["user"], self.target.pk)
            self.assertEqual(self.write("/protected/").json()["user"], self.target.pk)
        self.assertIn(f"actor_id={self.admin.pk} target_id={self.target.pk}", audit.output[-1])
        self.assertEqual(self.client.session["_auth_user_id"], str(self.admin.pk))
        self.assertEqual(self.client.get("/system-owner-only/").status_code, 403)
        self.assertEqual(self.write(method="delete").status_code, 200)
        self.assertEqual(self.client.get("/protected/").json()["user"], self.admin.pk)
        self.assertEqual(self.client.get("/system-owner-only/").status_code, 200)

    def test_requires_csrf_and_system_owner_browser_session(self):
        self.assertEqual(self.client.post(CONTROL_PATH, {"userId": self.target.pk}).status_code, 403)
        self.assertEqual(
            self.write(data={"userId": self.target.pk}, HTTP_AUTHORIZATION="Bearer synthetic").status_code, 403
        )
        for staff in (False, True):
            self.target.is_staff = staff
            self.target.save()
            self.sign_in(self.target)
            self.assertEqual(self.write(data={"userId": self.admin.pk}).status_code, 403)

    def test_rejects_inactive_self_owner_invalid_and_nested_targets(self):
        other_owner = get_user_model().objects.create_superuser("other-owner", password="synthetic-test-password")
        self.target.is_active = False
        self.target.save()
        for user_id in (self.admin.pk, other_owner.pk, self.target.pk, 99999, "bad"):
            self.assertEqual(self.write(data={"userId": user_id}).status_code, 400)
        self.target.is_active = True
        self.target.save()
        self.assertEqual(self.start().status_code, 200)
        self.assertEqual(self.start().status_code, 409)

    def test_expiry_fails_closed_and_explicit_exit_remains_available(self):
        self.start()
        session = self.client.session
        record = session[SESSION_KEY]
        record["expires_at"] = int(time.time()) - 1
        session[SESSION_KEY] = record
        session.save()
        self.assertEqual(self.client.get("/protected/").status_code, 403)
        status = self.client.get("/api/v1/utils/current-user/")
        self.assertTrue(status.json()["userPerspective"]["expired"])
        self.assertFalse(status.json()["isSuperuser"])
        self.assertEqual(self.write(method="delete").status_code, 200)
        self.assertEqual(self.client.get("/protected/").json()["user"], self.admin.pk)

    def test_revoked_or_disabled_target_cannot_be_used_but_actor_can_exit(self):
        self.start()
        revoke_credentials(self.target)
        self.assertEqual(self.client.get("/protected/").status_code, 403)
        self.assertEqual(self.write(method="delete").status_code, 200)
        self.start()
        self.target.is_active = False
        self.target.save()
        self.assertEqual(self.client.get("/protected/").status_code, 403)
        self.assertEqual(self.write(method="delete").status_code, 200)

    def test_revoked_or_demoted_actor_cannot_continue_or_restore_privileges(self):
        self.start()
        revoke_credentials(self.admin)
        self.assertIn(self.client.get("/protected/").status_code, (401, 403))
        self.assertIn(self.write(method="delete").status_code, (401, 403))
        self.sign_in(self.admin)
        self.start()
        self.admin.is_superuser = False
        self.admin.save()
        self.assertEqual(self.client.get("/protected/").status_code, 401)
        self.assertIn(self.write(method="delete").status_code, (401, 403))

    def test_account_security_and_credential_overrides_are_blocked(self):
        self.start()
        self.assertEqual(self.client.get("/_allauth/browser/v1/auth/session").status_code, 403)
        self.assertEqual(self.write("/api/v1/utils/change-password/").status_code, 403)
        self.assertEqual(self.write("/api/auth/login/").status_code, 403)
        self.assertEqual(self.client.get("/protected/", HTTP_AUTHORIZATION="Bearer synthetic").status_code, 401)
        self.assertEqual(self.client.get("/protected/")["Cache-Control"], "no-store")

    def test_revoked_original_login_can_restart_normal_sign_in(self):
        self.start()
        revoke_credentials(self.admin)
        response = self.client.get("/_allauth/browser/v1/auth/session")
        self.assertEqual(response.status_code, 401)
        self.assertNotIn(SESSION_KEY, self.client.session)
        signed_in = self.write(
            "/_allauth/browser/v1/auth/login",
            {"username": self.admin.username, "password": "synthetic-test-password"},
        )
        self.assertEqual(signed_in.status_code, 200)
        self.assertEqual(self.client.get("/protected/").json()["user"], self.admin.pk)

    def test_restores_workspace_and_does_not_change_another_login_session(self):
        other = Client()
        self.sign_in(self.admin, other)
        session = self.client.session
        session["selected_tenant_identifier"] = "original"
        session.save()
        self.start()
        session = self.client.session
        session["selected_tenant_identifier"] = "target-workspace"
        session.save()
        self.assertEqual(other.get("/protected/").json()["user"], self.admin.pk)
        self.write(method="delete")
        self.assertEqual(self.client.session["selected_tenant_identifier"], "original")

    def test_live_socket_checks_reject_old_admin_and_expired_or_ended_delegation(self):
        self.start()
        live = import_module(settings.SESSION_ENGINE).SessionStore(session_key=self.client.session.session_key)
        self.assertFalse(websocket_session_is_valid(self.admin, {"session": live}))
        scope = {"session": live, "cms_perspective_actor_id": self.admin.pk}
        self.assertTrue(websocket_session_is_valid(self.target, scope))
        self.assertFalse(websocket_session_is_valid(self.admin, scope))
        self.write(method="delete")
        self.assertFalse(websocket_session_is_valid(self.target, scope))


@override_settings(**PERSPECTIVE_SETTINGS)
class UserPerspectiveSocketTests(TransactionTestCase):
    def test_asgi_resolves_target_and_rechecks_revocation(self):
        admin = get_user_model().objects.create_superuser("socket-owner", password="test")
        target = get_user_model().objects.create_user("socket-target", password="test")
        client = Client()
        client.force_login(admin, backend="django.contrib.auth.backends.ModelBackend")
        client.post(CONTROL_PATH, json.dumps({"userId": target.pk}), content_type="application/json")
        session = import_module(settings.SESSION_ENGINE).SessionStore(session_key=client.session.session_key)
        resolved = {}

        async def inner(scope, receive, send):
            resolved.update(scope)

        middleware = AccountSecurityASGIMiddleware(UserPerspectiveASGIMiddleware(inner))
        async_to_sync(middleware)({"type": "websocket", "user": admin, "session": session}, None, None)
        self.assertEqual(resolved["user"].pk, target.pk)
        self.assertEqual(resolved["cms_perspective_actor_id"], admin.pk)
        self.assertTrue(websocket_session_is_valid(target, resolved))
        revoke_credentials(target)
        self.assertFalse(websocket_session_is_valid(target, resolved))
