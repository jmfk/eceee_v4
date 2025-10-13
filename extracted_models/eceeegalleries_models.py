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


class eceeeGalleryImage(Orderable):
    # Add more fields to this class, before replicating it for more page-classes.

    title = models.CharField(_("Title"), max_length=200, blank=False)
    url = models.CharField(_("URL"), max_length=500, blank=True, default="")
    gallery = models.ForeignKey(
        "eceeeGallery", related_name="images", on_delete=models.CASCADE
    )
    full_image = FileField(
        _("Full Size Image"),
        max_length=400,
        format="Image",
        upload_to=upload_to("eceee.Gallery.images", "gallery"),
        blank=True,
        null=True,
        default="",
    )
    half_image = FileField(
        _("Half Size Image"),
        max_length=400,
        format="Image",
        upload_to=upload_to("eceee.Gallery.images", "gallery"),
        blank=True,
        null=True,
        default="",
    )

    class Meta:
        verbose_name = _("Gallery Image")
        verbose_name_plural = _("Gallery Images")

    def __unicode__(self):
        return self.title

    def get_content_model(self):
        return self

    def save(self, *args, **kwargs):
        """
        Save indexed fields for event day, month, year (start event)
        """
        super(eceeeGalleryImage, self).save(*args, **kwargs)


class eceeeGallery(Displayable):
    """
    EceeeLibraryItem. All Pages should be based on this.
    """

    class Meta:
        verbose_name = _("Gallery Item")
        verbose_name_plural = _("Gallery Items")
        # app_label = 'briskee'

    def get_template(self):
        try:
            return self.template
        except:
            pass
        return "eceee_galleries/default_gallery.html"

    def get_content_model(self):
        return self

    def get_absolute_url(self, site_filter=None):
        return ""  # reverse('eceeelibrary-item', kwargs={'slug': self.slug} )

    def save(self, *args, **kwargs):
        """
        Set the description field on save.
        """
        if not self.slug:
            self.slug = slugify(self.title)
        super(eceeeGallery, self).save(*args, **kwargs)


from urllib.parse import urljoin
