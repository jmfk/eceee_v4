"""
Tests for the standardized Widget API.
"""

from django.test import TestCase
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status
import json

from ..models import WebPage, PageVersion
from ..widget_registry import widget_type_registry

User = get_user_model()


class WidgetAPITestCase(TestCase):
    """Test case for Widget API endpoints."""
    
    def setUp(self):
        """Set up test data."""
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        self.client.force_authenticate(user=self.user)
        
        # Create a test page
        self.page = WebPage.objects.create(
            title='Test Page',
            slug='test-page',
            parent=None
        )
        
        # Create a test version
        self.version = PageVersion.objects.create(
            page=self.page,
            version_number=1,
            title='Test Page',
            widgets=[]
        )
    
    def test_widget_types_list(self):
        """Test listing all widget types."""
        response = self.client.get('/api/webpages/widgets/types/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsInstance(response.data, list)
        
        # Check that we have some widget types
        self.assertGreater(len(response.data), 0)
        
        # Check structure of widget type data
        if response.data:
            widget_type = response.data[0]
            self.assertIn('slug', widget_type)
            self.assertIn('name', widget_type)
            self.assertIn('description', widget_type)
            self.assertIn('configuration_schema', widget_type)
    
    def test_widget_types_list_with_search(self):
        """Test searching widget types."""
        response = self.client.get('/api/webpages/widgets/types/', {'search': 'text'})
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Should find Text Block widget
        widget_names = [w['name'] for w in response.data]
        self.assertIn('Text Block', widget_names)
    
    def test_widget_type_detail(self):
        """Test getting details of a specific widget type."""
        # Get Text Block widget details
        response = self.client.get('/api/webpages/widgets/types/text-block/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['slug'], 'text-block')
        self.assertEqual(response.data['name'], 'Text Block')
        self.assertIn('configuration_schema', response.data)
        self.assertIn('configuration_defaults', response.data)
    
    def test_widget_type_not_found(self):
        """Test getting details of non-existent widget type."""
        response = self.client.get('/api/webpages/widgets/types/non-existent/')
        
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertIn('error', response.data)
    
    def test_validate_widget_configuration_valid(self):
        """Test validating valid widget configuration."""
        config = {
            'title': 'Test Title',
            'content': 'Test content',
            'alignment': 'left'
        }
        
        response = self.client.post(
            '/api/webpages/widgets/types/text-block/validate/',
            {'configuration': config},
            format='json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['is_valid'])
        self.assertEqual(response.data['errors'], {})
    
    def test_validate_widget_configuration_invalid(self):
        """Test validating invalid widget configuration."""
        config = {
            'title': 'Test Title',
            # Missing required 'content' field
            'alignment': 'invalid-alignment'
        }
        
        response = self.client.post(
            '/api/webpages/widgets/types/text-block/validate/',
            {'configuration': config},
            format='json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data['is_valid'])
        self.assertIn('content', response.data['errors'])
    
    def test_render_widget_preview(self):
        """Test rendering widget preview."""
        config = {
            'title': 'Preview Title',
            'content': '<p>Preview content</p>',
            'alignment': 'center'
        }
        
        response = self.client.post(
            '/api/webpages/widgets/types/text-block/preview/',
            {'configuration': config},
            format='json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('html', response.data)
        self.assertIn('configuration', response.data)
        
        # Check that content is in the rendered HTML
        self.assertIn('Preview Title', response.data['html'])
        self.assertIn('Preview content', response.data['html'])
    
    def test_get_page_widgets_empty(self):
        """Test getting widgets for a page with no widgets."""
        response = self.client.get(f'/api/webpages/widgets/pages/{self.page.id}/widgets/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['page_id'], self.page.id)
        self.assertEqual(response.data['widgets'], [])
    
    def test_create_widget(self):
        """Test creating a new widget."""
        widget_data = {
            'type': 'text-block',
            'slot': 'main',
            'configuration': {
                'title': 'New Widget',
                'content': 'Widget content',
                'alignment': 'left'
            }
        }
        
        response = self.client.post(
            f'/api/webpages/widgets/pages/{self.page.id}/widgets/create/',
            widget_data,
            format='json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn('id', response.data)
        self.assertEqual(response.data['type'], 'Text Block')
        self.assertEqual(response.data['slot'], 'main')
        
        # Verify widget was saved
        self.version.refresh_from_db()
        self.assertEqual(len(self.version.widgets), 1)
    
    def test_create_widget_invalid_type(self):
        """Test creating widget with invalid type."""
        widget_data = {
            'type': 'invalid-type',
            'slot': 'main',
            'configuration': {}
        }
        
        response = self.client.post(
            f'/api/webpages/widgets/pages/{self.page.id}/widgets/create/',
            widget_data,
            format='json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('error', response.data)
    
    def test_update_widget(self):
        """Test updating a widget."""
        # First create a widget
        widget_id = 'test-widget-123'
        self.version.widgets = [{
            'id': widget_id,
            'type': 'Text Block',
            'type_slug': 'text-block',
            'slot': 'main',
            'order': 0,
            'config': {
                'title': 'Original Title',
                'content': 'Original content',
                'alignment': 'left'
            }
        }]
        self.version.save()
        
        # Update the widget
        update_data = {
            'configuration': {
                'title': 'Updated Title',
                'content': 'Updated content',
                'alignment': 'center'
            },
            'slot': 'sidebar'
        }
        
        response = self.client.put(
            f'/api/webpages/widgets/pages/{self.page.id}/widgets/{widget_id}/',
            update_data,
            format='json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['config']['title'], 'Updated Title')
        self.assertEqual(response.data['slot'], 'sidebar')
        
        # Verify widget was updated
        self.version.refresh_from_db()
        updated_widget = self.version.widgets[0]
        self.assertEqual(updated_widget['config']['title'], 'Updated Title')
        self.assertEqual(updated_widget['slot'], 'sidebar')
    
    def test_delete_widget(self):
        """Test deleting a widget."""
        # First create a widget
        widget_id = 'test-widget-123'
        self.version.widgets = [{
            'id': widget_id,
            'type': 'Text Block',
            'slot': 'main',
            'config': {}
        }]
        self.version.save()
        
        # Delete the widget
        response = self.client.delete(
            f'/api/webpages/widgets/pages/{self.page.id}/widgets/{widget_id}/delete/'
        )
        
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        
        # Verify widget was deleted
        self.version.refresh_from_db()
        self.assertEqual(len(self.version.widgets), 0)
    
    def test_reorder_widgets(self):
        """Test reordering widgets."""
        # Create multiple widgets
        self.version.widgets = [
            {'id': 'widget-1', 'type': 'Text Block', 'slot': 'main', 'order': 0},
            {'id': 'widget-2', 'type': 'Image', 'slot': 'main', 'order': 1},
            {'id': 'widget-3', 'type': 'Button', 'slot': 'main', 'order': 2},
        ]
        self.version.save()
        
        # Reorder widgets
        response = self.client.post(
            f'/api/webpages/widgets/pages/{self.page.id}/widgets/reorder/',
            {
                'widgets': ['widget-3', 'widget-1', 'widget-2'],
                'slot': 'main'
            },
            format='json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Verify order was updated
        self.version.refresh_from_db()
        widget_map = {w['id']: w for w in self.version.widgets}
        
        self.assertEqual(widget_map['widget-3']['order'], 0)
        self.assertEqual(widget_map['widget-1']['order'], 1)
        self.assertEqual(widget_map['widget-2']['order'], 2)
    
    def test_duplicate_widget(self):
        """Test duplicating a widget."""
        # First create a widget
        widget_id = 'test-widget-123'
        self.version.widgets = [{
            'id': widget_id,
            'type': 'Text Block',
            'slot': 'main',
            'order': 0,
            'config': {
                'title': 'Original Widget',
                'content': 'Original content'
            }
        }]
        self.version.save()
        
        # Duplicate the widget
        response = self.client.post(
            f'/api/webpages/widgets/pages/{self.page.id}/widgets/{widget_id}/duplicate/'
        )
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertNotEqual(response.data['id'], widget_id)
        self.assertEqual(response.data['config']['title'], 'Original Widget')
        
        # Verify widget was duplicated
        self.version.refresh_from_db()
        self.assertEqual(len(self.version.widgets), 2)
        
        # Check that the duplicate has a different ID
        widget_ids = [w['id'] for w in self.version.widgets]
        self.assertEqual(len(set(widget_ids)), 2)  # Should have 2 unique IDs
    
    def test_authentication_required(self):
        """Test that authentication is required for widget API endpoints."""
        self.client.force_authenticate(user=None)
        
        # Test various endpoints
        endpoints = [
            '/api/webpages/widgets/types/',
            '/api/webpages/widgets/types/text-block/',
            f'/api/webpages/widgets/pages/{self.page.id}/widgets/',
        ]
        
        for endpoint in endpoints:
            response = self.client.get(endpoint)
            self.assertEqual(
                response.status_code,
                status.HTTP_401_UNAUTHORIZED,
                f'Endpoint {endpoint} should require authentication'
            )