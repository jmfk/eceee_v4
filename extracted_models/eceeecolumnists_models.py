import os
from urllib.parse import unquote
from django.db import models
from django.db.models.signals import m2m_changed
from django.urls import reverse
from django.utils.translation import gettext_lazy as _
from easypublisher.models import AcquisitionMixin
from eceeebase.fields import GenericCategoriesField
from eceeebase.models import AccessLevelMixin, AcquisitionMixin, EceeeCategoryMixin
from eceeebase.utils import _get_site_url, sitejoin
from eceeebase.value_lists import eceee_sites
from eceeenews.models import KeywordsSubField
from mezzanine.core.fields import FileField
from mezzanine.core.managers import DisplayableManager
from mezzanine.core.models import Displayable, RichText
from mezzanine.utils.models import upload_to
from multiselectfield import MultiSelectField


class EceeeColumnistManager(DisplayableManager):
    def get_everything(self):
        return self._queryset_class(self.model, using=self._db, hints=self._hints)


class EceeeColumnist(
    AccessLevelMixin, AcquisitionMixin, EceeeCategoryMixin, Displayable, RichText
):
    objects = EceeeColumnistManager()

    class Meta:
        verbose_name = _("Columnist")
        verbose_name_plural = _("Columnist")

    nav_title = models.CharField(
        _("Navigation Title"), max_length=80, blank=True, null=False, default=""
    )
    categories = GenericCategoriesField(
        "eceeebase.models.AssignedCategory",
        "eceeebase.models.Category",
        verbose_name=_("Categories"),
    )
    eceee_categories = GenericCategoriesField(
        "eceeebase.models.AssignedeceeeCategory",
        "eceeebase.models.eceeeCategory",
        category_name="eceee_category",
        verbose_name=_("eceee Categories"),
    )

    horizontal_photo = FileField(
        _("Horizontal Photo"),
        max_length=200,
        format="Image",
        upload_to=upload_to("eceee.Image.file", "columnist"),
        blank=True,
        null=True,
    )
    vertical_photo = FileField(
        _("Vertical Photo"),
        max_length=200,
        format="Image",
        upload_to=upload_to("eceee.Image.file", "columnist"),
        blank=True,
        null=True,
    )
    square_photo = FileField(
        _("Squared Photo"),
        max_length=200,
        format="Image",
        upload_to=upload_to("eceee.Image.file", "columnist"),
        blank=True,
        null=True,
    )

    first_name = models.CharField(
        _("First Name"), max_length=40, blank=True, db_index=True
    )
    last_name = models.CharField(
        _("Last Name"), max_length=40, blank=True, db_index=True
    )
    affiliation = models.CharField(_("Affiliation"), max_length=120, blank=True)
    home_page = models.CharField(_("Home Page"), max_length=1000, blank=True)
    prefix = models.CharField(_("Prefix"), max_length=50, blank=True)

    last_column_date = models.DateTimeField(
        _("Presentational Publishing Date"),
        default=None,
        blank=True,
        null=True,
        editable=False,
        db_index=True,
    )
    yearmonth = models.CharField(
        _("Year Month for index"),
        max_length=10,
        default=None,
        blank=True,
        null=True,
        editable=False,
        db_index=True,
    )
    eceee_sites = MultiSelectField(_("Show on Sites"), choices=eceee_sites)

    @property
    def get_site_url(self):
        if self.site_id == 2:
            return "https://www.eceee.org"
        elif self.site_id == 7:
            return "https://www.mbenefits.org"
        elif self.site_id == 3:
            return "www.briskee-cheetah.eu"
        elif self.site_id == 6:
            return "https://www.mbenefits.org"
        return "https://www.eceee.org"

    def fullname(self):
        return self.first_name + " " + self.last_name

    def get_columns(self):
        return self.eceeecolumn_set.all().order_by("-presentational_publishing_date")

    def has_columns(self):
        return self.eceeecolumn_set.all().count() > 0

    def get_image(self):
        return self.square_photo or self.horizontal_photo or self.vertical_photo

    def get_image_class(self):
        if self.square_photo is not None:
            return "square_photo"
        if self.horizontal_photo is not None:
            return "horizontal_photo"
        if self.vertical_photo is not None:
            return "vertical_photo"
        return ""

    def get_absolute_url(self, prefix=None, site_filter=None):
        if prefix is not None:
            return os.path.join(prefix, self.slug)
        return reverse("columnist-item", kwargs={"slug": self.slug})

    @property
    def presentational_publishing_date(self):
        return self.last_column_date

    def save(self, *args, **kwargs):
        """Update yearmonth."""
        if (
            self.last_column_date is None
            and self.pk is not None
            and self.eceeecolumn_set.all().count() > 0
        ):
            last = self.get_columns()
            if last:
                last = last.first()
                self.last_column_date = last.presentational_publishing_date
                self.yearmonth = last.yearmonth
        super(EceeeColumnist, self).save(*args, **kwargs)


