
import os
from string import punctuation
from urllib.parse import unquote, urljoin
from zipfile import ZipFile

from bs4 import BeautifulSoup
from bs4.element import *
from colorfield.fields import ColorField
from django import forms
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from django.core.cache import cache
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.db import models
from django.template.loader import render_to_string
from django.utils.translation import gettext_lazy as _
from easypublisher.fields import ListField
from easypublisher.models import AcquisitionMixin
from mezzanine.conf import settings
from mezzanine.core.fields import FileField, RichTextField
from mezzanine.core.managers import CurrentSiteManager, DisplayableManager
from mezzanine.core.models import Displayable, Orderable, RichText, Slugged
from mezzanine.generic.fields import CommentsField
from mezzanine.pages.models import Link, Page
from mezzanine.utils.importing import import_dotted_path
from mezzanine.utils.models import AdminThumbMixin, upload_to
from multiselectfield import MultiSelectField
from urllib3 import PoolManager, Timeout

from eceeebase.utils import _get_site_url, sitejoin
from eceeebase.value_lists import eceee_sites

from .fields import GenericCategoriesField, InheritCharField
from .value_lists import (possible_affiliation, possible_background_colors,
                          possible_categories, possible_countries,
                          possible_eceee_categories, possible_page_layouts,
                          possible_widget_heights, possible_widget_layouts,
                          possible_widget_slots, possible_widget_types,
                          possible_widget_visibility)

#from portlets.models import Portlet




class AffiliationManager(CurrentSiteManager):

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


class Affiliation(Slugged):
    """
    Affiliations which are managed via a custom JavaScript based
    widget in the admin.
    """

    objects = AffiliationManager()

    class Meta:
        verbose_name = _("Affiliation")
        verbose_name_plural = _("Affiliations")


#categories
class eceeeKeywordManager(CurrentSiteManager):

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


class eceeeKeyword(Slugged):
    """
    Categories which are managed via a custom JavaScript based
    widget in the admin.
    """

    objects = eceeeKeywordManager()

    class Meta:
        verbose_name = _("eceee Keyword")
        verbose_name_plural = _("eceee Keywords")


class AssignedeceeeKeyword(Orderable):
    """
    A ``Category`` assigned to a model instance.
    """

    keyword = models.ForeignKey("eceeeKeyword", verbose_name=_("Keyword"),
                                related_name="eceee_keywords", on_delete=models.CASCADE)
    content_type = models.ForeignKey("contenttypes.ContentType", on_delete=models.CASCADE)
    object_pk = models.IntegerField()
    content_object = GenericForeignKey("content_type", "object_pk")

    class Meta:
        order_with_respect_to = "content_object"

    def __str__(self):
        return str(self.keyword)

    @classmethod
    def keyword_name(self):
        return 'keyword'

    @classmethod
    def related_name(self):
        return 'eceee_keywords'


#categories
class CategoryManager(CurrentSiteManager):

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


class Category(Slugged):
    """
    Categories which are managed via a custom JavaScript based
    widget in the admin.
    """

    objects = CategoryManager()

    class Meta:
        verbose_name = _("Category")
        verbose_name_plural = _("Categories")


class AssignedCategory(Orderable):
    """
    A ``Category`` assigned to a model instance.
    """

    category = models.ForeignKey("Category", verbose_name=_("Category"),
                                related_name="categories", on_delete=models.CASCADE)
    content_type = models.ForeignKey("contenttypes.ContentType", on_delete=models.CASCADE)
    object_pk = models.IntegerField()
    content_object = GenericForeignKey("content_type", "object_pk")

    class Meta:
        order_with_respect_to = "content_object"

    def __str__(self):
        return str(self.category)

    @classmethod
    def category_name(self):
        return 'category'

    @classmethod
    def related_name(self):
        return 'categories'


#eceee_categories
class eceeeCategoryManager(CurrentSiteManager):

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


