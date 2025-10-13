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
from django.template.loader import render_to_string
from django.urls import reverse
from django.utils.translation import gettext_lazy as _
from easypublisher.models import AcquisitionMixin
from eceeebase.fields import GenericCategoriesField
from mezzanine.conf import settings
from mezzanine.core.fields import FileField, RichTextField
from mezzanine.core.managers import CurrentSiteManager, DisplayableManager
from mezzanine.core.models import Displayable, Orderable, RichText, Slugged
from mezzanine.generic.fields import CommentsField
from mezzanine.pages.models import Link, Page
from mezzanine.utils.importing import import_dotted_path
from mezzanine.utils.models import AdminThumbMixin, upload_to
from orderable.models import Orderable as SpecialOrderable

#from .value_lists import possible_affiliation, possible_categories, possible_countries, possible_eceee_categories
from .value_lists import possible_page_layouts

#from portlets.models import Portlet





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


class BriskeeWebPageImage(Orderable):

    webpage = models.ForeignKey("BriskeeWebPage", related_name="images", on_delete=models.CASCADE)
    file = FileField(_("File"), max_length=200, format="Image", upload_to=upload_to("Briskee.Image.file", "gallery"))
    description = models.CharField(_("Description"), max_length=1000, blank=True)

    class Meta:
        verbose_name = _("Briskee Image")
        verbose_name_plural = _("Briskee Images")

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
        super(BriskeeWebPageImage, self).save(*args, **kwargs)



class BriskeeWebPage(AcquisitionMixin, Page, RichText):
    """
    Basic BriskeeWebPage. All Pages should be based on this.
    """

    class Meta:
        verbose_name = _("Briskee Web Page")
        verbose_name_plural = _("Briskee Web Pages")

    nav_title = models.CharField(_("Navigation Title"), max_length=40, blank=True, null=False, default='')
    page_layout = models.CharField(_("Page Layout"), max_length=200, blank=True, null=True, default=possible_page_layouts[0][0], choices=possible_page_layouts)
    submenu = RichTextField(_("Sub-menu"), blank=True, default="")

    zip_import = models.FileField(verbose_name=_("Zip import"), blank=True,
        upload_to=upload_to("briskee.BriskeeWebPage.zip_import", "gallery"),
        help_text=_("Upload a zip file containing images, and "
                    "they'll be imported into this gallery."))

    def save(self, delete_zip_import=True, *args, **kwargs):
        """
        If a zip file is uploaded, extract any images from it and add
        them to the gallery, before removing the zip file.
        """
        #self.set_default_titles(*args, **kwargs)
        if not self.nav_title:
            self.nav_title = self.title
        super(BriskeeWebPage, self).save(*args, **kwargs)
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


class BriskeeHomePage(AcquisitionMixin, Page, RichText):
    """
    Basic BriskeeHomePage. All Pages should be based on this.
    """

    class Meta:
        verbose_name = _("Briskee Home Page")
        verbose_name_plural = _("Briskee Home Pages")

    nav_title = models.CharField(_("Navigation Title"), max_length=40, blank=True, null=False, default=u'Home')
    page_layout = "layout_home"
    briskee = RichTextField(_("Briskee"), blank=True, default="")
    cheetah = RichTextField(_("Cheetah"), blank=True, default="")


class BriskeeLibraryCategoryManager(CurrentSiteManager):

    def get_by_natural_key(self, slug):
        """
        Provides natural key method.
        """
        return self.get(slug=slug)

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

    #def all(self):
    #    return BlogPost._base_manager.all()


class BriskeeLibraryCategory(SpecialOrderable, Slugged):
    """
    Affiliations which are managed via a custom JavaScript based
    widget in the admin.
    """

    objects = BriskeeLibraryCategoryManager()

    class Meta:
        verbose_name = _("Library Category")
        verbose_name_plural = _("Library Categories")
        app_label = 'briskee'

    def copy_to_site(self, site_id):
        if BriskeeLibraryCategory._base_manager.filter(slug=self.slug, site_id=site_id).count()>1:
            BriskeeLibraryCategory._base_manager.filter(slug=self.slug, site_id=site_id).delete()
        obj_copy, created = BriskeeLibraryCategory._base_manager.get_or_create(slug=self.slug, site_id=site_id, defaults={'title': self.title})
        return obj_copy



class AssignedBriskeeLibraryCategory(Orderable):
    """
    A ``AssignedBriskeeLibraryCategory`` assigned to a model instance.
    """

    library_category = models.ForeignKey("BriskeeLibraryCategory", verbose_name=_("Library Category"),
                                related_name="assigned_categories", on_delete=models.CASCADE)
    content_type = models.ForeignKey("contenttypes.ContentType", on_delete=models.CASCADE)
    object_pk = models.IntegerField()
    content_object = GenericForeignKey("content_type", "object_pk")

    class Meta:
        order_with_respect_to = "content_object"
        app_label = 'briskee'

    def __str__(self):
        return str(self.library_category)

    @classmethod
    def category_name(self):
        return 'library_category'

    @classmethod
    def related_name(self):
        return 'assigned_categories'


