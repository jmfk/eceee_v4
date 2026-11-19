from django.urls import include, path
from webpages.views.submission_views import SubmissionView
from cms_auth.privacy import account_export

urlpatterns = [
    path("api/v1/webpages/pages/submissions/", SubmissionView.as_view()),
    path("api/v1/webpages/pages/submissions/<uuid:pk>/", SubmissionView.as_view()),
    path("api/v1/auth/privacy/export/", account_export),
]
