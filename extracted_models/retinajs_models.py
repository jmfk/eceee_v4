import os

from django.dispatch import receiver
from mezzanine.conf import settings

# Create your models here.
try:
    from filebrowser.signals import filebrowser_post_upload
except:
    # Check for Mezzanine project
    from filebrowser_safe.views import filebrowser_post_upload

try:
    from PIL import Image, ImageFile, ImageOps
except ImportError:
    import Image
    import ImageFile
    import ImageOps


@receiver(filebrowser_post_upload, dispatch_uid="_post_file_upload")
def _post_file_upload(*args, **kwargs):
    uploaded_file = kwargs["file"]
    name = os.path.basename(uploaded_file.name)
    mimetype, encoding = uploaded_file.mimetype
    if mimetype not in ("image/png", "image/jpg", "image/jpeg"):
        return None  # not a PNG
    try:
        path = os.path.join(settings.MEDIA_ROOT, uploaded_file.path)
        if path:
            name, ext = os.path.splitext(path)
            if name.endswith("@2x"):
                i = Image.open(path)
                width, height = i.size
                if width % 2 == 1:
                    width = width - 1
                if height % 2 == 1:
                    height = height - 1
                if i.size != (width, height):
                    i = i.crop((0, 0, width, height))
                half = i.resize((int(width / 2), int(height / 2)), resample=1)
                i.save(path)
                half.save(name[:-3] + ext)
    except Exception as e:
        print(e)
