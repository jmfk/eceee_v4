
import datetime
import os
from string import punctuation
from urllib.parse import unquote, urljoin
from zipfile import ZipFile

from bs4 import BeautifulSoup
from django import forms
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from django.core.cache import cache
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.db import models
from django.template.loader import render_to_string
from django.urls import reverse
from django.utils.translation import gettext_lazy as _
from easypublisher.fields import ListField
from easypublisher.models import AcquisitionMixin
from eceeebase.fields import GenericCategoriesField, InheritCharField
from eceeebase.utils import _get_site_url, sitejoin
from eceeebase.value_lists import eceee_sites
from flexibledatefield.fields import FlexibleDateField
from mezzanine.conf import settings
from mezzanine.core.fields import FileField, RichTextField
from mezzanine.core.managers import CurrentSiteManager, DisplayableManager
from mezzanine.core.models import Displayable, Orderable, RichText, Slugged
from mezzanine.generic.fields import CommentsField
from mezzanine.generic.models import AssignedKeyword, Keyword
from mezzanine.pages.models import Link, Page
from mezzanine.utils.importing import import_dotted_path
from mezzanine.utils.models import AdminThumbMixin, upload_to
from multiselectfield import MultiSelectField
from orderable.models import Orderable as SpecialOrderable
from urllib3 import PoolManager, Timeout


class eceeeLibraryCategoryManager(CurrentSiteManager):

    def get_by_natural_key(self, value):
        """
        Provides natural key method.
        """
        return self.get(value=value)

    def get_or_create_iexact(self, **kwargs):
        """
        Case insensitive title version of ``get_or_create``. Also
        allows for multiple existing results.
        """
        lookup = dict(**kwargs)
        try:
            lookup["title__iexact"] = lookup.pop("title")
        except KeyError:
            pass
        try:
            return self.filter(**lookup)[0], False
        except IndexError:
            return self.create(**kwargs), True


class eceeeLibraryCategory(SpecialOrderable, Slugged):
    """
    Affiliations which are managed via a custom JavaScript based
    widget in the admin.
    """

    parent = models.ForeignKey("eceeeLibraryCategory", verbose_name=_("Parent Category"),
                               related_name="children", null=True, blank=True,
                               default=None, on_delete=models.CASCADE)

    objects = eceeeLibraryCategoryManager()

    class Meta:
        verbose_name = _("Library Category")
        verbose_name_plural = _("Library Categories")
        #app_label = 'myproject.eceeelibrary'



class AssignedeceeeLibraryCategory(Orderable):
    """
    A ``AssignedeceeeLibraryCategory`` assigned to a model instance.
    """

    library_category = models.ForeignKey("eceeeLibraryCategory",
                                         verbose_name=_("Library Category"),
                                related_name="assigned_categories", on_delete=models.CASCADE)
    content_type = models.ForeignKey("contenttypes.ContentType", on_delete=models.CASCADE)
    object_pk = models.IntegerField()
    content_object = GenericForeignKey("content_type", "object_pk")

    class Meta:
        order_with_respect_to = "content_object"
        #app_label = 'briskee'

    def __str__(self):
        return str(self.library_category.title)


class EceeeLibraryItemManager(DisplayableManager):

    def get_everything(self):
        return self._queryset_class(self.model, using=self._db, hints=self._hints)


class EceeeLibraryItem(AcquisitionMixin, Displayable, RichText):
    """
    EceeeLibraryItem. All Pages should be based on this.
    """

    objects = EceeeLibraryItemManager()

    class Meta:
        verbose_name = _("Library Item")
        verbose_name_plural = _("Library Items")

    page_layout = 'layout_content'

    eceee_sites = MultiSelectField(_("Show on Sites"), choices=eceee_sites)
    library_categories = GenericCategoriesField('eceeelibrary.models.AssignedeceeeLibraryCategory', 'eceeelibrary.models.eceeeLibraryCategory', category_name='library_category', verbose_name=_("Library Categories"))
    derivable_number = models.CharField(_("Derivable Number"), max_length=10, blank=True, null=False, default='')
    derivable_title = models.CharField(_("Derivable Title"), max_length=260, blank=True, null=False, default='')

    @property
    def get_site_url(self):
        return _get_site_url(self.site_id)

    def get_content_model(self):
        return self

    def get_absolute_url(self, prefix=None, site_filter=None):
        if prefix is not None:
            return os.path.join(prefix, self.slug)
        if self.slug:
            return self.slug
        if site_filter == 'eceee_ecodesign':
            return reverse('ecodesign-library-item', kwargs={'slug': self.slug} )
        return reverse('eceeelibrary-item', kwargs={'slug': self.slug} )

    def save(self, *args, **kwargs):
        """
        Set the description field on save.
        """
        self.gen_description = False
        super(EceeeLibraryItem, self).save(*args, **kwargs)


class EceeeLibraryFileItem(Orderable, Slugged):
    # title
    # slug
    item = models.ForeignKey(EceeeLibraryItem, verbose_name=_("Eceee Library Item"), related_name="fileitems", on_delete=models.CASCADE)
    file = FileField(_("File"), max_length=200, format="File", upload_to=upload_to("eceeelibrary.Library.file", "library"), null=True, blank=True)
    url = models.URLField(_("External URL"), null=False, blank=True, default="", max_length=2000)
    description = models.TextField(_("Description"), blank=True, default='')

    class Meta:
        verbose_name = _("Library File Item")
        verbose_name_plural = _("Library File Items")

    def __str__(self):
        return self.title

    def get_url(self):
        if self.file:
            return self.file.url
        return self.url

    def get_type(self):
        if self.file:
            return 'file'
        return 'url'

from urllib.parse import urljoin
