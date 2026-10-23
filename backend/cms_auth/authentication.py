"""Legacy personal credentials cannot bypass MFA or credential revocation."""

from django.contrib.auth import get_user_model
from rest_framework.authentication import SessionAuthentication, TokenAuthentication
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.settings import api_settings

from .security import has_mfa, security_state, security_version, session_is_valid


def validate_personal_user(user):
    if not user.is_active or has_mfa(user):
        raise AuthenticationFailed("This account requires browser sign-in. Use a scoped machine key for automation.")


def validate_jwt(token):
    try:
        user = get_user_model().objects.get(**{api_settings.USER_ID_FIELD: token[api_settings.USER_ID_CLAIM]})
    except (get_user_model().DoesNotExist, KeyError):
        raise AuthenticationFailed("Invalid personal credential.") from None
    validate_personal_user(user)
    if token.get("cms_security_version", 0) != security_version(user):
        raise AuthenticationFailed("This credential has been revoked. Sign in again.")
    return user


class PersonalJWTAuthentication(JWTAuthentication):
    def get_user(self, validated_token):
        return validate_jwt(validated_token)


class PersonalTokenAuthentication(TokenAuthentication):
    def authenticate_credentials(self, key):
        user, token = super().authenticate_credentials(key)
        validate_personal_user(user)
        state = security_state(user)
        if state and state.changed_at and token.created <= state.changed_at:
            raise AuthenticationFailed("This credential has been revoked.")
        return user, token


class BrowserSessionAuthentication(SessionAuthentication):
    def authenticate(self, request):
        result = super().authenticate(request)
        if result and not session_is_valid(result[0], request.session):
            raise AuthenticationFailed("Session expired. Sign in again.")
        return result
