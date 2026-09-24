from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIRequestFactory, force_authenticate

from core.models import Tenant
from utils.views import UserListView
from webpages.models import PageTheme, ThemeDesignerAssignment


class UserListQueryTests(TestCase):
    def test_user_list_access_fields_use_bounded_queries(self):
        admin = User.objects.create_superuser("admin", password="test")
        designer = User.objects.create_user("designer", password="test")
        tenant = Tenant.objects.create(name="Tenant", identifier="tenant", created_by=admin)
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
        serialized_designer = next(user for user in response.data["users"] if user["username"] == "designer")
        self.assertTrue(serialized_designer["is_designer_only"])
        self.assertFalse(serialized_designer["has_tenant_admin_access"])
        self.assertEqual(serialized_designer["designer_tenants"][0]["identifier"], "tenant")
