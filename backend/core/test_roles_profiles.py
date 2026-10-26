import io

from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from PIL import Image
from rest_framework.test import APIRequestFactory, force_authenticate

from .models import ProfilePhoto, Tenant, TenantRole
from .profile_views import ProfilePhotoView
from .role_views import RolesView, WorkspaceMemberView
from .roles import allows_request, is_tenant_admin, permissions_for


class RolesAndProfilesTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user("role-owner")
        self.user = User.objects.create_user("role-user")
        self.outsider = User.objects.create_user("role-outsider")
        self.tenant = Tenant.objects.create(name="Roles", identifier="roles", created_by=self.owner)
        self.tenant.members.add(self.user)
        self.factory = APIRequestFactory()

    def call(self, cls, method="get", data=None, user=None, user_id=None, format="json"):
        request = getattr(self.factory, method)("/", data or {}, format=format)
        request.tenant = self.tenant
        force_authenticate(request, user or self.user)
        return cls.as_view()(request, **({"user_id": user_id} if user_id is not None else {}))

    def test_role_controls_cms_read_write_and_tenant_isolation(self):
        role = TenantRole.objects.create(tenant=self.tenant, name="Reader", permissions=["page.read"])
        role.users.add(self.user)
        for path, method, expected in [
            ("/api/v1/webpages/pages/", "get", True),
            ("/api/v1/webpages/pages/", "post", False),
            ("/api/v1/media/files/", "get", False),
            ("/api/v1/utils/roles/", "post", False),
        ]:
            request = getattr(self.factory, method)(path)
            request.tenant, request.user = self.tenant, self.user
            self.assertEqual(allows_request(request), expected, (path, method))
        self.assertNotIn("support.read", permissions_for(self.user, self.tenant))
        self.assertEqual(permissions_for(self.outsider, self.tenant), set())
        self.assertNotIn("support.read", permissions_for(self.owner, self.tenant))

    def test_role_manager_cannot_assign_foreign_users_and_members_cannot_escalate(self):
        payload = {"name": "Editor", "permissions": ["page.read", "page.write"], "users": [self.user.pk]}
        self.assertEqual(self.call(RolesView, "post", payload).status_code, 403)
        self.assertEqual(
            self.call(RolesView, "post", {**payload, "users": [self.outsider.pk]}, user=self.owner).status_code, 400
        )
        response = self.call(RolesView, "post", payload, user=self.owner)
        self.assertEqual(response.status_code, 200, response.data)
        self.assertIn("page.write", permissions_for(self.user, self.tenant))
        self.assertEqual(self.call(RolesView).data["roles"], [])

    def test_member_roles_are_editable_in_one_request_and_admin_grants_need_owner(self):
        manager = TenantRole.objects.create(tenant=self.tenant, name="Manager", permissions=["roles.manage"])
        manager.users.add(self.user)
        reader = TenantRole.objects.create(tenant=self.tenant, name="Reader", permissions=["page.read"])
        response = self.call(RolesView, user=self.owner)
        member = next(item for item in response.data["members"] if item["id"] == self.user.pk)
        self.assertEqual(member["role_ids"], [str(manager.pk)])
        self.assertIn("roles.manage", member["permissions"])

        response = self.call(
            RolesView, "patch", {"user_id": self.user.pk, "role_ids": [str(reader.pk)]}, user=self.owner
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(permissions_for(self.user, self.tenant), {"page.read"})
        self.assertEqual(
            self.call(RolesView, "patch", {"user_id": self.user.pk, "role_ids": [str(manager.pk)]}).status_code,
            403,
        )

        manager.users.add(self.user)
        admin = TenantRole.objects.create(tenant=self.tenant, name="Admin", permissions=["tenant.admin"])
        self.assertEqual(
            self.call(RolesView, "patch", {"user_id": self.user.pk, "role_ids": [str(admin.pk)]}).status_code,
            403,
        )
        self.assertEqual(
            self.call(
                RolesView, "post", {"name": "New admin", "permissions": ["tenant.admin"], "users": []}
            ).status_code,
            403,
        )

    def test_staff_flag_does_not_grant_workspace_or_global_account_access(self):
        self.user.is_staff = True
        self.user.save(update_fields=["is_staff"])
        role = TenantRole.objects.create(tenant=self.tenant, name="Workspace admin", permissions=["tenant.admin"])
        role.users.add(self.user)
        self.assertIn("roles.manage", permissions_for(self.user, self.tenant))
        self.assertNotIn("support.read", permissions_for(self.user, self.tenant))
        request = self.factory.get("/api/v1/utils/users/")
        request.tenant, request.user = self.tenant, self.user
        self.assertFalse(allows_request(request))
        from utils.views import UserListView

        self.assertEqual(self.call(UserListView).status_code, 403)

    def test_system_owner_can_run_global_admin_actions_without_selected_workspace(self):
        system_owner = User.objects.create_superuser("global-system-owner", password="test")
        self.assertTrue(is_tenant_admin(system_owner, None))
        self.assertFalse(is_tenant_admin(self.user, None))

    def test_system_owner_can_add_existing_account_with_an_explicit_workspace_role(self):
        system_owner = User.objects.create_superuser("system-owner", password="test")
        role = TenantRole.objects.create(tenant=self.tenant, name="Reader", permissions=["page.read"])
        payload = {"user_id": self.outsider.pk, "role_ids": [str(role.pk)]}
        self.assertEqual(self.call(WorkspaceMemberView, "post", payload, user=self.owner).status_code, 403)
        self.assertEqual(
            self.call(WorkspaceMemberView, "post", {**payload, "role_ids": []}, user=system_owner).status_code, 400
        )
        response = self.call(WorkspaceMemberView, "post", payload, user=system_owner)
        self.assertEqual(response.status_code, 200, response.data)
        self.assertTrue(self.tenant.members.filter(pk=self.outsider.pk).exists())
        self.assertEqual(permissions_for(self.outsider, self.tenant), {"page.read"})

    def test_photo_upload_is_reencoded_private_and_owner_editable(self):
        stream = io.BytesIO()
        Image.new("RGB", (300, 200), "red").save(stream, "PNG")
        file = SimpleUploadedFile("photo.png", stream.getvalue(), content_type="image/png")
        result = self.call(ProfilePhotoView, "put", {"file": file}, user_id=self.user.pk, format="multipart")
        self.assertEqual(result.status_code, 200, result.data)
        photo = ProfilePhoto.objects.get(user=self.user)
        with Image.open(io.BytesIO(bytes(photo.image))) as image:
            self.assertEqual(image.size, (256, 256))
            self.assertEqual(image.format, "JPEG")
        self.assertEqual(self.call(ProfilePhotoView, user=self.owner, user_id=self.user.pk).status_code, 200)
        self.assertEqual(self.call(ProfilePhotoView, user=self.outsider, user_id=self.user.pk).status_code, 403)
        self.assertEqual(self.call(ProfilePhotoView, "delete", user=self.owner, user_id=self.user.pk).status_code, 403)
        self.assertEqual(self.call(ProfilePhotoView, "delete", user_id=self.user.pk).status_code, 200)
        self.assertEqual(self.call(ProfilePhotoView, user_id=self.user.pk).status_code, 404)

    def test_existing_designer_assignment_keeps_its_bounded_access(self):
        from webpages.models import PageTheme, ThemeDesignerAssignment

        theme = PageTheme.objects.create(tenant=self.tenant, created_by=self.owner, name="Assigned theme")
        ThemeDesignerAssignment.objects.create(
            tenant=self.tenant, theme=theme, user=self.outsider, created_by=self.owner
        )
        permissions = permissions_for(self.outsider, self.tenant)
        self.assertIn("theme.write", permissions)
        self.assertNotIn("page.write", permissions)
        self.assertNotIn("roles.manage", permissions)

    def test_empty_cms_role_preserves_explicit_direct_support_grants(self):
        from tenant_support.models import SupportRole
        from tenant_support.views import ContextView

        role = TenantRole.objects.create(tenant=self.tenant, name="No content permissions", permissions=[])
        role.users.add(self.user)
        SupportRole.objects.create(tenant=self.tenant, user=self.user, can_support=True, can_publish=True)
        request = self.factory.get("/api/v1/support/context/")
        request.tenant, request.user = self.tenant, self.user
        self.assertTrue(allows_request(request))
        response = self.call(ContextView)
        self.assertEqual(response.status_code, 200, response.data)
        self.assertTrue(response.data["can_support"])
        self.assertTrue(response.data["can_publish"])

    def test_media_retains_namespace_authorization_for_outside_users(self):
        request = self.factory.get("/api/v1/media/files/00000000-0000-0000-0000-000000000000/")
        request.tenant, request.user = self.tenant, self.outsider
        self.assertTrue(allows_request(request))
        role = TenantRole.objects.create(tenant=self.tenant, name="No media", permissions=["page.read"])
        role.users.add(self.user)
        request.user = self.user
        self.assertFalse(allows_request(request))
