from django.http import JsonResponse
from django.middleware.csrf import get_token
from django.urls import include, path
from django.views.decorators.csrf import ensure_csrf_cookie
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView

from .impersonation import user_perspective
from .tokens import PersonalTokenObtainView, PersonalTokenRefreshView, PersonalTokenVerifyView
from .views import security_status


class ProtectedView(APIView):
    def get(self, request):
        return Response({"user": request.user.pk})

    def post(self, request):
        return self.get(request)


class SystemOwnerOnlyView(ProtectedView):
    permission_classes = [IsAdminUser]


@ensure_csrf_cookie
def csrf(request):
    return JsonResponse({"csrfToken": get_token(request)})


urlpatterns = [
    path("api/v1/utils/user-perspective/", user_perspective),
    path("system-owner-only/", SystemOwnerOnlyView.as_view()),
    path("csrf-token/", csrf),
    path("_allauth/", include("cms_auth.urls")),
    path("_allauth/", include("allauth.headless.urls")),
    path("accounts/", include("allauth.urls")),
    path("api/v1/auth/security/", security_status),
    path("api/v1/auth/token/", PersonalTokenObtainView.as_view()),
    path("api/v1/auth/token/refresh/", PersonalTokenRefreshView.as_view()),
    path("api/v1/auth/token/verify/", PersonalTokenVerifyView.as_view()),
    path("protected/", ProtectedView.as_view()),
]
