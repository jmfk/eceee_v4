"""
URL patterns for HTMX views and demonstrations.
"""

from django.urls import path
from . import views

app_name = "htmx"

urlpatterns = [
    # Main HTMX pages
    path("", views.htmx_home, name="home"),
    path("examples/", views.htmx_examples, name="examples"),
    # Dynamic content endpoints
    path("dynamic/", views.dynamic_content, name="dynamic_content"),
    path("form/", views.form_example, name="form_example"),
    path("search/", views.search_example, name="search_example"),
    path("scroll/", views.infinite_scroll, name="infinite_scroll"),
    # Interactive endpoints
    path("like/<int:item_id>/", views.toggle_like, name="toggle_like"),
    path("time/", views.server_time, name="server_time"),
]
