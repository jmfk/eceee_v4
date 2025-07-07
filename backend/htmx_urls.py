"""
URL patterns for HTMX views and demonstrations.
"""

from django.urls import path
from . import htmx_views

app_name = 'htmx'

urlpatterns = [
    # Main HTMX pages
    path('', htmx_views.htmx_home, name='home'),
    path('examples/', htmx_views.htmx_examples, name='examples'),
    
    # Dynamic content endpoints
    path('dynamic/', htmx_views.dynamic_content, name='dynamic_content'),
    path('form/', htmx_views.form_example, name='form_example'),
    path('search/', htmx_views.search_example, name='search_example'),
    path('scroll/', htmx_views.infinite_scroll, name='infinite_scroll'),
    
    # Interactive endpoints
    path('like/<int:item_id>/', htmx_views.toggle_like, name='toggle_like'),
    path('time/', htmx_views.server_time, name='server_time'),
]