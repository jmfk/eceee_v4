from django.db import connection
from django.test import TestCase


class MediaFunctionPrivilegeTests(TestCase):
    def test_internal_media_functions_do_not_grant_public_execute(self):
        if connection.vendor != "postgresql":
            self.skipTest("PostgreSQL function ACLs required")
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT routine.proname,
                       EXISTS (
                           SELECT 1 FROM aclexplode(
                               COALESCE(routine.proacl, acldefault('f', routine.proowner))
                           ) acl
                           WHERE acl.grantee = 0 AND acl.privilege_type = 'EXECUTE'
                       )
                FROM pg_proc routine JOIN pg_namespace ns ON ns.oid = routine.pronamespace
                WHERE ns.nspname = 'public'
                  AND routine.proname IN ('taxonomy_check_media', 'taxonomy_media_constraint')
                ORDER BY routine.proname
                """
            )
            self.assertEqual(cursor.fetchall(), [("taxonomy_check_media", False), ("taxonomy_media_constraint", False)])
            # Revocation must preserve the owning application's ability to call the helper.
            cursor.execute("SELECT taxonomy_check_media('file', %s::uuid)", ["00000000-0000-0000-0000-000000000001"])
