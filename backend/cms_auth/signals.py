from allauth.account import signals as account_signals
from allauth.core import context
from allauth.mfa.models import Authenticator
from allauth.mfa.signals import authenticator_reset
from allauth.socialaccount.models import SocialAccount
from allauth.socialaccount.signals import social_account_added, social_account_removed
from django.db.models.signals import post_delete, post_save, pre_save
from django.dispatch import receiver

from .security import revoke_credentials


@receiver(post_save, sender=Authenticator)
def authenticator_created(sender, instance, created, **kwargs):
    if created:
        request = context.request
        proven = instance.type != Authenticator.Type.RECOVERY_CODES
        revoke_credentials(instance.user, request, factor_proven=proven)
        if proven and request and request.user.is_authenticated:
            from allauth.account.internal.flows.login import record_authentication

            record_authentication(request, instance.user, method="mfa", reauthenticated=True)


@receiver(post_delete, sender=Authenticator)
def authenticator_deleted(sender, instance, **kwargs):
    from django.contrib.auth import get_user_model

    origin = kwargs.get("origin")
    origin_model = getattr(origin, "model", type(origin))
    if origin_model is get_user_model():
        # User deletion already revokes every credential. Creating a new state
        # row during the collector's cascade would leave an unscheduled FK.
        return
    revoke_credentials(instance.user, context.request)


@receiver(authenticator_reset)
def recovery_codes_replaced(sender, request, user, **kwargs):
    revoke_credentials(user, request)


@receiver(social_account_added)
@receiver(social_account_removed)
def identity_changed(sender, request, socialaccount=None, sociallogin=None, **kwargs):
    revoke_credentials((socialaccount or sociallogin).user, request)


@receiver(account_signals.email_changed)
@receiver(account_signals.email_added)
@receiver(account_signals.email_removed)
@receiver(account_signals.password_set)
@receiver(account_signals.password_changed)
@receiver(account_signals.password_reset)
def password_changed(sender, request, user, **kwargs):
    revoke_credentials(user, request)


@receiver(pre_save, sender=SocialAccount)
def retain_identity_data_only(sender, instance, **kwargs):
    if instance.provider not in {"google", "apple"}:
        return
    # Apple's upstream response includes bearer credentials in extra_data.
    # Filter before allauth's lookup/update can write that response to the DB.
    fields = {
        "sub",
        "email",
        "email_verified",
        "is_private_email",
        "name",
        "given_name",
        "family_name",
        "picture",
        "locale",
    }
    instance.extra_data = {key: value for key, value in instance.extra_data.items() if key in fields}
