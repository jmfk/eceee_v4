import re

from bs4 import BeautifulSoup
from django.contrib.contenttypes.fields import GenericForeignKey
from django.db import models
from django.urls import reverse
from django.utils.translation import gettext_lazy as _
from eceeebase.fields import GenericCategoriesField
from eceeebase.models import AccessLevelMixin, EceeeCategoryMixin
from eceeebase.value_lists import (
    possible_directorate_general,
    possible_labelling_status,
    possible_process_status,
)
from flexibledatefield.fields import FlexibleDateField
from mezzanine.core.fields import RichTextField
from mezzanine.core.managers import CurrentSiteManager, DisplayableManager
from mezzanine.core.models import Displayable, Orderable, RichText, Slugged


def find_lot_number(lot_txt):
    lots = set((100000,))
    lot_cat = re.compile("Lot ([0-9]+)").search(lot_txt)
    if lot_cat:
        for l in lot_cat.groups():
            try:
                l = int(l)
                lots.add(l)
            except:
                pass
    lots = list(lots)
    lots.sort()
    return lots[0]


class EcodesignCategoryManager(CurrentSiteManager):

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


class EcodesignCategory(Slugged):
    """
    Affiliations which are managed via a custom JavaScript based
    widget in the admin.
    """

    objects = EcodesignCategoryManager()

    class Meta:
        verbose_name = _("Ecodesign Category")
        verbose_name_plural = _("Ecodesign Categories")


class AssignedEcodesignCategory(Orderable):
    """
    A ``EcodesignCategory`` assigned to a model instance.
    """

    ecodesign_category = models.ForeignKey(
        "EcodesignCategory",
        verbose_name=_("Ecodesign Category"),
        related_name="ecodesign_categories",
        on_delete=models.CASCADE,
    )
    content_type = models.ForeignKey(
        "contenttypes.ContentType", on_delete=models.CASCADE
    )
    object_pk = models.IntegerField()
    content_object = GenericForeignKey("content_type", "object_pk")

    class Meta:
        order_with_respect_to = "content_object"

    def __str__(self):
        return self.ecodesign_category.title

    @classmethod
    def category_name(self):
        return "ecodesign_category"

    @classmethod
    def related_name(self):
        return "ecodesign_categories"


class LotCategoryManager(CurrentSiteManager):

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


class LotCategory(Slugged):
    """
    Affiliations which are managed via a custom JavaScript based
    widget in the admin.
    """

    objects = LotCategoryManager()

    class Meta:
        verbose_name = _("Lot Category")
        verbose_name_plural = _("Lot Categories")


class AssignedLotCategory(Orderable):
    """
    A ``LotCategory`` assigned to a model instance.
    """

    lot_category = models.ForeignKey(
        "LotCategory",
        verbose_name=_("Lot Category"),
        related_name="lot_categories",
        on_delete=models.CASCADE,
    )
    content_type = models.ForeignKey(
        "contenttypes.ContentType", on_delete=models.CASCADE
    )
    object_pk = models.IntegerField()
    content_object = GenericForeignKey("content_type", "object_pk")

    class Meta:
        order_with_respect_to = "content_object"

    def __str__(self):
        return self.lot_category.title

    @classmethod
    def category_name(self):
        return "lot_category"

    @classmethod
    def related_name(self):
        return "lot_categories"


class RegulationCategoryManager(CurrentSiteManager):

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


class RegulationCategory(Slugged):
    """
    Affiliations which are managed via a custom JavaScript based
    widget in the admin.
    """

    objects = RegulationCategoryManager()

    class Meta:
        verbose_name = _("Regulation Category")
        verbose_name_plural = _("Regulation Categories")


class AssignedRegulationCategory(Orderable):
    """
    A ``RegulationCategory`` assigned to a model instance.
    """

    regulation_category = models.ForeignKey(
        "RegulationCategory",
        verbose_name=_("Regulation Category"),
        related_name="regulation_categories",
        on_delete=models.CASCADE,
    )
    content_type = models.ForeignKey(
        "contenttypes.ContentType", on_delete=models.CASCADE
    )
    object_pk = models.IntegerField()
    content_object = GenericForeignKey("content_type", "object_pk")

    class Meta:
        order_with_respect_to = "content_object"

    def __str__(self):
        return self.regulation_category.title

    @classmethod
    def category_name(self):
        return "regulation_category"

    @classmethod
    def related_name(self):
        return "regulation_categories"


class EcoDesignProductManager(DisplayableManager):

    def get_everything(self):
        return self._queryset_class(self.model, using=self._db, hints=self._hints)


