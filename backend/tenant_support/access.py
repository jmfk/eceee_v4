from django.contrib.auth import get_user_model
from django.db.models import Q
from rest_framework.exceptions import PermissionDenied

from .models import SupportRole


def members(tenant):
    return (
        get_user_model()
        .objects.filter(is_active=True)
        .filter(Q(member_tenants=tenant) | Q(pk=tenant.created_by_id))
        .distinct()
    )


def has_role(user, tenant, role):
    from core.roles import permissions_for

    capability = {"can_support": "support.read", "can_publish": "support.publish"}[role]
    if capability in permissions_for(user, tenant):
        return True
    return bool(
        user.is_active
        and tenant.is_active
        and tenant.user_has_access(user)
        and SupportRole.objects.filter(tenant=tenant, user=user, **{role: True}).exists()
    )


def require_role(user, tenant, role):
    if not has_role(user, tenant, role):
        raise PermissionDenied("Du saknar behörighet för den här åtgärden.")


def support_users(tenant):
    users = (
        get_user_model()
        .objects.filter(is_active=True, supportrole__tenant=tenant, supportrole__can_support=True)
        .distinct()
    )
    # Iterate tenant members to remain portable across SQLite tests and PostgreSQL JSON storage.
    users = {u.pk: u for u in users}
    for user in members(tenant).filter(cms_roles__tenant=tenant).distinct():
        if has_role(user, tenant, "can_support"):
            users[user.pk] = user
    return [u for u in users.values() if tenant.user_has_access(u)]


def can_read_thread(user, thread):
    return thread.tenant.user_has_access(user) and (
        thread.creator_id == user.pk
        or (thread.support_target and has_role(user, thread.tenant, "can_support"))
        or thread.participants.filter(pk=user.pk).exists()
    )
