
import os
from string import punctuation
from urllib.parse import unquote
from zipfile import ZipFile
import datetime

from bs4 import BeautifulSoup

from django.db import models
from django import forms
from django.urls import reverse
from django.contrib.contenttypes.models import ContentType
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.utils.translation import gettext_lazy as _
from django.contrib.contenttypes.fields import GenericForeignKey

from django.template.loader import render_to_string
from django.utils.translation import gettext_lazy as _

from mezzanine.conf import settings
from mezzanine.core.fields import FileField
from mezzanine.core.models import Displayable, RichText
from mezzanine.core.models import Slugged, Orderable
from mezzanine.pages.models import Page, Link
from mezzanine.utils.importing import import_dotted_path
from mezzanine.utils.models import AdminThumbMixin, upload_to
from mezzanine.core.fields import RichTextField
from mezzanine.generic.fields import CommentsField
from mezzanine.core.managers import CurrentSiteManager, DisplayableManager
from mezzanine.generic.models import AssignedKeyword, Keyword

from multiselectfield import MultiSelectField
from flexibledatefield.fields import FlexibleDateField

from easypublisher.models import AcquisitionMixin
from easypublisher.fields import ListField

from eceeebase.fields import GenericCategoriesField, InheritCharField
from eceeebase.value_lists import eceee_sites


class EceeeViewsItemManager(DisplayableManager):
    pass


class EceeeViews(AcquisitionMixin, Displayable, RichText):
    """
    EceeeViews. All Pages should be based on this.
    """

    class Meta:
        verbose_name = _("Views Item")
        verbose_name_plural = _("Views Items")
        #app_label = 'briskee'

    page_layout = 'layout_content'

    objects = EceeeViewsItemManager()

    #page_header = models.CharField(_("Page Header"), max_length=400, blank=True, default='', editable=True)

    def get_content_model(self):
        return self

    def get_absolute_url(self, site_filter=None):
        return reverse('eceeeviews-item', kwargs={'slug': self.slug} )

    def save(self, *args, **kwargs):
        """
        Set the description field on save.
        """
        if self.description:
            self.gen_description = False
        else:
            self.gen_description = True
        #if self.page_header == '':
        #    self.page_header = self.title
        super(EceeeViews, self).save(*args, **kwargs)

