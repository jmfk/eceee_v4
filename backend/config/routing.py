"""
WebSocket routing configuration for Django Channels
"""
from django.urls import path
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack

from webpages.consumers import PageEditorConsumer

websocket_urlpatterns = [
    path('ws/pages/<int:page_id>/editor/', PageEditorConsumer.as_asgi()),
]

application = ProtocolTypeRouter({
    'websocket': AuthMiddlewareStack(
        URLRouter(websocket_urlpatterns)
    ),
})
