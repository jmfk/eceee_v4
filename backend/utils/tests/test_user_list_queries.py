from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from rest_framework.test import APIClient, APIRequestFactory, force_authenticate

from core.models import Tenant
from core.permissions import user_can_switch_tenant
from kanban.models import Board
from utils.views import CurrentUserView, UserListView
from utils.serializers import CreateUserSerializer, UpdateUserSerializer
from webpages.models import PageTheme, ThemeDesignerAssignment


class UserListQueryTests(TestCase):
    def test_account_serializers_do_not_accept_staff_as_a_cms_permission(self):
        create = CreateUserSerializer(
            data={
                "username": "role-member",
                "password": "password123",
                "confirm_password": "password123",
                "is_staff": True,
            }
        )
        self.assertTrue(create.is_valid(), create.errors)
        member = create.save()
        self.assertFalse(member.is_staff)
        update = UpdateUserSerializer(member, data={"is_staff": True}, partial=True)
        self.assertTrue(update.is_valid(), update.errors)
        update.save()
        member.refresh_from_db()
        self.assertFalse(member.is_staff)
        owner = UpdateUserSerializer(member, data={"is_superuser": True}, partial=True)
        self.assertTrue(owner.is_valid(), owner.errors)
        owner.save()
        member.refresh_from_db()
        self.assertTrue(member.is_staff)
        self.assertTrue(member.is_superuser)

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

    def test_users_can_select_only_accessible_workspaces(self):
        owner = User.objects.create_user("workspace-owner", password="test")
        superuser = User.objects.create_superuser("workspace-superuser", password="test")
        workspace = Tenant.objects.create(name="Switch target", identifier="switch-target", created_by=owner)
        other = Tenant.objects.create(name="Unrelated", identifier="unrelated-switch", created_by=superuser)
        client = APIClient()

        client.force_authenticate(owner)
        allowed = client.post(
            "/api/v1/utils/current-workspace/",
            {"identifier": workspace.identifier},
            format="json",
        )
        self.assertEqual(allowed.status_code, 200)
        denied = client.post(
            "/api/v1/utils/current-workspace/",
            {"identifier": other.identifier},
            format="json",
        )
        self.assertEqual(denied.status_code, 403)

        client.force_authenticate(superuser)
        response = client.post(
            "/api/v1/utils/current-workspace/",
            {"identifier": workspace.identifier},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["currentWorkspace"]["identifier"], workspace.identifier)
        self.assertEqual(client.session["selected_tenant_identifier"], workspace.identifier)

    def test_board_guest_can_select_board_workspace_without_tenant_access(self):
        owner = User.objects.create_user("board-workspace-owner", password="test")
        guest = User.objects.create_user("board-workspace-guest", password="test")
        tenant = Tenant.objects.create(name="Board workspace", identifier="board-workspace", created_by=owner)
        board = Board.objects.create(tenant=tenant, title="Shared")
        board.members.add(guest)
        client = APIClient()
        client.force_authenticate(guest)

        response = client.post("/api/v1/utils/current-workspace/", {"identifier": tenant.identifier}, format="json")

        self.assertEqual(response.status_code, 200)
        self.assertFalse(tenant.user_has_access(guest))
        self.assertEqual(client.session["selected_tenant_identifier"], tenant.identifier)
        request = APIRequestFactory().get("/api/v1/utils/current-user/")
        request.tenant = tenant
        force_authenticate(request, user=guest)
        response = CurrentUserView.as_view()(request)
        self.assertTrue(response.data["is_kanban_board_guest"])
        self.assertEqual(response.data["permissions"], ["kanban.read", "kanban.write"])

    @override_settings(DEBUG=True)
    def test_dev_auto_user_can_switch_workspace_in_local_debug(self):
        dev_user = User.objects.create_user("dev_auto_user", password="test")

        self.assertTrue(user_can_switch_tenant(dev_user))

    @override_settings(DEBUG=False)
    def test_dev_auto_user_cannot_switch_workspace_outside_debug(self):
        dev_user = User.objects.create_user("dev_auto_user", password="test")

        self.assertFalse(user_can_switch_tenant(dev_user))

    @override_settings(DEBUG=False)
    def test_dev_auto_user_can_select_own_workspace_outside_debug(self):
        dev_user = User.objects.create_user("dev_auto_user", password="test")
        workspace = Tenant.objects.create(
            name="Production switch target",
            identifier="production-switch-target",
            created_by=dev_user,
        )
        client = APIClient()
        client.force_authenticate(dev_user)

        response = client.post(
            "/api/v1/utils/current-workspace/",
            {"identifier": workspace.identifier},
            format="json",
        )

        self.assertEqual(response.status_code, 200)

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

    def test_current_user_replaces_unrelated_middleware_fallback(self):
        unrelated_owner = User.objects.create_user("unrelated-owner", password="test")
        user = User.objects.create_user("workspace-member", password="test")
        unrelated = Tenant.objects.create(
            name="A unrelated", identifier="unrelated-fallback", created_by=unrelated_owner
        )
        accessible = Tenant.objects.create(name="B accessible", identifier="accessible-workspace", created_by=user)
        request = APIRequestFactory().get("/api/v1/utils/current-user/")
        request.tenant = unrelated
        force_authenticate(request, user=user)

        response = CurrentUserView.as_view()(request)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["current_workspace"]["identifier"], accessible.identifier)