class eceeeCategory(Slugged):
    """
    Affiliations which are managed via a custom JavaScript based
    widget in the admin.
    """

    objects = eceeeCategoryManager()

    class Meta:
        verbose_name = _("eceee Category")
        verbose_name_plural = _("eceee Categories")


class AssignedeceeeCategory(Orderable):
    """
    A ``eceeeCategory`` assigned to a model instance.
    """

    eceee_category = models.ForeignKey("eceeeCategory", verbose_name=_("eceee Category"),
                                related_name="eceee_categories", on_delete=models.CASCADE)
    content_type = models.ForeignKey("contenttypes.ContentType", on_delete=models.CASCADE)
    object_pk = models.IntegerField()
    content_object = GenericForeignKey("content_type", "object_pk")

    class Meta:
        order_with_respect_to = "content_object"

    def __str__(self):
        return str(self.eceee_category)

    @classmethod
    def category_name(self):
        return 'eceee_category'

    @classmethod
    def related_name(self):
        return 'eceee_categories'


#Mixins
class AccessLevelMixin(object):

    #atapi.StringField(
    #    'access_level',
    #    widget=atapi.StringWidget(
    #        label=_(u"Access Level"),
    #        description=_(u"Not implemented this way!??? Sets the level of access."),
    #        size=80,
    pass


class EceeeCategoryMixin(object):

    def getPossibleEceeeCategories(self):
        eceee_category=getattr(self, 'eceee_category', u'Inherit Parent Category')
        if eceee_category.startswith(u'Inherit'):
            value=self.getEceeeCategoryPresentation()
            values=list(possible_eceee_categories)
            values[0]= value
            return values
        return possible_eceee_categories

    def getEceeeCategory(self):
        eceee_category=getattr(self, 'eceee_category', u'Inherit Parent Category')
        if eceee_category.startswith(u'Inherit'):
            #folder=aq_parent(aq_inner(self))
            #if folder.id=='eceee':
            #    folder=getattr(folder, 'home', None)
            #func=getattr(folder, 'getEceeeCategory',None)
            #if func is None:
            #    return "Error"
            #return func()
            pass
        return eceee_category

    def getEceeeCategoryPresentation(self):
        eceee_category=getattr(self, 'eceee_category', u'Inherit Parent Category')
        if eceee_category.startswith(u'Inherit'):
            value=self.getEceeeCategory()
            return u"Inherits: "+value
        return eceee_category

    def set_default_titles(self, *args, **kwargs):
        """
        """
        if not self.page_header: self.page_header = self.title[:400]
        if not self.nav_title: self.nav_title = self.title[:40]


class WebPageWidget(Orderable):

    # Add more fields to this class, before replicating it for more page-classes.

    name = models.CharField(_("Name"), max_length=1000, blank=True, default='')
    #inherit = models.BooleanField(_("Inherit Parent"), default=False)
    content = RichTextField(_("WebPage Widget"), blank=True)
    webpage = models.ForeignKey("WebPage", related_name="widgets", on_delete=models.CASCADE)
    slot = models.CharField(_("Slot"), max_length=100, blank=True, default='right1', choices=possible_widget_slots, db_index=True)
    widget_type = models.CharField(_("Widget Type"), max_length=100, blank=True, default=possible_widget_types[0][0], choices=possible_widget_types)
    height = models.CharField(_("Block Heigh"), max_length=40, blank=True, null=True, default=possible_widget_heights[0][0], choices=possible_widget_heights)
    color = models.CharField(_("Block Background Color"), max_length=40, blank=True, null=True, default=possible_background_colors[0][0], choices=possible_background_colors)
    layout = models.CharField(_("Layout"), max_length=40, blank=True, null=True, default=possible_widget_layouts[0][0], choices=possible_widget_layouts)

    class Meta:
        verbose_name = _("WebPage Widget")
        verbose_name_plural = _("WebPage Widgets")

    @property
    def widget_type_label(self):
        return ' '.join([x[1] for x in possible_widget_types if x[0]==self.widget_type])

    @property
    def slot_label(self):
        return ' '.join([x[1] for x in possible_widget_slots if x[0]==self.slot])

    def __unicode__(self):
        if self.name:
            return "{} [{} ({})]".format(self.name, self.widget_type_label, self.slot_label)
        return "{} ({})".format(self.widget_type_label, self.slot_label)

    def get_content_model(self):
        return self

    def save(self, *args, **kwargs):
        """
        Save indexed fields for event day, month, year (start event)
        """
        super(WebPageWidget, self).save(*args, **kwargs)



