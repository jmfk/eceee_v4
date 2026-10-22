"""
WebSocket routing configuration for Django Channels
"""

from channels.auth import AuthMiddlewareStack
from channels.routing import ProtocolTypeRouter, URLRouter
from django.urls import path

from kanban.consumers import KanbanConsumer
from webpages.consumers import PageEditorConsumer

websocket_urlpatterns = [
    path("ws/kanban/<uuid:tenant_id>/", KanbanConsumer.as_asgi()),
    path("ws/pages/<int:page_id>/editor/", PageEditorConsumer.as_asgi()),
]

application = ProtocolTypeRouter(
    {
        "websocket": AuthMiddlewareStack(URLRouter(websocket_urlpatterns)),
    }
)
