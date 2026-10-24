from allauth.headless.constants import Client
from django.urls import path

from .views import recent_authentication
from .webauthn import AuthenticateWebAuthnView, ManageWebAuthnView, ReauthenticateWebAuthnView

urlpatterns = [
    path("browser/v1/account/reauthenticated", recent_authentication),
    path("browser/v1/account/authenticators/webauthn", ManageWebAuthnView.as_api_view(client=Client.BROWSER)),
    path("browser/v1/auth/webauthn/authenticate", AuthenticateWebAuthnView.as_api_view(client=Client.BROWSER)),
    path("browser/v1/auth/webauthn/reauthenticate", ReauthenticateWebAuthnView.as_api_view(client=Client.BROWSER)),
]