#AttachedImages

# Set the directory where gallery images are uploaded to,
# either MEDIA_ROOT + 'galleries', or filebrowser's upload
# directory if being used.
GALLERY_UPLOAD_DIR = "gallery"
if settings.PACKAGE_NAME_FILEBROWSER in settings.INSTALLED_APPS:
    fb_settings = "%s.settings" % settings.PACKAGE_NAME_FILEBROWSER
    try:
        GALLERY_UPLOAD_DIR = import_dotted_path(fb_settings).DIRECTORY
    except ImportError:
        pass


class WebPageImage(Orderable):

    webpage = models.ForeignKey("WebPage", related_name="images", on_delete=models.CASCADE)
    file = FileField(_("File"), max_length=200, format="Image", upload_to=upload_to("eceee.Image.file", "gallery"))
    #description = models.CharField(_("Description"), max_length=1000, blank=True)
    description = models.TextField(_("Short Text"), blank=True, default='')
    #content = RichTextField(_("Rich Text"), blank=True)

    class Meta:
        verbose_name = _("Webpage Image")
        verbose_name_plural = _("Webpage Images")

    def __unicode__(self):
        return self.description

    def save(self, *args, **kwargs):
        """
        If no description is given when created, create one from the
        file name.
        """
        if not self.id and not self.description:
            name = unquote(self.file.url).split("/")[-1].rsplit(".", 1)[0]
            name = name.replace("'", "")
            name = "".join([c if c not in punctuation else " " for c in name])
            name = "".join([s.upper() if i == 0 or name[i - 1] == " " else s
                            for i, s in enumerate(name)])
            self.description = name
        super(WebPageImage, self).save(*args, **kwargs)


class WebPageManager(DisplayableManager):

    def get_everything(self):
        return self._queryset_class(self.model, using=self._db, hints=self._hints)


