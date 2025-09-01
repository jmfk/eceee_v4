"""
Standardized Widget Backend API

Provides a unified, consistent API for all widget operations including:
- Widget type discovery and registration
- Widget configuration validation
- Widget rendering
- Widget CRUD operations
- Widget preview generation
"""

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from django.template import Template, Context
from django.template.loader import render_to_string
from pydantic import ValidationError
import json
import logging

from ..widget_registry import widget_type_registry
from ..models import PageVersion
from .widget_type_views import format_pydantic_errors

logger = logging.getLogger(__name__)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def widget_types_list(request):
    """
    List all available widget types with their schemas and configuration.
    
    Query Parameters:
    - active: Filter by active status (default: true)
    - search: Search in name and description
    - include_schema: Include JSON schema (default: true)
    - include_defaults: Include default values (default: false)
    """
    active_only = request.query_params.get('active', 'true').lower() == 'true'
    include_schema = request.query_params.get('include_schema', 'true').lower() == 'true'
    include_defaults = request.query_params.get('include_defaults', 'false').lower() == 'true'
    search = request.query_params.get('search', '')
    
    widget_types = []
    
    for widget_type in widget_type_registry.get_all_widget_types(active_only=active_only):
        widget_data = {
            'slug': widget_type.slug,
            'name': widget_type.name,
            'description': widget_type.description,
            'category': getattr(widget_type, 'category', 'general'),
            'icon': getattr(widget_type, 'icon', 'widget'),
            'is_active': widget_type.is_active,
        }
        
        # Apply search filter
        if search:
            search_lower = search.lower()
            if (search_lower not in widget_type.name.lower() and 
                search_lower not in widget_type.description.lower()):
                continue
        
        if include_schema:
            widget_data['configuration_schema'] = widget_type.configuration_model.model_json_schema()
        
        if include_defaults:
            widget_data['configuration_defaults'] = widget_type.get_configuration_defaults()
        
        widget_types.append(widget_data)
    
    # Sort by name by default
    widget_types.sort(key=lambda x: x['name'])
    
    return Response(widget_types)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def widget_type_detail(request, widget_slug):
    """
    Get detailed information about a specific widget type.
    
    Path Parameters:
    - widget_slug: The slug identifier of the widget type
    """
    widget_type = widget_type_registry.get_widget_type_by_slug(widget_slug)
    
    if not widget_type:
        return Response(
            {'error': f'Widget type "{widget_slug}" not found'},
            status=status.HTTP_404_NOT_FOUND
        )
    
    return Response({
        'slug': widget_type.slug,
        'name': widget_type.name,
        'description': widget_type.description,
        'category': getattr(widget_type, 'category', 'general'),
        'icon': getattr(widget_type, 'icon', 'widget'),
        'is_active': widget_type.is_active,
        'configuration_schema': widget_type.configuration_model.model_json_schema(),
        'configuration_defaults': widget_type.get_configuration_defaults(),
        'template_name': widget_type.template_name,
        'css_variables': getattr(widget_type, 'css_variables', {}),
        'widget_css': getattr(widget_type, 'widget_css', ''),
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def validate_widget_configuration(request, widget_slug):
    """
    Validate widget configuration against its schema.
    
    Path Parameters:
    - widget_slug: The slug identifier of the widget type
    
    Request Body:
    - configuration: The widget configuration to validate
    """
    widget_type = widget_type_registry.get_widget_type_by_slug(widget_slug)
    
    if not widget_type:
        return Response(
            {'error': f'Widget type "{widget_slug}" not found'},
            status=status.HTTP_404_NOT_FOUND
        )
    
    configuration = request.data.get('configuration', {})
    
    try:
        # Validate using Pydantic model
        validated_config = widget_type.configuration_model(**configuration)
        
        return Response({
            'is_valid': True,
            'validated_configuration': validated_config.model_dump(),
            'errors': {},
            'warnings': {}
        })
    except ValidationError as e:
        return Response({
            'is_valid': False,
            'errors': format_pydantic_errors(e.errors()),
            'warnings': {},
            'raw_errors': e.errors()  # Include for debugging
        })
    except Exception as e:
        logger.error(f"Widget validation error: {str(e)}")
        return Response(
            {'error': f'Validation failed: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def render_widget_preview(request, widget_slug):
    """
    Render a widget preview with the provided configuration.
    
    Path Parameters:
    - widget_slug: The slug identifier of the widget type
    
    Request Body:
    - configuration: The widget configuration
    - context: Additional context for rendering (optional)
    """
    widget_type = widget_type_registry.get_widget_type_by_slug(widget_slug)
    
    if not widget_type:
        return Response(
            {'error': f'Widget type "{widget_slug}" not found'},
            status=status.HTTP_404_NOT_FOUND
        )
    
    configuration = request.data.get('configuration', {})
    context_data = request.data.get('context', {})
    
    try:
        # Validate configuration first
        validated_config = widget_type.configuration_model(**configuration)
        
        # Create widget instance
        widget_instance = widget_type()
        
        # Prepare context for rendering
        context = Context({
            'widget': {
                'config': validated_config.model_dump(),
                'type': widget_type.name,
                'slug': widget_type.slug,
            },
            'request': request,
            **context_data
        })
        
        # Render the widget
        rendered_html = render_to_string(widget_type.template_name, context.flatten())
        
        # Get widget CSS if available
        widget_css = getattr(widget_type, 'widget_css', '')
        css_variables = getattr(widget_type, 'css_variables', {})
        
        return Response({
            'html': rendered_html,
            'css': widget_css,
            'css_variables': css_variables,
            'configuration': validated_config.model_dump()
        })
        
    except ValidationError as e:
        return Response({
            'error': 'Invalid widget configuration',
            'validation_errors': format_pydantic_errors(e.errors())
        }, status=status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        logger.error(f"Widget preview rendering error: {str(e)}")
        return Response(
            {'error': f'Preview rendering failed: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_page_widgets(request, page_id):
    """
    Get all widgets for a specific page.
    
    Path Parameters:
    - page_id: The ID of the page
    
    Query Parameters:
    - version_id: Specific version ID (optional, defaults to current published)
    - include_inherited: Include inherited widgets from parent pages (default: true)
    """
    version_id = request.query_params.get('version_id')
    include_inherited = request.query_params.get('include_inherited', 'true').lower() == 'true'
    
    try:
        if version_id:
            version = get_object_or_404(PageVersion, pk=version_id, page_id=page_id)
        else:
            # Get current published version
            version = PageVersion.objects.filter(
                page_id=page_id,
                is_current=True
            ).first()
            
            if not version:
                # Fall back to latest version
                version = PageVersion.objects.filter(
                    page_id=page_id
                ).order_by('-version_number').first()
        
        if not version:
            return Response({'widgets': []})
        
        widgets_data = []
        widgets = version.widgets or []
        
        for widget in widgets:
            widget_type = widget_type_registry.get_widget_type(widget.get('type'))
            
            if widget_type:
                widget_info = {
                    'id': widget.get('id'),
                    'type': widget.get('type'),
                    'type_slug': widget_type.slug,
                    'type_name': widget_type.name,
                    'slot': widget.get('slot', 'main'),
                    'order': widget.get('order', 0),
                    'configuration': widget.get('config', {}),
                    'is_inherited': widget.get('is_inherited', False),
                    'css_classes': widget.get('css_classes', ''),
                    'is_active': widget.get('is_active', True),
                }
                widgets_data.append(widget_info)
        
        # Sort by slot and order
        widgets_data.sort(key=lambda x: (x['slot'], x['order']))
        
        return Response({
            'page_id': page_id,
            'version_id': version.id,
            'version_number': version.version_number,
            'widgets': widgets_data
        })
        
    except Exception as e:
        logger.error(f"Error fetching page widgets: {str(e)}")
        return Response(
            {'error': f'Failed to fetch widgets: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_widget(request, page_id):
    """
    Create a new widget for a page.
    
    Path Parameters:
    - page_id: The ID of the page
    
    Request Body:
    - type: Widget type slug
    - slot: Widget slot (default: 'main')
    - configuration: Widget configuration
    - order: Widget order (optional)
    """
    widget_type_slug = request.data.get('type')
    slot = request.data.get('slot', 'main')
    configuration = request.data.get('configuration', {})
    order = request.data.get('order')
    
    # Validate widget type exists
    widget_type = widget_type_registry.get_widget_type_by_slug(widget_type_slug)
    if not widget_type:
        return Response(
            {'error': f'Widget type "{widget_type_slug}" not found'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Validate configuration
    try:
        validated_config = widget_type.configuration_model(**configuration)
    except ValidationError as e:
        return Response({
            'error': 'Invalid widget configuration',
            'validation_errors': format_pydantic_errors(e.errors())
        }, status=status.HTTP_400_BAD_REQUEST)
    
    # Get or create the latest version
    latest_version = PageVersion.objects.filter(
        page_id=page_id
    ).order_by('-version_number').first()
    
    if not latest_version:
        return Response(
            {'error': 'No page version found'},
            status=status.HTTP_404_NOT_FOUND
        )
    
    # Add widget to the version
    widgets = latest_version.widgets or []
    
    # Auto-generate order if not provided
    if order is None:
        slot_widgets = [w for w in widgets if w.get('slot') == slot]
        order = len(slot_widgets)
    
    import uuid
    new_widget = {
        'id': str(uuid.uuid4()),
        'type': widget_type.name,
        'type_slug': widget_type.slug,
        'slot': slot,
        'order': order,
        'config': validated_config.model_dump(),
        'is_active': True,
        'css_classes': '',
    }
    
    widgets.append(new_widget)
    latest_version.widgets = widgets
    latest_version.save()
    
    return Response(new_widget, status=status.HTTP_201_CREATED)


@api_view(['PUT', 'PATCH'])
@permission_classes([IsAuthenticated])
def update_widget(request, page_id, widget_id):
    """
    Update a widget configuration.
    
    Path Parameters:
    - page_id: The ID of the page
    - widget_id: The ID of the widget
    
    Request Body:
    - configuration: Updated widget configuration
    - slot: Updated slot (optional)
    - order: Updated order (optional)
    """
    # Get the latest version
    latest_version = PageVersion.objects.filter(
        page_id=page_id
    ).order_by('-version_number').first()
    
    if not latest_version:
        return Response(
            {'error': 'No page version found'},
            status=status.HTTP_404_NOT_FOUND
        )
    
    widgets = latest_version.widgets or []
    widget_index = None
    widget = None
    
    for i, w in enumerate(widgets):
        if w.get('id') == widget_id:
            widget_index = i
            widget = w
            break
    
    if widget is None:
        return Response(
            {'error': f'Widget "{widget_id}" not found'},
            status=status.HTTP_404_NOT_FOUND
        )
    
    # Get widget type for validation
    widget_type = widget_type_registry.get_widget_type(widget.get('type'))
    if not widget_type:
        return Response(
            {'error': f'Widget type "{widget.get("type")}" not found'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Update fields
    if 'configuration' in request.data:
        try:
            validated_config = widget_type.configuration_model(**request.data['configuration'])
            widget['config'] = validated_config.model_dump()
        except ValidationError as e:
            return Response({
                'error': 'Invalid widget configuration',
                'validation_errors': format_pydantic_errors(e.errors())
            }, status=status.HTTP_400_BAD_REQUEST)
    
    if 'slot' in request.data:
        widget['slot'] = request.data['slot']
    
    if 'order' in request.data:
        widget['order'] = request.data['order']
    
    if 'css_classes' in request.data:
        widget['css_classes'] = request.data['css_classes']
    
    if 'is_active' in request.data:
        widget['is_active'] = request.data['is_active']
    
    # Update the widget in the list
    widgets[widget_index] = widget
    latest_version.widgets = widgets
    latest_version.save()
    
    return Response(widget)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def delete_widget(request, page_id, widget_id):
    """
    Delete a widget from a page.
    
    Path Parameters:
    - page_id: The ID of the page
    - widget_id: The ID of the widget
    """
    # Get the latest version
    latest_version = PageVersion.objects.filter(
        page_id=page_id
    ).order_by('-version_number').first()
    
    if not latest_version:
        return Response(
            {'error': 'No page version found'},
            status=status.HTTP_404_NOT_FOUND
        )
    
    widgets = latest_version.widgets or []
    original_count = len(widgets)
    
    # Remove the widget
    widgets = [w for w in widgets if w.get('id') != widget_id]
    
    if len(widgets) == original_count:
        return Response(
            {'error': f'Widget "{widget_id}" not found'},
            status=status.HTTP_404_NOT_FOUND
        )
    
    latest_version.widgets = widgets
    latest_version.save()
    
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def reorder_widgets(request, page_id):
    """
    Reorder widgets within a page.
    
    Path Parameters:
    - page_id: The ID of the page
    
    Request Body:
    - widgets: Array of widget IDs in the new order
    - slot: The slot being reordered (optional, defaults to all)
    """
    widget_ids = request.data.get('widgets', [])
    slot = request.data.get('slot')
    
    # Get the latest version
    latest_version = PageVersion.objects.filter(
        page_id=page_id
    ).order_by('-version_number').first()
    
    if not latest_version:
        return Response(
            {'error': 'No page version found'},
            status=status.HTTP_404_NOT_FOUND
        )
    
    widgets = latest_version.widgets or []
    
    # Create a mapping of widget IDs to widgets
    widget_map = {w.get('id'): w for w in widgets}
    
    # Validate all widget IDs exist
    for widget_id in widget_ids:
        if widget_id not in widget_map:
            return Response(
                {'error': f'Widget "{widget_id}" not found'},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    # Reorder widgets
    if slot:
        # Reorder only widgets in the specified slot
        slot_widgets = [w for w in widgets if w.get('slot') == slot]
        other_widgets = [w for w in widgets if w.get('slot') != slot]
        
        # Update order for slot widgets
        reordered_slot_widgets = []
        for i, widget_id in enumerate(widget_ids):
            widget = widget_map[widget_id]
            if widget.get('slot') == slot:
                widget['order'] = i
                reordered_slot_widgets.append(widget)
        
        # Combine back
        widgets = other_widgets + reordered_slot_widgets
    else:
        # Reorder all widgets
        reordered_widgets = []
        for i, widget_id in enumerate(widget_ids):
            widget = widget_map[widget_id]
            widget['order'] = i
            reordered_widgets.append(widget)
        
        # Add any widgets not in the reorder list
        for widget in widgets:
            if widget.get('id') not in widget_ids:
                reordered_widgets.append(widget)
        
        widgets = reordered_widgets
    
    latest_version.widgets = widgets
    latest_version.save()
    
    return Response({'message': 'Widgets reordered successfully'})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def duplicate_widget(request, page_id, widget_id):
    """
    Duplicate a widget within a page.
    
    Path Parameters:
    - page_id: The ID of the page
    - widget_id: The ID of the widget to duplicate
    """
    # Get the latest version
    latest_version = PageVersion.objects.filter(
        page_id=page_id
    ).order_by('-version_number').first()
    
    if not latest_version:
        return Response(
            {'error': 'No page version found'},
            status=status.HTTP_404_NOT_FOUND
        )
    
    widgets = latest_version.widgets or []
    widget_to_duplicate = None
    
    for w in widgets:
        if w.get('id') == widget_id:
            widget_to_duplicate = w
            break
    
    if widget_to_duplicate is None:
        return Response(
            {'error': f'Widget "{widget_id}" not found'},
            status=status.HTTP_404_NOT_FOUND
        )
    
    # Create a copy with a new ID
    import uuid
    import copy
    new_widget = copy.deepcopy(widget_to_duplicate)
    new_widget['id'] = str(uuid.uuid4())
    new_widget['order'] = widget_to_duplicate.get('order', 0) + 1
    
    # Adjust order of subsequent widgets
    slot = new_widget.get('slot', 'main')
    for w in widgets:
        if w.get('slot') == slot and w.get('order', 0) >= new_widget['order'] and w != widget_to_duplicate:
            w['order'] = w.get('order', 0) + 1
    
    widgets.append(new_widget)
    latest_version.widgets = widgets
    latest_version.save()
    
    return Response(new_widget, status=status.HTTP_201_CREATED)