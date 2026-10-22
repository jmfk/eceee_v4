import tempfile
import uuid
from datetime import timedelta

from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Max, Q, Sum
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle
from rest_framework.views import APIView

from core.models import MachineAPIKey, Tenant
from core.permissions import HasTenantAccess

from . import storage
from .access import can_read_thread, has_role, members, require_role, support_users
from .models import EmailDelivery, InboxEntry, Instruction, Message, PrivateVideo, SupportRole, SupportThread
from .serializers import (
    ArchiveInput,
    InstructionSerializer,
    InstructionStateInput,
    PublishInput,
    ReplyInput,
    RoleInput,
    StatusInput,
    ThreadInput,
    ThreadSerializer,
)
from .services import notify_thread, receive, visible_entries
from .video import inspect_video


def validated(serializer_type, request):
    serializer = serializer_type(data=request.data)
    serializer.is_valid(raise_exception=True)
    return serializer.validated_data


class SupportView(APIView):
    permission_classes = [HasTenantAccess]

    def finalize_response(self, request, response, *args, **kwargs):
        response = super().finalize_response(request, response, *args, **kwargs)
        response["Cache-Control"] = "private, no-store"
        return response

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        if isinstance(request.auth, MachineAPIKey) or not request.user.is_active or not request.tenant.is_active:
            raise PermissionDenied("Inboxen kräver ett personligt användarkonto.")

    def page(self, queryset, request, serialize):
        paginator = PageNumberPagination()
        paginator.page_size = 30
        rows = paginator.paginate_queryset(queryset, request, view=self)
        return paginator.get_paginated_response([serialize(row) for row in rows])


def thread_for(request, pk, lock=False):
    queryset = SupportThread.objects.select_related("tenant", "creator").filter(tenant=request.tenant)
    if lock:
        queryset = queryset.select_for_update(of=("self",))
    if not has_role(request.user, request.tenant, "can_support"):
        queryset = queryset.filter(creator=request.user)
    return get_object_or_404(queryset, pk=pk)


def video_for(request, pk, purpose):
    video = get_object_or_404(PrivateVideo, pk=pk, tenant=request.tenant, owner=request.user, purpose=purpose)
    if Instruction.objects.filter(video=video).exists() or SupportThread.objects.filter(video=video).exists():
        raise ValidationError({"video_id": "Videon används redan. Ladda upp en ny bilaga."})
    return video


class ContextView(SupportView):
    def get(self, request):
        tenant, user = request.tenant, request.user
        roles = SupportRole.objects.filter(tenant=tenant).select_related("user")
        manager = user.is_superuser
        candidates = members(tenant)
        if manager:
            candidates = (
                get_user_model()
                .objects.filter(Q(pk__in=candidates.values("pk")) | Q(pk=user.pk))
                .filter(is_active=True)
            )
        return Response(
            {
                "tenant": {"id": str(tenant.pk), "identifier": tenant.identifier, "name": tenant.name},
                "user_id": user.pk,
                "can_publish": has_role(user, tenant, "can_publish"),
                "can_support": has_role(user, tenant, "can_support"),
                "can_manage": manager,
                "recipient_count": members(tenant).exclude(pk=user.pk).count(),
                "support_available": bool(support_users(tenant)),
                "storage_configured": bool(settings.SUPPORT_STORAGE_BUCKET_NAME),
                "email_enabled": settings.SUPPORT_EMAIL_ENABLED,
                "unread_count": visible_entries(user, tenant).filter(archived=False, read_at__isnull=True).count(),
                "members": (
                    [{"id": u.pk, "name": u.get_full_name() or u.username} for u in candidates] if manager else []
                ),
                "roles": (
                    [{"user_id": r.user_id, "can_support": r.can_support, "can_publish": r.can_publish} for r in roles]
                    if manager
                    else []
                ),
                "video_limits": {
                    "bug": settings.SUPPORT_BUG_MAX_BYTES,
                    "instruction": settings.SUPPORT_INSTRUCTION_MAX_BYTES,
                },
            }
        )

    @transaction.atomic
    def post(self, request):
        if not request.user.is_superuser:
            raise PermissionDenied("Endast systemägaren kan utse support och publicerare.")
        data = validated(RoleInput, request)
        user = get_object_or_404(get_user_model(), pk=data.pop("user_id"), is_active=True)
        if not request.tenant.user_has_access(user):
            raise ValidationError({"user_id": "Användaren saknar åtkomst till arbetsytan."})
        # Serializes grants and publications against the same tenant boundary.
        Tenant.objects.select_for_update().get(pk=request.tenant.pk)
        role, _ = SupportRole.objects.update_or_create(tenant=request.tenant, user=user, defaults=data)
        if role.can_support:
            threads = SupportThread.objects.filter(tenant=request.tenant).annotate(latest=Max("messages__created_at"))
            InboxEntry.objects.bulk_create(
                [
                    InboxEntry(tenant=request.tenant, user=user, thread=t, activity_at=t.latest or t.created_at)
                    for t in threads
                ],
                ignore_conflicts=True,
            )
        return Response({"id": str(role.pk)})