class EcoDesignProduct(AccessLevelMixin, EceeeCategoryMixin, Displayable, RichText):
    """
    Basic EcoDesign Product. All Pages should be based on this.
    """

    objects = EcoDesignProductManager()

    class Meta:
        verbose_name = _("Ecodesign Product")
        verbose_name_plural = _("Ecodesign Products")

    # Base
    page_header = models.CharField(
        _("Page Header"), max_length=400, blank=True, default="", editable=True
    )
    categories = GenericCategoriesField(
        "eceeebase.models.AssignedCategory",
        "eceeebase.models.Category",
        verbose_name=_("Categories"),
    )
    ecodesign_categories = GenericCategoriesField(
        "ecodesign.models.AssignedEcodesignCategory",
        "ecodesign.models.EcodesignCategory",
        category_name="ecodesign_category",
        verbose_name=_("Ecodesign Categories"),
    )
    lot_categories = GenericCategoriesField(
        "ecodesign.models.AssignedLotCategory",
        "ecodesign.models.LotCategory",
        category_name="lot_category",
        verbose_name=_("Lot Categories"),
    )
    regulation_categories = GenericCategoriesField(
        "ecodesign.models.AssignedRegulationCategory",
        "ecodesign.models.RegulationCategory",
        category_name="regulation_category",
        verbose_name=_("Regulation Categories"),
    )
    page_layout = "layout_content"

    hide_widgets_r1 = models.BooleanField(
        _("Hide Widgets (right1)"), default=False, db_index=False
    )
    hide_widgets_r2 = models.BooleanField(
        _("Hide Widgets (right2)"), default=False, db_index=False
    )

    process_status = models.CharField(
        _("Process Status"),
        max_length=400,
        blank=True,
        db_index=True,
        default=possible_process_status[0][0],
        choices=possible_process_status,
    )
    revision = models.BooleanField(_("Process Revision"), default=False, db_index=True)
    process_status_description = models.TextField(_("Process Status Description"))
    product_lot_and_study = models.TextField(_("Product lot and study"))
    product_voluntary = models.BooleanField(
        _("Process Voluntary"), default=False, db_index=True
    )
    lot_max = models.IntegerField(
        _("LOT Max Number"), default=0, blank=False, db_index=True, editable=False
    )
    lot_min = models.IntegerField(
        _("LOT Min Number"), default=100000, blank=False, db_index=True, editable=False
    )

    directorate_general = models.IntegerField(
        _("Directorate General"),
        db_index=True,
        default=possible_directorate_general[1][0],
        choices=possible_directorate_general,
    )

    labelling_status = models.CharField(
        _("Labelling Status"),
        max_length=400,
        db_index=True,
        default=possible_labelling_status[0][0],
        choices=possible_labelling_status,
    )
    labelling_revision = models.BooleanField(
        _("Labelling Revision"), default=False, db_index=True
    )

    last_change_date = models.DateTimeField(
        _("Last Change Date"), null=True, blank=True, db_index=True
    )

    def process_show(self):
        if self.process_status[0:2] not in ["03", "04", "05", "06", "07"]:
            return "hide"
        return ""

    def process_status_label(self):
        return self.process_status[4:]

    def process_revision_class(self):
        return self.revision and " review" or ""

    def process_status_class(self):
        # return self.revision and ' ecod-status-blue' or ''
        process_map = {
            "01": None,
            "02": None,  #'White',
            "03": "ecod-status-blue",
            "04": "ecod-status-red",
            "05": "ecod-status-orange",
            "06": "ecod-status-yellow",
            "07": "ecod-status-green",
            "08": "ecod-status-red",
            "09": "ecod-status-orange",
            "10": "ecod-status-green",
            "11": "ecod-status-blue",
        }
        icon_name = process_map.get(self.process_status[0:2])
        return icon_name

    def is_voluntary(self):
        return self.process_status[0:2] in ["08", "09", "10", "11"]

    def labelling_show(self):
        if self.labelling_status[0:2] not in ["03", "04", "05", "06", "07"]:
            return "hide"
        return ""

    def labelling_status_label(self):
        return self.labelling_status[4:]

    def labelling_revision_class(self):
        return self.labelling_revision and " review" or ""

    def labelling_status_class(self):
        process_map = {
            "01": None,
            "02": None,  #'White',
            "03": "labelling-status-blue",
            "04": "labelling-status-red",
            "05": "labelling-status-orange",
            "06": "labelling-status-yellow",
            "07": "labelling-status-green",
            "08": "labelling-status-red",
            "09": "labelling-status-orange",
            "10": "labelling-status-green",
            "11": "labelling-status-blue",
        }
        icon_name = process_map.get(self.labelling_status[0:2])
        return icon_name

    def nav_title(self):
        return self.title

    def get_absolute_url(self):
        return reverse("ecodesign-product", args=(self.slug,))

    def product_status_icon(self):
        process_icon_name_map = {
            "01": None,
            "02": None,  #'White',
            "03": "Blue",
            "04": "Red",
            "05": "Orange",
            "06": "Yellow",
            "07": "Green",
            "08": "Red",
            "09": "Orange",
            "10": "Green",
            "11": "Blue",
        }
        icon_name = process_icon_name_map.get(self.process_status[0:2])
        if icon_name:
            # if self.product_voluntary:
            #    icon_name += 'Voluntary'
            if self.revision:
                icon_name += "Review"
            return "img/productsearch/" + icon_name + ".png"

    def labelling_status_icon(self):
        process_icon_name_map = {
            "01": None,
            "02": None,  # ,
            "03": "BlueLabelling",
            "04": "RedLabelling",
            "05": "OrangeLabelling",
            "06": "YellowLabelling",
            "07": "GreenLabelling",
            "08": "RedLabelling",
            "09": "OrangeLabelling",
            "10": "GreenLabelling",
            "11": "BlueLabelling",
        }
        icon_name = process_icon_name_map.get(self.labelling_status[0:2])
        if icon_name:
            # if self.labelling_voluntary:
            #    icon_name += 'Voluntary'
            if self.labelling_revision:
                icon_name += "Review"
            return "img/productsearch/" + icon_name + ".png"

    def as_dict(self):
        return {
            "id": self.id,
            "permalink": self.get_absolute_url(),
            "title": self.title,
            "keywords": list(self.keywords.all()),
            "process_status_description": self.process_status_description,
            "product_status_icon": self.product_status_icon(),
            "labelling_status_icon": self.labelling_status_icon(),
            "process_status": self.process_status,
            "revision": self.revision,
            "product_lot_and_study": self.product_lot_and_study,
            "labelling_status": self.labelling_status,
            "labelling_revision": self.labelling_revision,
            "labelling_status_description": self.labelling_status_description,
            "last_change_date": self.last_change_date,
        }

    def save(self, *args, **kwargs):
        """
        Extract lot with lowest number and save the number
        """
        lot_max = 0
        lot_min = 100000
        for lot in self.lot_categories.all():
            lot_nr = find_lot_number(lot.lot_category.title)
            lot_max = max(lot_max, lot_nr)
            lot_min = min(lot_min, lot_nr)
        self.lot_max = lot_max
        self.lot_min = lot_min
        super(EcoDesignProduct, self).save(*args, **kwargs)


