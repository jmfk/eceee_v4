import io
import warnings

from django.contrib.auth import get_user_model
from django.db.models import Q
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from PIL import Image, ImageOps, UnidentifiedImageError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.exceptions import ValidationError, PermissionDenied
from .models import ProfilePhoto, MachineAPIKey


class ProfilePhotoView(APIView):
    permission_classes = [IsAuthenticated]

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        if isinstance(request.auth, MachineAPIKey):
            raise PermissionDenied("Profilbilder kräver ett personligt användarkonto.")

    def get(self, request, user_id):
        if user_id != request.user.pk:
            tenant = getattr(request, "tenant", None)
            target = get_object_or_404(get_user_model(), pk=user_id, is_active=True)
            if (
                not tenant
                or not tenant.user_has_access(request.user)
                or not (tenant.created_by_id == target.pk or tenant.members.filter(pk=target.pk).exists())
            ):
                raise PermissionDenied("Bilden är bara tillgänglig inom arbetsytan.")
        photo = get_object_or_404(ProfilePhoto.objects.exclude(image=b""), user_id=user_id)
        return HttpResponse(
            bytes(photo.image),
            content_type="image/jpeg",
            headers={"Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff"},
        )

    def put(self, request, user_id):
        if user_id != request.user.pk:
            raise PermissionDenied("Du kan bara ändra din egen profilbild.")
        upload = request.FILES.get("file")
        if not upload or not upload.size or upload.size > 5 * 1024 * 1024:
            raise ValidationError({"file": "Välj en JPEG-, PNG- eller WebP-bild på högst 5 MB."})
        try:
            with warnings.catch_warnings():
                warnings.simplefilter("error", Image.DecompressionBombWarning)
                with Image.open(upload) as image:
                    if image.format not in {"JPEG", "PNG", "WEBP"} or image.width * image.height > 20_000_000:
                        raise ValueError()
                    image = ImageOps.exif_transpose(image)
                    image = ImageOps.fit(image.convert("RGB"), (256, 256))
                    output = io.BytesIO()
                    image.save(output, "JPEG", quality=85)
        except (
            UnidentifiedImageError,
            OSError,
            ValueError,
            Image.DecompressionBombError,
            Image.DecompressionBombWarning,
        ):
            raise ValidationError(
                {"file": "Bilden kunde inte läsas. Använd JPEG, PNG eller WebP (högst 20 megapixel)."}
            )
        ProfilePhoto.objects.update_or_create(user=request.user, defaults={"image": output.getvalue()})
        return Response({"saved": True})

    def delete(self, request, user_id):
        if user_id != request.user.pk:
            raise PermissionDenied("Du kan bara ta bort din egen profilbild.")
        # A profile photo is explicitly replaceable/removable by its owner.
        ProfilePhoto.objects.filter(user=request.user).update(image=b"")
        return Response({"removed": True})
