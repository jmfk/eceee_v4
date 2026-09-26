from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient, APIRequestFactory, force_authenticate

from core.models import Tenant
from utils.views import CurrentUserView, UserListView
from webpages.models import PageTheme, ThemeDesignerAssignment


class UserListQueryTests(TestCase):
    def test_user_list_access_fields_use_bounded_queries(self):
        admin = User.objects.create_superuser("designer-query-admin", password="test")
        designer = User.objects.create_user("designer-query-user", password="test")
        tenant = Tenant.objects.create(name="Tenant", identifier="designer-query-tenant", created_by=admin)
        theme = PageTheme.objects.create(tenant=tenant, created_by=admin, name="Theme")
        ThemeDesignerAssignment.objects.create(
            tenant=tenant,
            theme=theme,
            user=designer,
            created_by=admin,
        )
        request = APIRequestFactory().get("/api/v1/utils/users/")
        force_authenticate(request, user=admin)

        with self.assertNumQueries(4):
            response = UserListView.as_view()(request)

        self.assertEqual(response.status_code, 200)
        serialized_designer = next(user for user in response.data["users"] if user["username"] == "designer-query-user")
        self.assertTrue(serialized_designer["is_designer_only"])
        self.assertFalse(serialized_designer["has_tenant_admin_access"])
        self.assertEqual(serialized_designer["designer_tenants"][0]["identifier"], "designer-query-tenant")

    def test_current_staff_user_can_choose_every_active_workspace_in_designer(self):
        admin = User.objects.create_superuser("designer-workspace-admin", password="test")
        first = Tenant.objects.create(name="First workspace", identifier="first-workspace", created_by=admin)
        second = Tenant.objects.create(name="Second workspace", identifier="second-workspace", created_by=admin)
        Tenant.objects.create(
            name="Inactive workspace", identifier="inactive-workspace", created_by=admin, is_active=False
        )
        request = APIRequestFactory().get("/api/v1/utils/current-user/")
        request.tenant = first
        force_authenticate(request, user=admin)

        response = CurrentUserView.as_view()(request)

        self.assertEqual(response.status_code, 200)
        workspace_ids = {workspace["id"] for workspace in response.data["designer_tenants"]}
        self.assertIn(str(first.id), workspace_ids)
        self.assertIn(str(second.id), workspace_ids)
        self.assertNotIn(
            "inactive-workspace", {workspace["identifier"] for workspace in response.data["designer_tenants"]}
        )
        self.assertEqual(response.data["current_workspace"]["identifier"], first.identifier)
        self.assertTrue(response.data["can_switch_tenant"])

    def test_only_superusers_and_dev_auto_user_can_switch_workspace(self):
        owner = User.objects.create_user("workspace-owner", password="test")
        dev_user = User.objects.create_user("dev_auto_user", password="test")
        superuser = User.objects.create_superuser("workspace-superuser", password="test")
        workspace = Tenant.objects.create(name="Switch target", identifier="switch-target", created_by=owner)
        client = APIClient()

        client.force_authenticate(owner)
        denied = client.post(
            "/api/v1/utils/current-workspace/",
            {"identifier": workspace.identifier},
            format="json",
        )
        self.assertEqual(denied.status_code, 403)

        for allowed_user in (dev_user, superuser):
            client.force_authenticate(allowed_user)
            response = client.post(
                "/api/v1/utils/current-workspace/",
                {"identifier": workspace.identifier},
                format="json",
            )
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.data["currentWorkspace"]["identifier"], workspace.identifier)
            self.assertEqual(client.session["selected_tenant_identifier"], workspace.identifier)

    def test_workspace_switch_rejects_inactive_workspace(self):
        superuser = User.objects.create_superuser("inactive-workspace-superuser", password="test")
        inactive = Tenant.objects.create(
            name="Inactive", identifier="inactive-switch-target", created_by=superuser, is_active=False
        )
        client = APIClient()
        client.force_authenticate(superuser)

        response = client.post(
            "/api/v1/utils/current-workspace/",
            {"identifier": inactive.identifier},
            format="json",
        )

        self.assertEqual(response.status_code, 404)

    def test_staff_user_does_not_receive_unrelated_workspace_choices(self):
        owner = User.objects.create_user("workspace-creator", password="test")
        staff = User.objects.create_user("ordinary-staff", password="test", is_staff=True)
        owned = Tenant.objects.create(name="Owned", identifier="owned-workspace", created_by=staff)
        Tenant.objects.create(name="Unrelated", identifier="unrelated-workspace", created_by=owner)
        request = APIRequestFactory().get("/api/v1/utils/current-user/")
        request.tenant = owned
        force_authenticate(request, user=staff)

        response = CurrentUserView.as_view()(request)

        self.assertFalse(response.data["can_switch_tenant"])
        self.assertEqual(
            [workspace["identifier"] for workspace in response.data["designer_tenants"]],
            [owned.identifier],
        )
