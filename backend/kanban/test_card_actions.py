from unittest.mock import patch

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIRequestFactory, force_authenticate

from core.models import Tenant

from .models import Board, Card, Column, Label
from .views import BoardViewSet, CardViewSet, ColumnViewSet


class BoardActionsTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user("board-owner")
        self.member = User.objects.create_user("board-member")
        self.outsider = User.objects.create_user("other-workspace-user")
        self.tenant = Tenant.objects.create(name="Board actions", identifier="board-actions", created_by=self.owner)
        self.tenant.members.add(self.member)
        self.board = Board.objects.create(tenant=self.tenant, title="Work")
        self.factory = APIRequestFactory()

    def call(self, user, method, action, data=None):
        request = getattr(self.factory, method)("/", data or {}, format="json")
        request.tenant = self.tenant
        force_authenticate(request, user)
        return BoardViewSet.as_view({method: action})(request, pk=str(self.board.pk))

    def test_workspace_admin_can_select_any_active_user(self):
        response = self.call(self.owner, "get", "available_members")
        self.assertEqual(response.status_code, 200)
        self.assertIn(self.outsider.pk, {item["id"] for item in response.data})
        response = self.call(
            self.owner, "post", "set_members", {"revision": self.board.revision, "members": [self.outsider.pk]}
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertTrue(self.tenant.members.filter(pk=self.outsider.pk).exists())
        self.assertTrue(self.board.members.filter(pk=self.outsider.pk).exists())

    def test_ordinary_member_cannot_invite_user_outside_workspace(self):
        response = self.call(self.member, "get", "available_members")
        self.assertNotIn(self.outsider.pk, {item["id"] for item in response.data})
        response = self.call(
            self.member, "post", "set_members", {"revision": self.board.revision, "members": [self.outsider.pk]}
        )
        self.assertEqual(response.status_code, 403)
        self.assertFalse(self.tenant.members.filter(pk=self.outsider.pk).exists())
        self.assertFalse(self.board.members.filter(pk=self.outsider.pk).exists())

    def test_inactive_users_cannot_be_added(self):
        self.outsider.is_active = False
        self.outsider.save(update_fields=["is_active"])
        response = self.call(
            self.owner, "post", "set_members", {"revision": self.board.revision, "members": [self.outsider.pk]}
        )
        self.assertEqual(response.status_code, 400)


class CardActionsTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user("card-actions")
        self.tenant = Tenant.objects.create(name="Actions", identifier="actions", created_by=self.user)
        self.foreign = Tenant.objects.create(name="Foreign", identifier="foreign-actions", created_by=self.user)
        self.board = Board.objects.create(tenant=self.tenant, title="Work")
        self.column = Column.objects.create(tenant=self.tenant, board=self.board, title="To do")
        self.target = Column.objects.create(tenant=self.tenant, board=self.board, title="Done")
        self.foreign_board = Board.objects.create(tenant=self.foreign, title="Other")
        self.foreign_column = Column.objects.create(tenant=self.foreign, board=self.foreign_board, title="Other")
        self.card = Card.objects.create(
            tenant=self.tenant,
            column=self.column,
            number=1,
            title="Original",
            cover_color="green",
            description="Shared description",
            checklist=[{"id": "a", "text": "Check", "done": False}],
        )
        self.card.assignees.add(self.user)
        self.label = Label.objects.create(tenant=self.tenant, name="Important")
        self.card.labels.add(self.label)
        self.factory = APIRequestFactory()

    def call(self, action, data, card=None):
        request = self.factory.post("/", data, format="json")
        request.tenant = self.tenant
        force_authenticate(request, self.user)
        with patch("kanban.services.enqueue_index"), patch("kanban.views.enqueue_index"):
            return CardViewSet.as_view({"post": action})(request, pk=str((card or self.card).pk))

    def duplicate(self, mirror=False, column=None, card=None):
        card = card or self.card
        return self.call(
            "duplicate", {"revision": card.revision, "column": str((column or self.target).pk), "mirror": mirror}, card
        )

    def test_copy_is_independent_and_preserves_content(self):
        response = self.duplicate()
        self.assertEqual(response.status_code, 201, response.data)
        copy = Card.objects.get(pk=response.data["id"])
        self.assertIsNone(copy.mirror_of_id)
        self.assertEqual(copy.description, self.card.description)
        self.assertEqual(copy.checklist, self.card.checklist)
        self.assertEqual(copy.cover_color, "green")
        self.assertEqual(list(copy.assignees.all()), [self.user])
        self.assertEqual(list(copy.labels.all()), [self.label])
        self.assertFalse(copy.comments.exists())
        self.assertFalse(copy.attachments.exists())
        self.call("partial_update", {"revision": self.card.revision, "title": "Updated"})
        copy.refresh_from_db()
        self.assertEqual(copy.title, "Original")

    def test_mirror_shares_content_but_has_independent_position_and_archive(self):
        response = self.duplicate(mirror=True)
        self.assertEqual(response.status_code, 201, response.data)
        mirror = Card.objects.get(pk=response.data["id"])
        revision = mirror.revision
        self.assertEqual(mirror.mirror_of_id, self.card.id)
        response = self.call(
            "partial_update",
            {
                "revision": self.card.revision,
                "title": "Updated",
                "assignees": [],
                "labels": [],
                "cover_color": "purple",
            },
        )
        self.assertEqual(response.status_code, 200, response.data)
        mirror.refresh_from_db()
        self.assertEqual(mirror.title, "Updated")
        self.assertEqual(mirror.cover_color, "purple")
        self.assertFalse(mirror.assignees.exists())
        self.assertFalse(mirror.labels.exists())
        self.assertGreater(mirror.revision, revision)
        self.assertEqual(mirror.column_id, self.target.id)
        response = self.call("partial_update", {"revision": revision, "archived": True}, mirror)
        self.assertEqual(response.status_code, 409)
        response = self.call("partial_update", {"revision": mirror.revision, "archived": True}, mirror)
        self.assertEqual(response.status_code, 200)
        self.card.refresh_from_db()
        self.assertFalse(self.card.archived)

    def test_mirror_chains_are_flattened_and_shared_edits_use_original(self):
        response = self.duplicate(mirror=True)
        mirror = Card.objects.get(pk=response.data["id"])
        response = self.duplicate(mirror=True, card=mirror)
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(str(response.data["mirror_of"]), str(self.card.id))
        response = self.call("partial_update", {"revision": mirror.revision, "title": "Wrong"}, mirror)
        self.assertEqual(response.status_code, 400)

    def test_source_revision_and_destination_tenant_are_checked(self):
        self.assertEqual(self.duplicate(column=self.foreign_column).status_code, 404)
        self.assertEqual(Card.objects.count(), 1)
        self.assertEqual(self.call("duplicate", {"revision": 99, "column": str(self.target.pk)}).status_code, 409)
        self.target.archived = True
        self.target.save()
        self.assertEqual(self.duplicate().status_code, 400)

    def test_cover_palette_is_validated(self):
        self.assertEqual(self.call("partial_update", {"revision": 1, "cover_color": "url(secret)"}).status_code, 400)
        self.assertEqual(self.call("partial_update", {"revision": 1, "cover_color": ""}).status_code, 200)

    def test_column_copy_is_atomic_and_does_not_copy_required_role(self):
        request = self.factory.post("/", {"revision": self.column.revision}, format="json")
        request.tenant = self.tenant
        force_authenticate(request, self.user)
        with patch("kanban.services.enqueue_index"):
            response = ColumnViewSet.as_view({"post": "duplicate"})(request, pk=str(self.column.pk))
        self.assertEqual(response.status_code, 201, response.data)
        column = Column.objects.get(pk=response.data["id"])
        self.assertEqual(column.role, "")
        self.assertEqual(column.cards.count(), 1)
        self.assertEqual(column.cards.get().title, self.card.title)
        before = Column.objects.count()
        request = self.factory.post("/", {"revision": self.column.revision}, format="json")
        request.tenant = self.tenant
        force_authenticate(request, self.user)
        with (
            patch("kanban.services.duplicate_card", side_effect=ValueError("copy interrupted")),
            patch("kanban.views.duplicate_card", side_effect=ValueError("copy interrupted")),
        ):
            with self.assertRaises(ValueError):
                ColumnViewSet.as_view({"post": "duplicate"})(request, pk=str(self.column.pk))
        self.assertEqual(Column.objects.count(), before)