class WebPage(AcquisitionMixin, EceeeCategoryMixin, Page, RichText):
    """
    Basic WebPage. All Pages should be based on this.
    """

    objects = WebPageManager()

    class Meta:
        verbose_name = _("Web Page")
        verbose_name_plural = _("Web Pages")

    #Base
    page_header = models.CharField(_("Page Header"), max_length=400, blank=True, default='', editable=False)
    nav_title = models.CharField(_("Navigation Title"), max_length=80, blank=True, null=False, default='')
    categories = GenericCategoriesField('eceeebase.models.AssignedCategory', 'eceeebase.models.Category', verbose_name=_("Categories"))
    eceee_categories = GenericCategoriesField('eceeebase.models.AssignedeceeeCategory', 'eceeebase.models.eceeeCategory', category_name='eceee_category', verbose_name=_("eceee Categories"))
    page_layout = models.CharField(_("Page Layout"), max_length=200, blank=True, null=True, default=possible_page_layouts[0][0], choices=possible_page_layouts)

    view_widgets = models.CharField(_("Widget Visibility"), max_length=20, blank=True, null=True, default=possible_widget_visibility[0][0], choices=possible_widget_visibility)

    hide_widgets_r1 = models.BooleanField(_(u"Hide Widgets (right1)"), default=False, db_index=False)
    hide_widgets_r2 = models.BooleanField(_(u"Hide Widgets (right2)"), default=False, db_index=False)

    protected_text = RichTextField(_("Protected Body Text"), blank=True)
    protected_page = models.BooleanField(_(u"Protected Page (login required)"), default=False, db_index=False)
    zip_import = models.FileField(verbose_name=_("Zip import"), blank=True,
        upload_to=upload_to("eceee.WebPage.zip_import", "gallery"),
        help_text=_("Upload a zip file containing images, and "
                    "they'll be imported into this gallery."))

    def get_widgets(self, slot='right1'):
        """
        (u'default', u'No Inherited'),
        (u'prepend', u'Prepend Inherited'),
        (u'append', u'Append Inherited'),
        (u'inherited-only', u'Inherited Only'),
        """
        if self.view_widgets == 'default':
            return self.widgets.filter(slot=slot)
        else:
            inherited = ()
            if self.parent is None and self.slug!='/':
                home = Page.objects.filter(slug='/')
                if home.count()>0:
                    home = home[0]
                    home = home.get_content_model()
                    if hasattr(home, 'get_widgets'):
                        inherited = home.get_widgets(slot=slot)
            elif self.parent is not None:
                parent = self.parent.get_content_model()
                if hasattr(parent, 'get_widgets'):
                    inherited = self.parent.get_content_model().get_widgets(slot=slot)
            if self.view_widgets == 'prepend':
                inherited = tuple(inherited) + tuple(self.widgets.filter(slot=slot))
            elif self.view_widgets == 'append':
                inherited = tuple(self.widgets.filter(slot=slot)) + tuple(inherited)
        return inherited


    def save(self, delete_zip_import=True, *args, **kwargs):
        """
        If a zip file is uploaded, extract any images from it and add
        them to the gallery, before removing the zip file.
        """
        self.set_default_titles(*args, **kwargs)
        super(WebPage, self).save(*args, **kwargs)
        if self.zip_import:
            zip_file = ZipFile(self.zip_import)
            # import PIL in either of the two ways it can end up installed.
            try:
                from PIL import Image as PILImage
            except ImportError:
                import Image as PILImage
            for name in zip_file.namelist():
                data = zip_file.read(name)
                try:
                    image = PILImage.open(StringIO(data))
                    image.load()
                    image = PILImage.open(StringIO(data))
                    image.verify()
                except:
                    continue
                name = os.path.split(name)[1]
                path = os.path.join(GALLERY_UPLOAD_DIR, self.slug,
                                    name.decode("utf-8"))
                try:
                    saved_path = default_storage.save(path, ContentFile(data))
                except UnicodeEncodeError:
                    from warnings import warn
                    warn("A file was saved that contains unicode "
                         "characters in its path, but somehow the current "
                         "locale does not support utf-8. You may need to set "
                         "'LC_ALL' to a correct value, eg: 'en_US.UTF-8'.")
                    path = os.path.join(GALLERY_UPLOAD_DIR, self.slug,
                                        str(name, errors="ignore"))
                    saved_path = default_storage.save(path, ContentFile(data))
                self.images.add(Image(file=saved_path))
            if delete_zip_import:
                zip_file.close()
                self.zip_import.delete(save=True)


class PlaceholderPage(AcquisitionMixin, EceeeCategoryMixin, Page):
    class Meta:
        verbose_name = _("Placeholder Page")
        verbose_name_plural = _("Placeholder Pages")

    #Base
    page_header = models.CharField(_("Page Header"), max_length=400, blank=True, default='', editable=False)
    nav_title = models.CharField(_("Navigation Title"), max_length=80, blank=True, null=False, default='')
    page_layout = models.CharField(_("Page Layout"), max_length=200, blank=True, null=True, default=possible_page_layouts[0][0], choices=possible_page_layouts)

    hide_widgets_r1 = models.BooleanField(_(u"Hide Widgets (right1)"), default=False, db_index=False)
    hide_widgets_r2 = models.BooleanField(_(u"Hide Widgets (right2)"), default=False, db_index=False)

    def overridden(self):
        #This need to be overridden othervice it wouldn't be visible to edit if there is a urlpattern that match that slug.
        return False