class InboxView(SupportView):
    def get(self, request):
        rows = visible_entries(request.user, request.tenant).filter(
            archived=request.query_params.get("archived") == "true"
        )
        search = request.query_params.get("search", "").strip()[:150]
        if search:
            rows = rows.filter(
                Q(instruction__title__icontains=search)
                | Q(thread__title__icontains=search)
                | Q(thread__messages__body__icontains=search)
            ).distinct()
        kind = request.query_params.get("kind")
        if kind in {"instruction", "support"}:
            rows = rows.filter(instruction__isnull=kind == "support")
        return self.page(
            rows,
            request,
            lambda e: {
                "id": str(e.pk),
                "instruction_id": e.instruction_id,
                "thread_id": e.thread_id,
                "title": e.instruction.title if e.instruction_id else e.thread.title,
                "kind": "instruction" if e.instruction_id else e.thread.kind,
                "status": e.thread.status if e.thread_id else None,
                "activity_at": e.activity_at,
                "read_at": e.read_at,
                "archived": e.archived,
            },
        )


class EntryView(SupportView):
    def patch(self, request, pk):
        entry = get_object_or_404(visible_entries(request.user, request.tenant), pk=pk)
        data = validated(ArchiveInput, request)
        entry.archived = data["archived"]
        entry.save(update_fields=["archived"])
        return Response({"archived": entry.archived})


class InstructionsView(SupportView):
    def get(self, request):
        rows = Instruction.objects.filter(tenant=request.tenant)
        if not has_role(request.user, request.tenant, "can_publish"):
            rows = rows.filter(withdrawn=False)
        search = request.query_params.get("search", "").strip()[:150]
        if search:
            rows = rows.filter(Q(title__icontains=search) | Q(description__icontains=search))
        if request.query_params.get("archived") != "true":
            rows = rows.filter(archived=False)
        return self.page(rows, request, lambda row: InstructionSerializer(row).data)

    @transaction.atomic
    def post(self, request):
        require_role(request.user, request.tenant, "can_publish")
        data = validated(PublishInput, request)
        Tenant.objects.select_for_update().get(pk=request.tenant.pk)
        previous = Instruction.objects.filter(
            tenant=request.tenant, author=request.user, request_id=data["request_id"]
        ).first()
        if previous:
            return Response(InstructionSerializer(previous).data)
        video = video_for(request, data.pop("video_id"), "instruction")
        instruction = Instruction.objects.create(tenant=request.tenant, author=request.user, video=video, **data)
        for user in members(request.tenant).exclude(pk=request.user.pk):
            receive(
                request.tenant,
                user,
                instruction=instruction,
                event_key=f"instruction:{instruction.pk}",
                summary="En ny instruktionsfilm finns för din arbetsyta. Öppna ECEEE för att se filmen.",
            )
        return Response(InstructionSerializer(instruction).data, status=status.HTTP_201_CREATED)


class InstructionView(SupportView):
    def get_object(self, request, pk):
        queryset = Instruction.objects.filter(tenant=request.tenant)
        if not has_role(request.user, request.tenant, "can_publish"):
            queryset = queryset.filter(withdrawn=False)
        return get_object_or_404(queryset, pk=pk)

    def get(self, request, pk):
        instruction = self.get_object(request, pk)
        InboxEntry.objects.filter(tenant=request.tenant, user=request.user, instruction=instruction).update(
            read_at=timezone.now()
        )
        return Response(InstructionSerializer(instruction).data)

    def patch(self, request, pk):
        require_role(request.user, request.tenant, "can_publish")
        instruction = self.get_object(request, pk)
        data = validated(InstructionStateInput, request)
        for field, value in data.items():
            setattr(instruction, field, value)
        if data:
            instruction.save(update_fields=list(data))
        return Response(InstructionSerializer(instruction).data)


class ThreadsView(SupportView):
    @transaction.atomic
    def post(self, request):
        data = validated(ThreadInput, request)
        Tenant.objects.select_for_update().get(pk=request.tenant.pk)
        previous = SupportThread.objects.filter(
            tenant=request.tenant, creator=request.user, request_id=data["request_id"]
        ).first()
        if previous:
            return Response(ThreadSerializer(previous).data)
        if not support_users(request.tenant):
            raise ValidationError({"support": "Support är inte konfigurerad för arbetsytan. Kontakta systemägaren."})
        if (
            SupportThread.objects.filter(
                tenant=request.tenant, creator=request.user, created_at__gte=timezone.now() - timedelta(days=1)
            ).count()
            >= 50
        ):
            raise ValidationError({"limit": "Du har nått dygnsgränsen på 50 ärenden. Försök igen senare."})
        instruction_id = data.pop("instruction_id", None)
        instruction = (
            get_object_or_404(Instruction, tenant=request.tenant, pk=instruction_id, withdrawn=False)
            if instruction_id
            else None
        )
        video_id = data.pop("video_id", None)
        video = video_for(request, video_id, "bug") if video_id else None
        body = data.pop("body")
        thread = SupportThread.objects.create(
            tenant=request.tenant, creator=request.user, instruction=instruction, video=video, **data
        )
        message = Message.objects.create(thread=thread, sender=request.user, body=body, request_id=data["request_id"])
        notify_thread(thread, request.user, message)
        return Response(ThreadSerializer(thread).data, status=status.HTTP_201_CREATED)