# New Category


class BriskeeLibraryRelatedManager(CurrentSiteManager):

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

    #def all(self):
    #    return BlogPost._base_manager.all()


class BriskeeLibraryRelated(SpecialOrderable, Slugged):
    """
    Affiliations which are managed via a custom JavaScript based
    widget in the admin.
    """

    objects = BriskeeLibraryRelatedManager()

    class Meta:
        verbose_name = _("Library Related Category")
        verbose_name_plural = _("Library Related Categories")
        app_label = 'briskee'

    def copy_to_site(self, site_id):
        if BriskeeLibraryRelated._base_manager.filter(slug=self.slug, site_id=site_id).count()>1:
            BriskeeLibraryRelated._base_manager.filter(slug=self.slug, site_id=site_id).delete()
        obj_copy, created = BriskeeLibraryRelated._base_manager.get_or_create(slug=self.slug, site_id=site_id, defaults={'title': self.title})
        return obj_copy



class AssignedBriskeeLibraryRelated(Orderable):
    """
    A ``AssignedBriskeeLibraryRelated`` assigned to a model instance.
    """

    library_related = models.ForeignKey("BriskeeLibraryRelated", verbose_name=_("Library Related Category"),
                                related_name="assigned_related_categories", on_delete=models.CASCADE)
    content_type = models.ForeignKey("contenttypes.ContentType", on_delete=models.CASCADE)
    object_pk = models.IntegerField()
    content_object = GenericForeignKey("content_type", "object_pk")

    class Meta:
        order_with_respect_to = "content_object"
        app_label = 'briskee'

    def __str__(self):
        return str(self.library_related)

    @classmethod
    def category_name(self):
        return 'library_related'

    @classmethod
    def related_name(self):
        return 'assigned_related_categories'




PROJECTS = (('briskee', 'Briskee'), ('cheetah', 'Cheetah'), ('external', 'External'))

class BriskeeLibraryItemManager(DisplayableManager):

    def clone_to_site(self, site_id, objs=None):
        clones = []
        if objs is not None:
            for obj in objs:
                clone = self.create(
                    site_id=site_id,
                    status=obj.status,
                    publish_date=obj.publish_date,
                    expiry_date=obj.expiry_date,
                    title=obj.title,
                    content=obj.content,
                    description=obj.description,
                    gen_description=obj.gen_description,

                    file=obj.file,
                    file_title=obj.file_title,
                    url=obj.url,
                    submenu=obj.submenu,
                    derivable_number=obj.derivable_number,
                    derivable_title=obj.derivable_title,
                    project=obj.project,
                )
                clone.save()
                for category in obj.library_categories.all():
                    new_category = category.library_category.copy_to_site(site_id=site_id)
                    AssignedBriskeeLibraryCategory.objects.create(content_object=clone, library_category=new_category)
                clones.append(clone)
        return clones


class BriskeeLibraryItem(AcquisitionMixin, Displayable, RichText):
    """
    BriskeeLibraryItem. All Pages should be based on this.

    Change:
    BRISKEE by Deliverables
    Derivable number (D5.2)
    Derivable title

    CHEETAH by Deliverables
    Derivable number (D5.2)
    Derivable title

    """

    class Meta:
        verbose_name = _("Briskee Library Item")
        verbose_name_plural = _("Briskee Library Items")
        app_label = 'briskee'

    objects = BriskeeLibraryItemManager()

    page_layout = 'layout_content'

    file = FileField(_("File"), max_length=200, format="File", upload_to=upload_to("briskee.Library.file", "library"), null=True, blank=True)
    file_title = models.CharField(_("Title (File)"), null=False, blank=False, max_length=200, default="Download Report")
    url = models.URLField(_("External URL"), null=False, blank=True, default="")
    submenu = RichTextField(_("Sub-menu"), blank=True, default="")
    library_categories = GenericCategoriesField('briskee.models.AssignedBriskeeLibraryCategory', 'briskee.models.BriskeeLibraryCategory', category_name='library_category', verbose_name=_("Library Categories"))
    library_related_categories = GenericCategoriesField('briskee.models.AssignedBriskeeLibraryRelated', 'briskee.models.BriskeeLibraryRelated', category_name='library_related', verbose_name=_("Library Related Categories"))
    derivable_number = models.CharField(_("Derivable Number"), max_length=10, blank=True, null=False, default='')
    derivable_title = models.CharField(_("Derivable Title"), max_length=260, blank=True, null=False, default='')
    project = models.CharField(_("Project"), max_length=260, blank=False, null=False, choices=PROJECTS, default=PROJECTS[0][0])

    @property
    def project_name(self):
        for key, title in PROJECTS:
            if self.project==key:
                return title
        return ''

    def get_content_model(self):
        return self

    def get_absolute_url(self):
        return reverse('libarary_item', kwargs={'slug': self.slug} )

    def save(self, *args, **kwargs):
        """
        Set the description field on save.
        """
        if self.description:
            self.gen_description = False
        else:
            self.gen_description = True
        super(BriskeeLibraryItem, self).save(*args, **kwargs)

from . import easy_widgets