class SubSitePage(AcquisitionMixin, EceeeCategoryMixin, Page, RichText):
    """
    Basic SubSitePage. All Pages should be based on this.
    """

    is_subsite = True

    class Meta:
        verbose_name = _("Sub Site Page")
        verbose_name_plural = _("Sub Site Pages")

    #Base
    page_header = models.CharField(_("Page Header"), max_length=400, blank=True, default='', editable=False)
    nav_title = models.CharField(_("Navigation Title"), max_length=80, blank=True, null=False, default='')
    categories = GenericCategoriesField('eceeebase.models.AssignedCategory', 'eceeebase.models.Category', verbose_name=_("Categories"))
    eceee_categories = GenericCategoriesField('eceeebase.models.AssignedeceeeCategory', 'eceeebase.models.eceeeCategory', category_name='eceee_category', verbose_name=_("eceee Categories"))
    page_layout = models.CharField(_("Page Layout"), max_length=200, blank=True, null=True, default=possible_page_layouts[0][0], choices=possible_page_layouts)

    hide_widgets_r1 = models.BooleanField(_(u"Hide Widgets (right1)"), default=False, db_index=False)
    hide_widgets_r2 = models.BooleanField(_(u"Hide Widgets (right2)"), default=False, db_index=False)


class HomePage(AcquisitionMixin, EceeeCategoryMixin, Page, RichText):
    """
    Basic WebPage. All Pages should be based on this.
    """

    class Meta:
        verbose_name = _("Home Page")
        verbose_name_plural = _("Home Pages")

    page_header = ''
    nav_title = 'Home'
    section = 'section-index'
    page_layout = 'layout_index'

    eceee_updates = RichTextField(_("eceee Updates"), blank=True)
    hide_widgets_r1 = models.BooleanField(_(u"Hide Widgets (right1)"), default=False, db_index=False)
    hide_widgets_r2 = models.BooleanField(_(u"Hide Widgets (right2)"), default=False, db_index=False)


    zip_import = models.FileField(verbose_name=_("Zip import"), blank=True,
        upload_to=upload_to("eceee.Image.file", "HomePage"),
        help_text=_("Upload a zip file containing images, and "
                    "they'll be imported into this gallery."))

    def save(self, delete_zip_import=True, *args, **kwargs):
        """
        If a zip file is uploaded, extract any images from it and add
        them to the gallery, before removing the zip file.
        """
        self.set_default_titles(*args, **kwargs)
        self.slug = '/'
        super(HomePage, self).save(*args, **kwargs)
        if self.zip_import:
            zip_file = ZipFile(self.zip_import)
            # import PIL in either of the two ways it can end up installed.
            try:
                from PIL import Image as PILImage
            except ImportError:
                import Image as PILImage
            for name in zip_file.namelist():
                data = zip_file.read(name)
                try:
                    image = PILImage.open(StringIO(data))
                    image.load()
                    image = PILImage.open(StringIO(data))
                    image.verify()
                except:
                    continue
                name = os.path.split(name)[1]
                path = os.path.join(GALLERY_UPLOAD_DIR, self.slug,
                                    name.decode("utf-8"))
                try:
                    saved_path = default_storage.save(path, ContentFile(data))
                except UnicodeEncodeError:
                    from warnings import warn
                    warn("A file was saved that contains unicode "
                         "characters in its path, but somehow the current "
                         "locale does not support utf-8. You may need to set "
                         "'LC_ALL' to a correct value, eg: 'en_US.UTF-8'.")
                    path = os.path.join(GALLERY_UPLOAD_DIR, self.slug, name)
                    saved_path = default_storage.save(path, ContentFile(data))
                self.images.add(Image(file=saved_path))
            if delete_zip_import:
                zip_file.close()
                self.zip_import.delete(save=True)


