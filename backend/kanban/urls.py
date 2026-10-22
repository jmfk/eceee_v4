from rest_framework.routers import DefaultRouter

from .views import AttachmentViewSet, BoardViewSet, CardViewSet, ColumnViewSet, CommentViewSet, WorkspaceViewSet

router = DefaultRouter()
for prefix, view in [
    ("boards", BoardViewSet),
    ("columns", ColumnViewSet),
    ("cards", CardViewSet),
    ("comments", CommentViewSet),
    ("attachments", AttachmentViewSet),
    ("workspace", WorkspaceViewSet),
]:
    router.register(prefix, view, basename=f"kanban-{prefix}")
urlpatterns = router.urls