class EcoDesignChangeEvent(Orderable):

    product = models.ForeignKey(
        "EcoDesignProduct", related_name="changes", on_delete=models.CASCADE
    )
    content = RichTextField(_("Key Documents"), blank=True)
    process = models.CharField(_("Process"), max_length=400, blank=True, default="")
    change_date = models.DateTimeField(_("Change Date"), blank=True, null=True)

    event_date = FlexibleDateField(_("Change Date 2"), blank=True, null=True)
    event_year = models.CharField(
        default=None, null=True, db_index=True, editable=False, max_length=4
    )
    event_yearmonth = models.CharField(
        default=None, null=True, db_index=True, editable=False, max_length=6
    )
    month = models.IntegerField(
        _("Change Month"), null=True, blank=True, editable=False
    )
    day = models.IntegerField(_("Change Day"), null=True, blank=True, editable=False)
    show_in_calendar = models.BooleanField(
        _("Show in Ecodesign Calender"), default=False
    )

    class Meta:
        verbose_name = _("Ecodesign Change Event")
        verbose_name_plural = _("Ecodesign Change Events")

    def __str__(self):
        return "{0}, {1}".format(self.product.title, self.process)

    def get_content_model(self):
        return self

    @property
    def slug(self, site_filter=None):
        return reverse("ecodesign-product", kwargs={"slug": self.product.slug})

    def get_absolute_url(self, site_filter=None):
        return reverse("ecodesign-product", kwargs={"slug": self.product.slug})

    def description(self):
        return "{0}, {1}".format(self.product.title, self.process)

    def save(self, *args, **kwargs):
        """
        Save indexed fields for event day, month, year (start event)
        """
        try:
            self.event_year = "{0:04d}".format(self.event_date.year)
        except:
            self.event_year = None
        try:
            self.event_yearmonth = "{0:04d}{1:02d}".format(
                self.event_date.year, self.event_date.month
            )
        except:
            self.event_yearmonth = None

        super(EcoDesignChangeEvent, self).save(*args, **kwargs)


class EcoDesignProductWidget(Orderable):

    product = models.ForeignKey(
        "EcoDesignProduct", related_name="widgets", on_delete=models.CASCADE
    )
    content = RichTextField(_("Content"), blank=True)

    class Meta:
        verbose_name = _("Ecodesign Product Widget")
        verbose_name_plural = _("Ecodesign Product Widgets")

    def __unicode__(self):
        soup = BeautifulSoup(self.content, features="html.parser")
        text = soup.get_text()
        lines = (line.strip() for line in text.splitlines() if line.strip())
        return lines.next()

    def get_absolute_url(self):
        return reverse("ecodesign-product", kwargs={"slug": self.product.slug})


from django.db.models.signals import post_save


def assignedlotcategory_updated(instance, raw, created, **kwargs):
    obj = instance.content_object
    lot_max = 0
    lot_min = 100000
    for lot in obj.lot_categories.all():
        lot_nr = find_lot_number(lot.lot_category.title)
        lot_max = max(lot_max, lot_nr)
        lot_min = min(lot_min, lot_nr)
    obj.lot_max = lot_max
    obj.lot_min = lot_min
    # obj.save()


post_save.connect(assignedlotcategory_updated, AssignedLotCategory)

from urllib.parse import urljoin
