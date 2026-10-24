from asgiref.sync import async_to_sync
from channels.db import database_sync_to_async
from channels.layers import get_channel_layer
from channels.routing import URLRouter
from channels.testing import WebsocketCommunicator
from django.contrib.auth.models import AnonymousUser, User
from django.test import Client, TransactionTestCase, override_settings

from config.routing import websocket_urlpatterns
from core.models import Tenant, TenantRole
from utils.middleware.dev_auth import DevAutoLoginASGIMiddleware
from webpages.models import WebPage

IN_MEMORY_CHANNEL_LAYERS = {
    "default": {"BACKEND": "channels.layers.InMemoryChannelLayer"},
}


@override_settings(CHANNEL_LAYERS=IN_MEMORY_CHANNEL_LAYERS)
class PageEditorConsumerTest(TransactionTestCase):
    reset_sequences = True

    def setUp(self):
        self.owner = User.objects.create_user("socket-owner")
        self.member = User.objects.create_user("socket-member")
        self.outsider = User.objects.create_user("socket-outsider")
        self.staff = User.objects.create_user("socket-staff", is_staff=True)
        self.tenant = Tenant.objects.create(name="Socket tenant", identifier="socket", created_by=self.owner)
        self.tenant.members.add(self.member, self.staff)
        self.page = WebPage.objects.create(
            title="Socket page",
            slug="socket-page",
            tenant=self.tenant,
            created_by=self.owner,
            last_modified_by=self.owner,
        )
        self.application = DevAutoLoginASGIMiddleware(URLRouter(websocket_urlpatterns))

    async def connect_as(self, user):
        communicator = WebsocketCommunicator(
            self.application,
            f"/ws/pages/{self.page.pk}/editor/",
        )
        communicator.scope["user"] = user
        if user.is_authenticated:

            @database_sync_to_async
            def authenticated_session():
                client = Client()
                client.force_login(user, backend="django.contrib.auth.backends.ModelBackend")
                return client.session

            communicator.scope["session"] = await authenticated_session()
        connected, _ = await communicator.connect()
        return communicator, connected

    def test_anonymous_and_unrelated_tenant_users_are_denied(self):
        async def scenario():
            for user in (AnonymousUser(), self.outsider):
                communicator, connected = await self.connect_as(user)
                self.assertTrue(connected)
                message = await communicator.receive_json_from()
                self.assertEqual(message["type"], "auth_failure")
                self.assertEqual(message["code"], "FORBIDDEN")
                await communicator.wait()

        async_to_sync(scenario)()

    @override_settings(DEBUG=True)
    def test_debug_auto_login_authenticates_websocket_scope(self):
        async def scenario():
            communicator = WebsocketCommunicator(
                self.application,
                f"/ws/pages/{self.page.pk}/editor/",
            )
            connected, _ = await communicator.connect()

            self.assertTrue(connected)
            established = await communicator.receive_json_from()
            self.assertEqual(established["type"], "connection_established")
            await communicator.disconnect()

        async_to_sync(scenario)()

    def test_tenant_member_receives_content_free_presence_metadata(self):
        async def scenario():
            owner, owner_connected = await self.connect_as(self.owner)
            self.assertTrue(owner_connected)
            await owner.receive_json_from()  # connection_established
            await owner.receive_json_from()  # own join

            member, member_connected = await self.connect_as(self.member)
            self.assertTrue(member_connected)
            await member.receive_json_from()  # connection_established
            presence = await owner.receive_json_from()

            self.assertEqual(presence["type"], "presence")
            self.assertEqual(presence["action"], "join")
            self.assertEqual(presence["user"]["username"], self.member.username)
            self.assertEqual(
                set(presence), {"type", "action", "page_id", "connection_id", "user", "section", "widget_id"}
            )
            self.assertNotIn("widgets", presence)
            self.assertNotIn("page_data", presence)

            await member.disconnect()
            await owner.disconnect()

        async_to_sync(scenario)()

    def test_staff_can_connect_to_the_page_group(self):
        async def scenario():
            communicator, connected = await self.connect_as(self.staff)
            self.assertTrue(connected)
            established = await communicator.receive_json_from()
            self.assertEqual(established["type"], "connection_established")
            await communicator.disconnect()

        async_to_sync(scenario)()

    def test_members_and_staff_without_page_read_cannot_connect(self):
        role = TenantRole.objects.create(tenant=self.tenant, name="No page access", permissions=["kanban.read"])
        role.users.add(self.member, self.staff)

        async def scenario():
            for user in (self.member, self.staff):
                communicator, connected = await self.connect_as(user)
                self.assertTrue(connected)
                self.assertEqual((await communicator.receive_json_from())["type"], "auth_failure")
                await communicator.wait()

        async_to_sync(scenario)()

    def test_page_reader_can_connect_but_revocation_stops_version_events(self):
        role = TenantRole.objects.create(tenant=self.tenant, name="Page reader", permissions=["page.read"])
        role.users.add(self.member)

        async def scenario():
            communicator, connected = await self.connect_as(self.member)
            self.assertTrue(connected)
            self.assertEqual((await communicator.receive_json_from())["type"], "connection_established")
            await communicator.receive_json_from()  # own join
            await database_sync_to_async(TenantRole.objects.filter(pk=role.pk).update)(permissions=[])
            await get_channel_layer().group_send(
                f"page_editor_{self.page.pk}",
                {
                    "type": "version_updated",
                    "page_id": self.page.pk,
                    "version_id": 1,
                    "updated_at": "2026-10-23T00:00:00Z",
                },
            )
            self.assertEqual((await communicator.receive_json_from())["type"], "auth_failure")
            output = await communicator.receive_output()
            self.assertEqual(output["type"], "websocket.close")
            self.assertEqual(output["code"], 4003)
            await communicator.disconnect()

        async_to_sync(scenario)()
