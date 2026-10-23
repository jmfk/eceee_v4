"""Resolve recipient choices in the current tenant; persist the resolved snapshot."""

from rest_framework.exceptions import ValidationError

from kanban.models import Board

from .access import members, support_users


def directory(tenant, actor=None):
    users = members(tenant)
    options = [{"id": "support", "name": "Support", "kind": "support"}] if support_users(tenant) else []
    options += [{"id": f"user:{u.pk}", "name": u.get_full_name() or u.username, "kind": "user"} for u in users]
    from core.models import TenantRole

    options += [
        {"id": f"role:{r.pk}", "name": r.name, "kind": "group"} for r in TenantRole.objects.filter(tenant=tenant)
    ]
    from core.roles import permissions_for

    permissions = permissions_for(actor, tenant) if actor else {"tenant.admin"}
    if not {"kanban.read", "kanban.write", "tenant.admin"} & permissions:
        return options
    for board in Board.objects.filter(tenant=tenant, archived=False):
        options += [
            {"id": f"board:{board.pk}", "name": f"{board.title} · Inbox", "kind": "board"},
            {"id": f"board-members:{board.pk}", "name": f"{board.title} · medlemmar", "kind": "group"},
        ]
    if not {"kanban.write", "tenant.admin"} & permissions:
        options = [item for item in options if item["kind"] != "board"]
    return options


def resolve(tenant, specs, actor=None):
    allowed = {item["id"] for item in directory(tenant, actor)}
    if not specs or set(specs) - allowed:
        raise ValidationError({"recipients": "Välj mottagare som tillhör den här arbetsytan."})
    users, boards = set(), []
    support = "support" in specs
    for spec in specs:
        if spec == "support":
            continue
        kind, value = spec.split(":", 1)
        if kind == "user":
            users.add(int(value))
        elif kind == "role":
            users.update(
                members(tenant).filter(cms_roles__tenant=tenant, cms_roles__pk=value).values_list("pk", flat=True)
            )
        else:
            board = Board.objects.get(tenant=tenant, pk=value, archived=False)
            users.update(members(tenant).filter(kanban_boards=board).values_list("pk", flat=True))
            if kind == "board":
                boards.append(board)
    if len(boards) > 1:
        raise ValidationError({"recipients": "Välj högst en tavlas Inbox per meddelande."})
    if not users and not boards and not support:
        raise ValidationError({"recipients": "Gruppen har inga aktiva mottagare."})
    return support, users, boards
