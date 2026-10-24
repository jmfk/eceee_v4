"""ECEEE identity configuration. Only variable names, never values, belong in docs."""

from decouple import config

CMS_MFA_ENCRYPTION_KEYS = [
    key.strip() for key in config("CMS_MFA_ENCRYPTION_KEYS", default="").split(",") if key.strip()
]
CMS_WEBAUTHN_RP_ID = config("CMS_WEBAUTHN_RP_ID", default="localhost")
ACCOUNT_ADAPTER = "cms_auth.adapters.AccountAdapter"
SOCIALACCOUNT_ADAPTER = "cms_auth.adapters.SocialAccountAdapter"
MFA_ADAPTER = "cms_auth.adapters.MFAAdapter"
# Username is retained for existing CMS accounts; email is an additional login option.
ACCOUNT_LOGIN_METHODS = {"username", "email"}
ACCOUNT_REAUTHENTICATION_REQUIRED = True
ACCOUNT_REAUTHENTICATION_TIMEOUT = 300
ACCOUNT_LOGIN_TIMEOUT = 300
ACCOUNT_LOGIN_ON_EMAIL_CONFIRMATION = False
ACCOUNT_EMAIL_VERIFICATION_BY_CODE_ENABLED = True
ACCOUNT_EMAIL_VERIFICATION_SUPPORTS_RESEND = True
ACCOUNT_EMAIL_VERIFICATION_SUPPORTS_CHANGE = False
ACCOUNT_EMAIL_VERIFICATION_BY_CODE_MAX_ATTEMPTS = 5
ACCOUNT_EMAIL_VERIFICATION_BY_CODE_TIMEOUT = 600
MFA_SUPPORTED_TYPES = ["totp", "webauthn", "recovery_codes"]
MFA_PASSKEY_LOGIN_ENABLED = False
MFA_PASSKEY_SIGNUP_ENABLED = False
MFA_TRUST_ENABLED = False
MFA_RECOVERY_CODE_COUNT = 10
MFA_RECOVERY_CODES_SHOW_ONCE = True
MFA_TOTP_ISSUER = "ECEEE CMS"
MFA_WEBAUTHN_ALLOW_INSECURE_ORIGIN = False
SOCIALACCOUNT_AUTO_SIGNUP = False
SOCIALACCOUNT_EMAIL_AUTHENTICATION = False
SOCIALACCOUNT_EMAIL_AUTHENTICATION_AUTO_CONNECT = False
SOCIALACCOUNT_STORE_TOKENS = False
SOCIALACCOUNT_LOGIN_ON_GET = False
HEADLESS_ADAPTER = "cms_auth.adapters.HeadlessAdapter"
HEADLESS_ONLY = True
HEADLESS_CLIENTS = ["browser"]
HEADLESS_FRONTEND_URLS = {
    "account_confirm_email": "/login?emailKey={key}",
    "account_reset_password": "/login?resetPassword=1",
    "account_reset_password_from_key": "/login?resetKey={key}",
    "account_signup": "/login",
    "socialaccount_login_error": "/login?providerError=failed",
}
LOGIN_REDIRECT_URL = "/"
ACCOUNT_LOGOUT_REDIRECT_URL = "/login"
SOCIALACCOUNT_PROVIDERS = {}
_google_id = config("CMS_GOOGLE_CLIENT_ID", default="")
_google_secret = config("CMS_GOOGLE_CLIENT_SECRET", default="")
if _google_id and _google_secret:
    SOCIALACCOUNT_PROVIDERS["google"] = {
        "SCOPE": ["profile", "email"],
        "OAUTH_PKCE_ENABLED": True,
        "APPS": [{"client_id": _google_id, "secret": _google_secret, "key": ""}],
    }
_apple_id = config("CMS_APPLE_CLIENT_ID", default="")
_apple_key_id = config("CMS_APPLE_KEY_ID", default="")
_apple_team_id = config("CMS_APPLE_TEAM_ID", default="")
_apple_private_key = config("CMS_APPLE_PRIVATE_KEY", default="").replace("\\n", "\n")
if all((_apple_id, _apple_key_id, _apple_team_id, _apple_private_key)):
    SOCIALACCOUNT_PROVIDERS["apple"] = {
        "APPS": [
            {
                "client_id": _apple_id,
                "secret": _apple_key_id,
                "key": _apple_team_id,
                "settings": {"certificate_key": _apple_private_key},
            }
        ]
    }

SESSION_SERIALIZER = "cms_auth.session_serializer.SecuritySessionSerializer"
