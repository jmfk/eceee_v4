"""
URL routing for standardized Widget APIs.
"""

from django.urls import path
from . import widget_api

app_name = 'widget_api'

urlpatterns = [
    # Widget Type endpoints
    path('types/', widget_api.widget_types_list, name='widget-types-list'),
    path('types/<str:widget_slug>/', widget_api.widget_type_detail, name='widget-type-detail'),
    path('types/<str:widget_slug>/validate/', widget_api.validate_widget_configuration, name='widget-validate'),
    path('types/<str:widget_slug>/preview/', widget_api.render_widget_preview, name='widget-preview'),
    
    # Page Widget endpoints
    path('pages/<int:page_id>/widgets/', widget_api.get_page_widgets, name='page-widgets-list'),
    path('pages/<int:page_id>/widgets/create/', widget_api.create_widget, name='page-widget-create'),
    path('pages/<int:page_id>/widgets/<str:widget_id>/', widget_api.update_widget, name='page-widget-update'),
    path('pages/<int:page_id>/widgets/<str:widget_id>/delete/', widget_api.delete_widget, name='page-widget-delete'),
    path('pages/<int:page_id>/widgets/<str:widget_id>/duplicate/', widget_api.duplicate_widget, name='page-widget-duplicate'),
    path('pages/<int:page_id>/widgets/reorder/', widget_api.reorder_widgets, name='page-widgets-reorder'),
]