#depricated
class ThemePage(AcquisitionMixin, EceeeCategoryMixin, Page, RichText):
    """
    Basic ThemePage. All Pages should be based on this.
    """

    class Meta:
        verbose_name = _("eceee Theme Page")
        verbose_name_plural = _("eceee Theme Pages")

    #Base
    page_header = models.CharField(_("Page Header"), max_length=400, blank=True, default='', editable=False)
    nav_title = models.CharField(_("Navigation Title"), max_length=80, blank=True, null=False, default='')
    categories = GenericCategoriesField('eceeebase.models.AssignedCategory', 'eceeebase.models.Category', verbose_name=_("Categories"))
    eceee_categories = GenericCategoriesField('eceeebase.models.AssignedeceeeCategory', 'eceeebase.models.eceeeCategory', category_name='eceee_category', verbose_name=_("eceee Categories"))
    page_layout = models.CharField(_("Page Layout"), max_length=200, blank=True, null=True, default=possible_page_layouts[0][0], choices=possible_page_layouts)

    hide_widgets_r1 = models.BooleanField(_(u"Hide Widgets (right1)"), default=False, db_index=False)
    hide_widgets_r2 = models.BooleanField(_(u"Hide Widgets (right2)"), default=False, db_index=False)


#depricated
class ReportPage(AcquisitionMixin, EceeeCategoryMixin, Page, RichText):
    """
    Basic ReportPage. All Pages should be based on this.
    """

    class Meta:
        verbose_name = _("eceee Report Page")
        verbose_name_plural = _("eceee Report Pages")

    #Base
    page_header = models.CharField(_("Page Header"), max_length=400, blank=True, default='', editable=False)
    nav_title = models.CharField(_("Navigation Title"), max_length=80, blank=True, null=False, default='')
    categories = GenericCategoriesField('eceeebase.models.AssignedCategory', 'eceeebase.models.Category', verbose_name=_("Categories"))
    eceee_categories = GenericCategoriesField('eceeebase.models.AssignedeceeeCategory', 'eceeebase.models.eceeeCategory', category_name='eceee_category', verbose_name=_("eceee Categories"))
    page_layout = models.CharField(_("Page Layout"), max_length=200, blank=True, null=True, default=possible_page_layouts[0][0], choices=possible_page_layouts)

    presentational_publishing_date = models.DateTimeField(_('Presentational Publishing Date'), null=True, blank=True)
    #report_category = models.MultipleChoiceField(_("Report Categories"), default=[], choices=possible_categories)
    report_url = models.URLField(_("Report Web (URL)"), blank=True, default='')

    hide_widgets_r1 = models.BooleanField(_(u"Hide Widgets (right1)"), default=False, db_index=False)
    hide_widgets_r2 = models.BooleanField(_(u"Hide Widgets (right2)"), default=False, db_index=False)

#depricated
class ProjectPage(AcquisitionMixin, EceeeCategoryMixin, Page, RichText):
    """
    Basic ProjectPage. All Pages should be based on this.
    """

    class Meta:
        verbose_name = _("eceee Project Page")
        verbose_name_plural = _("eceee Project Pages")

    #Base
    page_header = models.CharField(_("Page Header"), max_length=400, blank=True, default='', editable=False)
    nav_title = models.CharField(_("Navigation Title"), max_length=80, blank=True, null=False, default='')
    categories = GenericCategoriesField('eceeebase.models.AssignedCategory', 'eceeebase.models.Category', verbose_name=_("Categories"))
    eceee_categories = GenericCategoriesField('eceeebase.models.AssignedeceeeCategory', 'eceeebase.models.eceeeCategory', category_name='eceee_category', verbose_name=_("eceee Categories"))
    page_layout = models.CharField(_("Page Layout"), max_length=200, blank=True, null=True, default=possible_page_layouts[0][0], choices=possible_page_layouts)

    #project_category = models.MultipleChoiceField(_("Project Categories"), default=[], choices=possible_categories)
    project_link = models.URLField(_("Project Link"), blank=True, default='')

    hide_widgets_r1 = models.BooleanField(_(u"Hide Widgets (right1)"), default=False, db_index=False)
    hide_widgets_r2 = models.BooleanField(_(u"Hide Widgets (right2)"), default=False, db_index=False)

