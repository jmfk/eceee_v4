"""Preview a public link and save a reviewed, categorized screenshot."""

import base64
import hashlib
import uuid
from time import monotonic
from urllib.parse import urlsplit, urlunsplit

import requests
from django.conf import settings
from django.core import signing
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import transaction
from django.utils import timezone
from rest_framework import permissions, serializers
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle
from rest_framework.views import APIView

from content.models import Namespace
from core.models import MachineAPIKey
from core.roles import permissions_for
from taxonomy.assignments import replace_assignments, validate_media_selection

from ..models import MediaFile
from ..security import filter_media_files_for_user, user_can_access_namespace
from ..serializers import MediaFileListSerializer
from ..storage import storage

MAX_BYTES = 5 * 1024 * 1024
SALT = "media-link-screenshot-v1"
PNG_HEADER = b"\x89PNG\r\n\x1a\n"


class CaptureInput(serializers.Serializer):
    url = serializers.URLField(max_length=2000)


class SaveInput(serializers.Serializer):
    namespace = serializers.CharField(max_length=255)
    title = serializers.CharField(max_length=255)
    token = serializers.CharField(max_length=40000)
    image = serializers.FileField()
    classification_ids = serializers.ListField(child=serializers.UUIDField(), allow_empty=False)


class CaptureThrottle(UserRateThrottle):
    scope = "media_link_screenshot"

    def get_rate(self):
        return "20/hour"


def require_media_access(request):
    if isinstance(request.auth, MachineAPIKey) or "media.write" not in permissions_for(request.user, request.tenant):
        raise PermissionDenied("Media editing permission is required.")


class LinkScreenshotView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = [CaptureThrottle]

    def post(self, request):
        require_media_access(request)
        inputs = CaptureInput(data=request.data)
        inputs.is_valid(raise_exception=True)
        url = inputs.validated_data["url"]
        parsed = urlsplit(url)
        if parsed.scheme not in {"http", "https"} or parsed.username is not None or parsed.password is not None:
            raise serializers.ValidationError("Use a public link without credentials.")
        source = urlunsplit((parsed.scheme, parsed.netloc, parsed.path, "", ""))
        endpoint = settings.PLAYWRIGHT_SERVICE_URL.rstrip("/") + "/public-screenshot"
        deadline = monotonic() + 30
        try:
            with requests.post(
                endpoint, json={"url": url}, stream=True, timeout=(3, 30), allow_redirects=False
            ) as result:
                if result.status_code != 200 or result.headers.get("Content-Type", "").split(";")[0] != "image/png":
                    raise ValueError()
                contents = bytearray()
                for chunk in result.iter_content(chunk_size=64 * 1024):
                    contents.extend(chunk)
                    if len(contents) > MAX_BYTES or monotonic() > deadline:
                        raise ValueError()
        except (requests.RequestException, OSError, ValueError):
            raise serializers.ValidationError("Could not capture this public webpage.") from None
        if len(contents) > MAX_BYTES or not contents.startswith(PNG_HEADER):
            raise serializers.ValidationError("The captured image was invalid or too large.")
        claim = {
            "id": str(uuid.uuid4()),
            "tenant": str(request.tenant.pk),
            "user": str(request.user.pk),
            "source": source,
            "captured_at": timezone.now().isoformat(),
            "sha256": hashlib.sha256(contents).hexdigest(),
        }
        return Response(
            {
                "image": base64.b64encode(contents).decode("ascii"),
                "token": signing.dumps(claim, salt=SALT, compress=True),
            },
            headers={"Cache-Control": "private, no-store"},
        )


class SaveLinkScreenshotView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        require_media_access(request)
        inputs = SaveInput(data=request.data)
        inputs.is_valid(raise_exception=True)
        data = inputs.validated_data
        try:
            claim = signing.loads(data["token"], salt=SALT, max_age=1800)
        except signing.BadSignature:
            raise serializers.ValidationError("This preview has expired. Capture the page again.") from None
        if claim["user"] != str(request.user.pk) or claim["tenant"] != str(request.tenant.pk):
            raise PermissionDenied()
        upload = data["image"]
        contents = upload.read(MAX_BYTES + 1)
        if len(contents) > MAX_BYTES or hashlib.sha256(contents).hexdigest() != claim["sha256"]:
            raise serializers.ValidationError("The uploaded image does not match the reviewed screenshot.")
        namespace = (
            Namespace.objects.filter(tenant=request.tenant, is_default=True).first()
            if data["namespace"] == "default"
            else Namespace.objects.filter(tenant=request.tenant, slug=data["namespace"]).first()
        )
        if not namespace or namespace.is_hidden or not user_can_access_namespace(request.user, namespace):
            raise PermissionDenied("This media namespace is unavailable.")

        path = None
        try:
            with transaction.atomic():
                Namespace.objects.select_for_update().get(pk=namespace.pk)
                prior = MediaFile.objects.with_deleted().filter(pk=claim["id"], tenant=request.tenant).first()
                if prior:
                    visible = filter_media_files_for_user(
                        MediaFile.objects.filter(pk=prior.pk, namespace=namespace), request.user, request.tenant
                    ).first()
                    if visible is None:
                        raise serializers.ValidationError("This screenshot was already saved and is unavailable here.")
                    return Response(MediaFileListSerializer(visible, context={"request": request}).data)
                ids = validate_media_selection(namespace, request.user, data["classification_ids"])
                image = SimpleUploadedFile("webpage-screenshot.png", contents, content_type="image/png")
                result = storage.upload_file(image, f"{namespace.slug}/link-screenshots")
                path = result.pop("file_path")
                file = MediaFile.create_with_hash_cleanup(
                    **result,
                    id=claim["id"],
                    title=data["title"],
                    original_filename=image.name,
                    file_path=path,
                    file_url=storage.get_public_url(path),
                    file_type="image",
                    metadata={"link_screenshot": {"source_url": claim["source"], "captured_at": claim["captured_at"]}},
                    namespace=namespace,
                    tenant=request.tenant,
                    uploaded_by=request.user,
                    created_by=request.user,
                    last_modified_by=request.user,
                )
                replace_assignments(file, ids, request.user)
        except Exception:
            if path:
                storage.delete(path)
            raise
        return Response(MediaFileListSerializer(file, context={"request": request}).data, status=201)
