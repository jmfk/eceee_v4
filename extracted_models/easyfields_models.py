import datetime
import os
from string import punctuation
from urllib.parse import unquote
from zipfile import ZipFile

from django import forms
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
from mezzanine.generic.models import AssignedKeyword, Keyword
from mezzanine.pages.models import Link, Page
from mezzanine.utils.importing import import_dotted_path
from mezzanine.utils.models import AdminThumbMixin, upload_to


class InfoText(Slugged):
    """
    Info Text that can be used in different places
    """

    class Meta:
        verbose_name = _("Info Text")
        verbose_name_plural = _("Info Texts")

    enabled = models.BooleanField(_("Enabled"), default=True)
    text = models.TextField(_("Quote"), blank=True, null=False, default="")

    def __unicode__(self):
        return self.text[:30]

    def get_content_model(self):
        return self

    def save(self, *args, **kwargs):
        """
        Set the description field on save.
        """
        super(InfoText, self).save(*args, **kwargs)