#depricated
class NewsSubscription(AccessLevelMixin, AcquisitionMixin, EceeeCategoryMixin, Page, RichText):
    """
    Basic NewsSubscription. All Pages should be based on this.
    """

    class Meta:
        verbose_name = _("eceee News Subscription")
        verbose_name_plural = _("eceee News Subscriptions")

    #Base
    page_header = models.CharField(_("Page Header"), max_length=400, blank=True, default='', editable=False)
    nav_title = models.CharField(_("Navigation Title"), max_length=80, blank=True, null=False, default='')
    categories = GenericCategoriesField('eceeebase.models.AssignedCategory', 'eceeebase.models.Category', verbose_name=_("Categories"))
    eceee_categories = GenericCategoriesField('eceeebase.models.AssignedeceeeCategory', 'eceeebase.models.eceeeCategory', category_name='eceee_category', verbose_name=_("eceee Categories"))
    page_layout = models.CharField(_("Page Layout"), max_length=200, blank=True, null=True, default=possible_page_layouts[0][0], choices=possible_page_layouts)

    hide_widgets_r1 = models.BooleanField(_(u"Hide Widgets (right1)"), default=False, db_index=False)
    hide_widgets_r2 = models.BooleanField(_(u"Hide Widgets (right2)"), default=False, db_index=False)

    # atapi.TextField(
    #     'subscribe_confirmation',
    #     widget = atapi.RichWidget(
    #         label=_(u"Subscribe confirmation text"),
    #         description=_(u""),
    #         rows = 25,
    #         allow_file_upload = zconf.ATDocument.allow_document_upload,
    #     ),
    #     required=True,
    # ),

    # atapi.TextField(
    #     'unsubscribe_confirmation',
    #     widget = atapi.RichWidget(
    #         label=_(u"Unubscribe confirmation text"),
    #         description=_(u""),
    #         rows = 25,
    #         allow_file_upload = zconf.ATDocument.allow_document_upload,
    #     ),
    #     required=True,
    # ),

    # atapi.StringField(
    #     'to_email',
    #     widget = atapi.StringWidget(
    #         label=_(u"To Email"),
    #         description=_(u"The subscribe/unsubscribe requests are sent here"),
    #     ),
    #     validators=('isEmail',),
    #     required=True,
    # ),

    # atapi.TextField(
    #     'email_body',
    #     widget = atapi.TextAreaWidget(
    #         label=_(u"Email Body"),
    #         description=_(u"Use %(email)s, %(action)s, %(tofrom)s and %(newsletter)s where appropriate."),
    #         rows = 10,
    #     ),
    #     required=True,
    # ),

#depricated
class EcoDesign(AccessLevelMixin, AcquisitionMixin, EceeeCategoryMixin, Page, RichText):
    """
    Basic EcoDesign. All Pages should be based on this.
    """

    class Meta:
        verbose_name = _("eceee Ecodesign")
        verbose_name_plural = _("eceee Ecodesigns")

    #Base
    page_header = models.CharField(_("Page Header"), max_length=400, blank=True, default='', editable=False)
    nav_title = models.CharField(_("Navigation Title"), max_length=80, blank=True, null=False, default='')
    categories = GenericCategoriesField('eceeebase.models.AssignedCategory', 'eceeebase.models.Category', verbose_name=_("Categories"))
    eceee_categories = GenericCategoriesField('eceeebase.models.AssignedeceeeCategory', 'eceeebase.models.eceeeCategory', category_name='eceee_category', verbose_name=_("eceee Categories"))
    page_layout = models.CharField(_("Page Layout"), max_length=200, blank=True, null=True, default=possible_page_layouts[0][0], choices=possible_page_layouts)

    hide_widgets_r1 = models.BooleanField(_(u"Hide Widgets (right1)"), default=False, db_index=False)
    hide_widgets_r2 = models.BooleanField(_(u"Hide Widgets (right2)"), default=False, db_index=False)

    #absolute_url

