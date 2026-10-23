import importlib

from django.apps import apps
from django.contrib.auth.models import User
from django.db import connection
from django.test import TestCase
from rest_framework.test import APIRequestFactory, force_authenticate

from core.models import Tenant

from .models import Board, Card, Column
from .views import BoardViewSet, ColumnViewSet


class RequiredColumnsTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user("lists-owner")
        self.tenant = Tenant.objects.create(name="Lists", identifier="lists", created_by=self.user)
        self.factory = APIRequestFactory()

    def call(self, cls, action, data, pk=None):
        request = self.factory.post("/", data, format="json")
        request.tenant = self.tenant
        force_authenticate(request, self.user)
        return cls.as_view({"post": action})(request, **({"pk": str(pk)} if pk else {}))

    def test_created_board_has_protected_ordinary_lists(self):
        response = self.call(BoardViewSet, "create", {"title": "New"})
        self.assertEqual(response.status_code, 201)
        board = Board.objects.get(pk=response.data["id"])
        self.assertEqual(set(board.columns.values_list("role", flat=True)), {"inbox", "done", "archive"})
        for column in board.columns.all():
            response = self.call(
                ColumnViewSet, "partial_update", {"revision": column.revision, "archived": True}, column.pk
            )
            self.assertEqual(response.status_code, 400)
            response = self.call(
                ColumnViewSet, "partial_update", {"revision": column.revision, "title": "Renamed"}, column.pk
            )
            self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(board.columns.count(), 3)

    def test_upgrade_reuses_existing_done_and_preserves_cards_and_is_idempotent(self):
        board = Board.objects.create(tenant=self.tenant, title="Old")
        done = Column.objects.create(tenant=self.tenant, board=board, title="Done", archived=True)
        card = Card.objects.create(tenant=self.tenant, column=done, number=1, title="Existing")
        module = importlib.import_module("kanban.migrations.0002_board_members_column_role_and_more")
        with connection.schema_editor(atomic=False) as editor:
            module.ensure_lists(apps, editor)
            module.ensure_lists(apps, editor)
        done.refresh_from_db()
        card.refresh_from_db()
        self.assertEqual(done.role, "done")
        self.assertFalse(done.archived)
        self.assertEqual(card.column_id, done.pk)
        self.assertEqual(board.columns.count(), 3)
        self.assertTrue(board.members.filter(pk=self.user.pk).exists())
