import os
from string import punctuation
from urllib.parse import unquote

from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.db import models
from django.utils.translation import gettext_lazy as _
from mezzanine.conf import settings
from mezzanine.core.fields import FileField, RichTextField
from mezzanine.core.managers import CurrentSiteManager
from mezzanine.core.models import Displayable, Orderable, RichText, Slugged
from mezzanine.generic.fields import CommentsField
from mezzanine.pages.models import Link, Page
from mezzanine.utils.importing import import_dotted_path
from mezzanine.utils.models import AdminThumbMixin, upload_to


class PagePropertyMixin(object):

    def properties(self):
        object_type = ContentType.objects.get_for_model(self)
        properties = {}
        for prop in PageProperty.objects.filter(content_type__pk=object_type.id,
                           object_id=self.id):
            properties[prop.key] = prop.value
        return properties


class PagePropertyManager(models.Manager):
    def properties_for_object(self, obj):
        object_type = ContentType.objects.get_for_model(obj)
        return self.filter(content_type__pk=object_type.id,
                           object_id=obj.id)

class PageProperty(Orderable):

    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    object_id = models.PositiveIntegerField()
    content_object = GenericForeignKey('content_type', 'object_id')

    key = models.CharField(_("Name"), max_length=20, blank=False, null=False)
    value = models.CharField(_("Value"), max_length=4000, blank=True, default='')

    class Meta:
        verbose_name = _("Property")
        verbose_name_plural = _("Properties")

    def __unicode__(self):
        return self.key

    def save(self, *args, **kwargs):
        """
        If no description is given when created, create one from the
        file name.
        """
        super(PageProperty, self).save(*args, **kwargs)

