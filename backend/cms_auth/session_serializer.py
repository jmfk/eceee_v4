"""Encrypt pending TOTP enrollment keys as well as the activated factor record."""

from django.contrib.sessions.serializers import JSONSerializer


class SecuritySessionSerializer(JSONSerializer):
    def dumps(self, obj):
        obj = dict(obj)
        secret = obj.get("mfa.totp.secret")
        if secret:
            from .adapters import MFAAdapter

            obj["mfa.totp.secret"] = {"cms_encrypted_totp": MFAAdapter().encrypt(secret)}
        return super().dumps(obj)

    def loads(self, data):
        obj = super().loads(data)
        secret = obj.get("mfa.totp.secret")
        if isinstance(secret, dict) and "cms_encrypted_totp" in secret:
            from .adapters import MFAAdapter

            obj["mfa.totp.secret"] = MFAAdapter().decrypt(secret["cms_encrypted_totp"])
        return obj
