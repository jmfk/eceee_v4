"""Bound malformed FIDO payload errors at the input boundary.

allauth delegates to fido2, whose parsers can raise KeyError/ValueError as well
as TypeError for incomplete browser JSON. These must be validation errors.
"""

from allauth.headless.mfa import inputs, views
from django.core.exceptions import ValidationError


class SafeAddWebAuthnInput(inputs.AddWebAuthnInput):
    def clean(self):
        try:
            return super().clean()
        except (KeyError, TypeError, ValueError):
            raise ValidationError("Invalid passkey registration. Start again.") from None


class SafeAuthenticateWebAuthnInput(inputs.AuthenticateWebAuthnInput):
    def clean_credential(self):
        try:
            return super().clean_credential()
        except (KeyError, TypeError, ValueError):
            raise ValidationError("Invalid passkey assertion. Start again.") from None


class SafeReauthenticateWebAuthnInput(inputs.ReauthenticateWebAuthnInput):
    def clean_credential(self):
        try:
            return super().clean_credential()
        except (KeyError, TypeError, ValueError):
            raise ValidationError("Invalid passkey assertion. Start again.") from None


class ManageWebAuthnView(views.ManageWebAuthnView):
    input_class = {**views.ManageWebAuthnView.input_class, "POST": SafeAddWebAuthnInput}


class AuthenticateWebAuthnView(views.AuthenticateWebAuthnView):
    input_class = {"POST": SafeAuthenticateWebAuthnInput}


class ReauthenticateWebAuthnView(views.ReauthenticateWebAuthnView):
    input_class = {"POST": SafeReauthenticateWebAuthnInput}
