
import datetime
import os
from string import punctuation
from urllib.parse import unquote
from zipfile import ZipFile

from bs4 import BeautifulSoup
from django import forms
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.db import models
from django.template.loader import render_to_string
from django.urls import reverse
from django.utils.text import slugify
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

#models.Model):

class eceeeQuotes(Orderable):
    """
    Eceee Quotes
    """

    class Meta:
        verbose_name = _("Quote")
        verbose_name_plural = _("Quotes")

    enabled = models.BooleanField(_("Enabled"), default=True)
    quote = models.TextField(_("Quote"), max_length=160, blank=True, null=False, default='')
    author = models.CharField(_("Author"), max_length=160, blank=True, null=False, default='')
    url = models.URLField(_("URL (optional)"), null=False, blank=True, default="")
    collection = models.ForeignKey("eceeeQuotesCollection", related_name="quotes", on_delete=models.CASCADE)

    def __unicode__(self):
        return self.quote[:30]

    def get_content_model(self):
        return self

    def save(self, *args, **kwargs):
        """
        Set the description field on save.
        """
        super(eceeeQuotes, self).save(*args, **kwargs)


class eceeeQuotesCollection(models.Model):
    """
    A collection of quoates
    """

    class Meta:
        verbose_name = _("eceee Quotes Collection")

    name = models.CharField(_("Name"), max_length=160, blank=False, null=False)

    def __unicode__(self):
        return self.name

    def get_content_model(self):
        return self

from urllib.parse import urljoin
