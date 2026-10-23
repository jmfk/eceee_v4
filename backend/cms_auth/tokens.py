from rest_framework_simplejwt.serializers import (
    TokenObtainPairSerializer,
    TokenRefreshSerializer,
    TokenVerifySerializer,
)
from rest_framework_simplejwt.tokens import UntypedToken
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView, TokenVerifyView

from .authentication import validate_jwt, validate_personal_user
from .security import security_version


class PersonalTokenObtainSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        validate_personal_user(user)
        token = super().get_token(user)
        token["cms_security_version"] = security_version(user)
        return token


class PersonalTokenRefreshSerializer(TokenRefreshSerializer):
    def validate(self, attrs):
        validate_jwt(self.token_class(attrs["refresh"]))
        return super().validate(attrs)


class PersonalTokenVerifySerializer(TokenVerifySerializer):
    def validate(self, attrs):
        validate_jwt(UntypedToken(attrs["token"]))
        return super().validate(attrs)


class PersonalTokenObtainView(TokenObtainPairView):
    serializer_class = PersonalTokenObtainSerializer


class PersonalTokenRefreshView(TokenRefreshView):
    serializer_class = PersonalTokenRefreshSerializer


class PersonalTokenVerifyView(TokenVerifyView):
    serializer_class = PersonalTokenVerifySerializer