event_types = ((u"Conference", u"Conference")
             , (u"Closed meeting", u"Closed meeting")
             , (u"Calls", u"Calls")
             , (u"Course", u"Course")
             , (u"Seminar", u"Seminar")
             , (u"Workshop", u"Workshop")
             , (u"Webinar", u"Webinar")
             )

event_categories = ( (u"Climate", u"Climate")
                   , (u"Energy efficiency", u"Energy efficiency")
                   , (u"Policy", u"Policy")
                   , (u"Renewables", u"Renewables")
                   , (u"Technology", u"Technology")
                )

#depricated
class CalenderEvent(AccessLevelMixin, EceeeCategoryMixin, Displayable, RichText):
    """
    Basic Calender Event. All Pages should be based on this.
    """

    class Meta:
        verbose_name = _("eceee Calender Event")
        verbose_name_plural = _("eceee Calender Events")

    #Base
    page_header = models.CharField(_("Page Header"), max_length=400, blank=True, default='', editable=False)
    #nav_title = models.CharField(_("Navigation Title"), max_length=80, blank=True, null=False, default='')
    categories = GenericCategoriesField('eceeebase.models.AssignedCategory', 'eceeebase.models.Category', verbose_name=_("Categories"))
    eceee_categories = GenericCategoriesField('eceeebase.models.AssignedeceeeCategory', 'eceeebase.models.eceeeCategory', category_name='eceee_category', verbose_name=_("eceee Categories"))
    page_layout = "layout_event"

    event_type = models.CharField(_("Event Type"), max_length=200, blank=True, null=True
            , default=event_types[0][0], choices=event_types)
    event_categories = MultiSelectField(_("Event Categories"), choices=event_categories)
    organiser = models.CharField(_("Organiser"), max_length=80, blank=True, default='')
    focus_areas = models.CharField(_("Focus Areas"), max_length=80, blank=True, default='')
    venue = models.CharField(_("Venue"), max_length=80, blank=True, default='')
    show_in_right_column = models.BooleanField(_("Show in Right Column"), default=False)
    priority = models.BooleanField(_("Priority"), default=False)
    quote = models.CharField(_("Quote"), max_length=1000, blank=True, default='')

    hide_widgets_r1 = models.BooleanField(_(u"Hide Widgets (right1)"), default=False, db_index=False)
    hide_widgets_r2 = models.BooleanField(_(u"Hide Widgets (right2)"), default=False, db_index=False)

    #absolute_url



class EmbedPage(AcquisitionMixin, EceeeCategoryMixin, Page):
    """
    Embeds page via an Iframe
    """

    class Meta:
        verbose_name = _("Embed Page")
        verbose_name_plural = _("Embed Pages")

    nav_title = models.CharField(_("Navigation Title"), max_length=80, blank=True, null=False, default='')
    page_layout = models.CharField(_("Page Layout"), max_length=200, blank=True, null=True, default='layout_wide', choices=possible_page_layouts)
    embed_url = models.CharField(_("Embedded URL"), max_length=2000, blank=True, null=True, default="")
    height = models.IntegerField(_("Height of iframe in pixels"), blank=False, null=False, default=300)

    def save(self, *args, **kwargs):
        """
        If a zip file is uploaded, extract any images from it and add
        them to the gallery, before removing the zip file.
        """
        super(EmbedPage, self).save(*args, **kwargs)


#eceeeColor
class eceeeColorManager(CurrentSiteManager):
    pass


class eceeeColor(Slugged):
    """
    Categories which are managed via a custom JavaScript based
    widget in the admin.
    """

    objects = eceeeColorManager()

    foreground_color = ColorField(default='#000000')
    background_color = ColorField(default='#995533')

    class Meta:
        verbose_name = _("eceee Color")
        verbose_name_plural = _("eceee Colors")


# not needed
# from mezzanine.forms.models import Form
# class FlatFormManager(CurrentSiteManager):
#     pass

# class FlatForm(Form):
#     objects = FlatFormManager()

#     class Meta:
#         verbose_name = _("Flat Form")
#         verbose_name_plural = _("Flat Forms")



from urllib.parse import urljoin
