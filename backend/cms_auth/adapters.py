from urllib.parse import urlsplit

from allauth.account.adapter import DefaultAccountAdapter
from allauth.core import context
from allauth.core.exceptions import ImmediateHttpResponse
from allauth.headless.adapter import DefaultHeadlessAdapter
from allauth.mfa.adapter import DefaultMFAAdapter
from allauth.socialaccount.adapter import DefaultSocialAccountAdapter
from cryptography.fernet import Fernet, MultiFernet
from django.conf import settings
from django.core.exceptions import ImproperlyConfigured
from django.http import JsonResponse

from .security import recently_verified, security_version, stamp_session


class AccountAdapter(DefaultAccountAdapter):
    def is_open_for_signup(self, request):
        return False

    def pre_login(self, request, user, **kwargs):
        request.session["cms_pending_security"] = [str(user.pk), security_version(user)]
        return super().pre_login(request, user, **kwargs)

    def login(self, request, user):
        expected = request.session.pop("cms_pending_security", None)
        if expected != [str(user.pk), security_version(user)]:
            raise ImmediateHttpResponse(
                JsonResponse(
                    {"status": 409, "errors": [{"message": "Account security changed. Start sign-in again."}]},
                    status=409,
                )
            )
        super().login(request, user)
        stamp_session(request, user)

    def is_safe_url(self, url):
        # Provider callbacks may only return to the CMS origin.
        parsed = urlsplit(url)
        if parsed.fragment or "\\" in url or "\r" in url or "\n" in url or url.startswith("//"):
            return False
        if not parsed.netloc:
            return not parsed.scheme and url.startswith("/")
        request = context.request
        return parsed.netloc == request.get_host() and parsed.scheme == request.scheme


class SocialAccountAdapter(DefaultSocialAccountAdapter):
    def is_open_for_signup(self, request, sociallogin):
        return False

    def pre_social_login(self, request, sociallogin):
        # Identity verification is complete; provider credentials have no further
        # purpose in the pending MFA session. Apple also embeds them in state.
        sociallogin.token = None
        sociallogin.state.pop("id_token", None)
        if sociallogin.state.get("process") == "connect":
            if not recently_verified(request):
                from django.http import HttpResponseRedirect

                raise ImmediateHttpResponse(HttpResponseRedirect("/profile?providerError=reauthenticate"))
            if sociallogin.is_existing and sociallogin.user.pk != request.user.pk:
                from django.http import HttpResponseRedirect

                raise ImmediateHttpResponse(HttpResponseRedirect("/profile?providerError=linked"))
            return
        if not sociallogin.is_existing:
            from django.http import HttpResponseRedirect

            raise ImmediateHttpResponse(HttpResponseRedirect("/login?providerError=unlinked"))

    def list_apps(self, request, provider=None, client_id=None):
        # Environment settings are the sole provider configuration source.
        apps = super().list_apps(request, provider=provider, client_id=client_id)
        return [app for app in apps if app.pk is None]


class MFAAdapter(DefaultMFAAdapter):
    def _cipher(self):
        keys = settings.CMS_MFA_ENCRYPTION_KEYS
        if not keys:
            raise ImproperlyConfigured("CMS_MFA_ENCRYPTION_KEYS must be configured before using MFA.")
        try:
            return MultiFernet([Fernet(key.encode("ascii")) for key in keys])
        except (ValueError, UnicodeError):
            raise ImproperlyConfigured("CMS_MFA_ENCRYPTION_KEYS contains an invalid Fernet key.") from None

    def encrypt(self, text):
        return self._cipher().encrypt(text.encode("utf8")).decode("ascii")

    def decrypt(self, encrypted_text):
        return self._cipher().decrypt(encrypted_text.encode("ascii")).decode("utf8")

    def get_public_key_credential_rp_entity(self):
        return {"id": settings.CMS_WEBAUTHN_RP_ID, "name": "ECEEE CMS"}


class HeadlessAdapter(DefaultHeadlessAdapter):
    def get_frontend_url(self, urlname, **kwargs):
        url = super().get_frontend_url(urlname, **kwargs)
        if url and url.startswith("/"):
            return self.request.build_absolute_uri(url)
        return url
