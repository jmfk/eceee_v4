from rest_framework.routers import DefaultRouter

from .views import ClassificationTypeViewSet, GrantViewSet, OperationViewSet, ProposalViewSet, TermViewSet

router = DefaultRouter()
router.register("types", ClassificationTypeViewSet, basename="classification-type")
router.register("terms", TermViewSet, basename="classification-term")
router.register("proposals", ProposalViewSet, basename="classification-proposal")
router.register("history", OperationViewSet, basename="classification-history")
router.register("grants", GrantViewSet, basename="classification-grant")
urlpatterns = router.urls
