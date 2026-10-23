from cryptography.fernet import Fernet
from django.conf import settings
from django.core.checks import Error, register


@register()
def check_mfa_configuration(app_configs, **kwargs):
    errors = []
    keys = getattr(settings, "CMS_MFA_ENCRYPTION_KEYS", [])
    for key in keys:
        try:
            Fernet(key.encode("ascii"))
        except (ValueError, UnicodeError, AttributeError):
            errors.append(
                Error("MFA encryption key configuration is invalid; values are redacted.", id="cms_auth.E001")
            )
            break
    if keys and not settings.DEBUG and getattr(settings, "CMS_WEBAUTHN_RP_ID", "localhost") == "localhost":
        errors.append(Error("Set CMS_WEBAUTHN_RP_ID to this environment's HTTPS CMS hostname.", id="cms_auth.E002"))
    return errors
