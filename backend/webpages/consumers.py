"""
WebSocket consumers for real-time page editing notifications
"""
import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth.models import AnonymousUser


class PageEditorConsumer(AsyncWebsocketConsumer):
    """
    WebSocket consumer for page editor notifications.
    
    Joins a room specific to the page being edited and broadcasts
    when the page version is updated by another user.
    """
    
    async def connect(self):
        """Accept WebSocket connection and join page room"""
        self.page_id = self.scope['url_route']['kwargs']['page_id']
        self.room_group_name = f'page_editor_{self.page_id}'
        
        # Join room group
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )
        
        await self.accept()
        
        # Send confirmation message
        await self.send(text_data=json.dumps({
            'type': 'connection_established',
            'page_id': self.page_id,
            'message': f'Connected to page {self.page_id} editor'
        }))
    
    async def disconnect(self, close_code):
        """Leave room group on disconnect"""
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )
    
    async def receive(self, text_data):
        """Handle incoming WebSocket messages (optional)"""
        # Could handle ping/pong or other client messages here
        pass
    
    async def version_updated(self, event):
        """
        Broadcast version update to all clients in the room.
        
        Called when a version is saved via channel layer group_send.
        """
        # Send message to WebSocket
        await self.send(text_data=json.dumps({
            'type': 'version_updated',
            'page_id': event['page_id'],
            'version_id': event['version_id'],
            'updated_at': event['updated_at'],
            'updated_by': event.get('updated_by'),
            'session_id': event.get('session_id'),
            'message': event.get('message', 'Page version updated')
        }))


def broadcast_version_update(page_id, version_id, updated_at, updated_by=None, session_id=None):
    """
    Helper function to broadcast version updates.
    
    Call this from views/serializers when a version is saved.
    
    Args:
        page_id: ID of the page
        version_id: ID of the version that was updated
        updated_at: Timestamp when version was updated (ISO format)
        updated_by: Username of the user who made the update (optional)
        session_id: Session ID of the client that made the update (optional)
    """
    from channels.layers import get_channel_layer
    from asgiref.sync import async_to_sync
    
    channel_layer = get_channel_layer()
    room_group_name = f'page_editor_{page_id}'
    
    async_to_sync(channel_layer.group_send)(
        room_group_name,
        {
            'type': 'version_updated',
            'page_id': page_id,
            'version_id': version_id,
            'updated_at': updated_at,
            'updated_by': updated_by,
            'session_id': session_id,
        }
    )