class ThreadView(SupportView):
    def get(self, request, pk):
        thread = thread_for(request, pk)
        InboxEntry.objects.filter(tenant=request.tenant, user=request.user, thread=thread).update(
            read_at=timezone.now()
        )
        return Response(ThreadSerializer(thread).data)

    @transaction.atomic
    def post(self, request, pk):
        thread = thread_for(request, pk, lock=True)
        data = validated(ReplyInput, request)
        message, created = Message.objects.get_or_create(
            thread=thread, sender=request.user, request_id=data["request_id"], defaults={"body": data["body"]}
        )
        if created:
            if (
                thread.messages.filter(sender=request.user, created_at__gte=timezone.now() - timedelta(days=1)).count()
                > 100
            ):
                raise ValidationError({"limit": "Dygnsgränsen på 100 svar i tråden är nådd."})
            thread.status = "open" if thread.creator_id == request.user.pk else "waiting"
            thread.save(update_fields=["status"])
            notify_thread(thread, request.user, message)
        return Response(ThreadSerializer(thread).data)

    def patch(self, request, pk):
        require_role(request.user, request.tenant, "can_support")
        thread = thread_for(request, pk)
        data = validated(StatusInput, request)
        thread.status = data["status"]
        thread.save(update_fields=["status"])
        return Response(ThreadSerializer(thread).data)


class VideoUploadThrottle(UserRateThrottle):
    scope = "support_video"
    rate = "20/hour"


class VideoUploadView(SupportView):
    throttle_classes = [VideoUploadThrottle]

    def post(self, request):
        purpose = request.data.get("purpose")
        if purpose not in {"bug", "instruction"}:
            raise ValidationError({"purpose": "Välj bug eller instruction."})
        if purpose == "instruction":
            require_role(request.user, request.tenant, "can_publish")
        upload = request.FILES.get("file")
        limit = settings.SUPPORT_BUG_MAX_BYTES if purpose == "bug" else settings.SUPPORT_INSTRUCTION_MAX_BYTES
        if not upload or not upload.size or upload.size > limit:
            raise ValidationError({"file": f"Välj en video på högst {limit // (1024 * 1024)} MB."})
        with tempfile.NamedTemporaryFile(suffix=".video") as temp:
            for chunk in upload.chunks():
                temp.write(chunk)
            temp.flush()
            duration, content_type, extension = inspect_video(temp.name, purpose)
            with transaction.atomic():
                Tenant.objects.select_for_update().get(pk=request.tenant.pk)
                recent = PrivateVideo.objects.filter(
                    tenant=request.tenant, created_at__gte=timezone.now() - timedelta(days=1)
                )
                total = recent.aggregate(total=Sum("byte_size"))["total"] or 0
                if recent.count() >= 50 or total + upload.size > settings.SUPPORT_DAILY_MAX_BYTES:
                    raise ValidationError({"file": "Arbetsytans dygnskvot för video är nådd. Försök igen senare."})
                key = f"{request.tenant.pk}/{uuid.uuid4()}.{extension}"
                try:
                    storage.save_video(temp.name, key, content_type)
                except Exception:
                    # Do not expose provider URLs, credentials or response bodies.
                    return Response(
                        {"error": "Privat videolagring är inte tillgänglig. Texten är kvar; försök igen senare."},
                        status=503,
                    )
                video = PrivateVideo.objects.create(
                    tenant=request.tenant,
                    owner=request.user,
                    purpose=purpose,
                    storage_key=key,
                    content_type=content_type,
                    byte_size=upload.size,
                    duration=duration,
                )
        return Response({"id": str(video.pk), "duration": str(duration)}, status=201)


class VideoPlaybackView(SupportView):
    def get(self, request, pk):
        video = get_object_or_404(PrivateVideo, tenant=request.tenant, pk=pk)
        instruction = Instruction.objects.filter(video=video, tenant=request.tenant, withdrawn=False).first()
        thread = SupportThread.objects.select_related("tenant").filter(video=video, tenant=request.tenant).first()
        if not instruction and not (thread and can_read_thread(request.user, thread)):
            raise PermissionDenied("Du saknar åtkomst till videon.")
        try:
            url = storage.playback_url(video.storage_key)
        except Exception:
            return Response({"error": "Videon kunde inte öppnas. Försök igen senare."}, status=503)
        return Response({"url": url, "expires_in": 60}, headers={"Cache-Control": "private, no-store"})


class DeliveriesView(SupportView):
    def get(self, request):
        require_role(request.user, request.tenant, "can_support")
        rows = EmailDelivery.objects.filter(
            entry__tenant=request.tenant, state__in=["failed", "uncertain", "pending"], error_code__gt=""
        ).order_by("-next_attempt_at")
        return self.page(
            rows,
            request,
            lambda row: {
                "id": str(row.pk),
                "state": row.state,
                "error_code": row.error_code,
                "attempts": row.attempts,
                "entry_id": row.entry_id,
            },
        )