class EceeeColumnManager(DisplayableManager):
    def get_everything(self):
        return self._queryset_class(self.model, using=self._db, hints=self._hints)


class EceeeColumn(
    AccessLevelMixin, AcquisitionMixin, EceeeCategoryMixin, Displayable, RichText
):
    objects = EceeeColumnManager()

    class Meta:
        verbose_name = _("Column")
        verbose_name_plural = _("Column")

    nav_title = models.CharField(
        _("Navigation Title"), max_length=80, blank=True, null=False, default=""
    )
    categories = GenericCategoriesField(
        "eceeebase.models.AssignedCategory",
        "eceeebase.models.Category",
        verbose_name=_("Categories"),
    )
    eceee_categories = GenericCategoriesField(
        "eceeebase.models.AssignedeceeeCategory",
        "eceeebase.models.eceeeCategory",
        category_name="eceee_category",
        verbose_name=_("eceee Categories"),
    )

    presentational_publishing_date = models.DateTimeField(
        _("Presentational Publishing Date"), db_index=True
    )
    priority = models.BooleanField(default=False, verbose_name="Priority")

    keywords_sub = KeywordsSubField(
        verbose_name=_("Keyword sub"), editable=False
    )  # Disabled in admin
    related_newsitems = GenericCategoriesField(
        "eceeenews.models.AssignedRelatedNews",
        "eceeenews.models.RelatedNews",
        category_name="related_newsitem",
        verbose_name=_("Related News"),
    )

    columnists = models.ManyToManyField(EceeeColumnist)

    yearmonth = models.CharField(
        _("Year Month for index"),
        max_length=10,
        blank=True,
        null=True,
        default=None,
        editable=False,
        db_index=True,
    )
    eceee_sites = MultiSelectField(_("Show on Sites"), choices=eceee_sites)

    @property
    def get_site_url(self):
        if self.site_id == 2:
            return "https://www.eceee.org"
        elif self.site_id == 7:
            return "https://www.mbenefits.org"
        elif self.site_id == 3:
            return "www.briskee-cheetah.eu"
        elif self.site_id == 6:
            return "https://www.mbenefits.org"
        return "https://www.eceee.org"

    def get_columnists_text(self, limit=None, show_affiliation=False, seperator=", "):
        columnists = []
        filtered_columnists = self.columnists_ordered()
        if limit is not None:
            filtered_columnists = filtered_columnists[:limit]
        for columnist in filtered_columnists:
            affiliation = columnist.affiliation
            fullname = columnist.fullname()
            if show_affiliation:
                columnists.append("{0}, {1}".format(affiliation, fullname))
            else:
                columnists.append(fullname)
        return seperator.join(columnists)

    def get_columnists_html(self, limit=None, show_affiliation=False, seperator=", "):
        columnists = []
        filtered_columnists = self.columnists_ordered()
        if limit is not None:
            filtered_columnists = filtered_columnists[:limit]
        for columnist in filtered_columnists:
            affiliation = columnist.affiliation
            fullname = columnist.fullname()
            absolute_url = columnist.get_absolute_url()
            if show_affiliation:
                columnists.append(
                    '<a href="{0}">{1} {2}</a>'.format(
                        absolute_url, affiliation, fullname
                    )
                )
            else:
                columnists.append(
                    '<a href="{0}">{1}</a>'.format(absolute_url, fullname)
                )
        return seperator.join(columnists)

    def columnists_ordered(self):
        return EceeeColumnist.objects.get_everything().filter(eceeecolumn=self)

    def get_absolute_url(self, prefix=None, site_filter=None):
        if prefix is not None:
            return os.path.join(prefix, self.slug)
        return reverse("columns-item", kwargs={"slug": self.slug})

    def _calc_yearmonth(self):
        date = (
            self.presentational_publishing_date
            or self.source_date
            or self.publish_date
            or self.create
        )
        return "{0:04d}-{1:02d}".format(date.year, date.month)

    def save(self, *args, **kwargs):
        """Update yearmonth."""
        if self.yearmonth is None:
            self.yearmonth = self._calc_yearmonth()
        super(EceeeColumn, self).save(*args, **kwargs)
        for columnist in self.columnists.all():
            columnist.eceee_sites = self.eceee_sites
            columnist.save()


def column_m2m_changed(sender, instance=None, pk_set=None, model=None, **kwargs):
    # Ignore fixtures and saves for existing courses.
    if pk_set is not None:
        for id in pk_set:
            columnist = model.objects.get(id=id)
            if (
                columnist.last_column_date is None
                or columnist.last_column_date < instance.presentational_publishing_date
            ):
                columnist.last_column_date = instance.presentational_publishing_date
                columnist.yearmonth = instance.yearmonth
                columnist.eceee_sites = instance.eceee_sites
                columnist.save()


m2m_changed.connect(column_m2m_changed, sender=EceeeColumn.columnists.through)

from urllib.parse import urljoin
