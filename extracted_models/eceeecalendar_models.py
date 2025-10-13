import calendar
import datetime
import os
from string import punctuation
from urllib.parse import unquote, urljoin
from zipfile import ZipFile

from bs4 import BeautifulSoup
from django import forms
from django.contrib.auth.models import User
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from django.core.cache import cache
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.db import models
from django.template.loader import render_to_string
from django.urls import reverse
from django.utils.timezone import now
from django.utils.translation import gettext_lazy as _
from easypublisher.fields import ListField
from easypublisher.models import AcquisitionMixin
from eceeebase.fields import GenericCategoriesField, InheritCharField
from eceeebase.models import AccessLevelMixin, EceeeCategoryMixin
from eceeebase.utils import _get_site_url, sitejoin
from eceeebase.value_lists import eceee_sites, event_categories, event_types
from flexibledatefield.fields import FlexibleDateField
from flexibledatefield.flexibledate import flexibledatedelta
from mezzanine.conf import settings
from mezzanine.core.fields import FileField, RichTextField
from mezzanine.core.managers import CurrentSiteManager, DisplayableManager
from mezzanine.core.models import (
    CONTENT_STATUS_DRAFT,
    CONTENT_STATUS_PUBLISHED,
    Displayable,
    Orderable,
    RichText,
    Slugged,
)
from mezzanine.generic.fields import CommentsField
from mezzanine.generic.models import AssignedKeyword, Keyword
from mezzanine.pages.models import Link, Page
from mezzanine.utils.importing import import_dotted_path
from mezzanine.utils.models import AdminThumbMixin, upload_to
from multiselectfield import MultiSelectField
from urllib3 import PoolManager, Timeout


class EceeeCalenderEventManager(DisplayableManager):

    def get_everything(self):
        return self._queryset_class(self.model, using=self._db, hints=self._hints)

    def clone(self, objs=None):
        clones = []
        if objs is not None:
            for obj in objs:
                clone = self.create(
                    page_header=obj.page_header,
                    draft_title="Clone: " + obj.draft_title,
                    title="Clone: " + obj.title,
                    content=obj.content,
                    draft=obj.draft,
                    description=obj.description,
                    gen_description=obj.gen_description,
                    owner=obj.owner,
                    eceee_sites=obj.eceee_sites,
                    event_date=obj.event_date,
                    event_year=obj.event_year,
                    event_yearmonth=obj.event_yearmonth,
                    event_end_date=obj.event_end_date,
                    event_end=obj.event_end,
                    event_time=obj.event_time,
                    event_type=obj.event_type,
                    event_categories=obj.event_categories,
                    organiser=obj.organiser,
                    focus_areas=obj.focus_areas,
                    venue=obj.venue,
                    show_in_right_column=obj.show_in_right_column,
                    priority=obj.priority,
                    quote=obj.quote,
                    url=obj.url,
                    contact_person=obj.contact_person,
                    contact_person_email=obj.contact_person_email,
                    show_in_widget=obj.show_in_widget,
                    status=CONTENT_STATUS_DRAFT,
                    dirty=True,
                    approved=False,
                )
                clone.save()
                for keyword in obj.keywords.all():
                    AssignedKeyword.objects.create(
                        content_object=clone, keyword=keyword.keyword
                    )
                clones.append(clone)
        return clones


class EceeeCalenderEvent(AccessLevelMixin, EceeeCategoryMixin, Displayable, RichText):
    """
    Basic Calender Event. All Pages should be based on this.
    """

    objects = EceeeCalenderEventManager()

    class Meta:
        verbose_name = _("Calender Event")
        verbose_name_plural = _("Calender Events")

    # Base
    page_header = models.CharField(
        _("Page Header"), max_length=400, blank=True, default="", editable=False
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
    eceee_sites = MultiSelectField(_("Show on Sites"), choices=eceee_sites)
    page_layout = "layout_event"

    event_date = FlexibleDateField()
    event_year = models.CharField(
        default=None, null=True, db_index=True, editable=False, max_length=4
    )
    event_yearmonth = models.CharField(
        default=None, null=True, db_index=True, editable=False, max_length=6
    )
    event_end_date = FlexibleDateField(null=True, blank=True)
    event_end = models.DateTimeField(null=True, editable=False)
    event_time = models.CharField(
        _("Event Time"), max_length=40, blank=True, null=False, default=""
    )
    event_type = models.CharField(
        _("Event Type"),
        max_length=200,
        blank=True,
        null=True,
        default=event_types[0][0],
        choices=event_types,
    )
    event_categories = MultiSelectField(_("Event Categories"), choices=event_categories)
    organiser = models.CharField(
        _("Organiser"), max_length=2000, blank=True, default=""
    )
    focus_areas = models.CharField(
        _("Focus Areas"), max_length=2000, blank=True, default=""
    )
    venue = models.CharField(_("Venue"), max_length=2000, blank=True, default="")
    show_in_right_column = models.BooleanField(_("Show in Right Column"), default=False)
    priority = models.BooleanField(_("Priority"), default=False)
    quote = models.CharField(_("Quote"), max_length=2000, blank=True, default="")

    owner = models.ForeignKey(
        User,
        related_name="eventitems",
        default=None,
        null=True,
        on_delete=models.CASCADE,
    )
    draft_title = models.CharField(
        _("Title (draft)"), default="", blank=True, max_length=500
    )
    draft = RichTextField(_("Content (draft)"), default="", blank=True)
    dirty = models.BooleanField(
        _("Changed by User"), default=False, db_index=True, editable=False
    )
    approved = models.BooleanField(_("Approve"), default=False, db_index=True)
    approved_timestamp = models.DateTimeField(
        _("Approved Timestamp"), null=True, blank=None, default=None, editable=False
    )
    url = models.URLField(
        _("Event URL for more information (optional)"), null=True, blank=True
    )

    contact_person = models.CharField(
        _("Contact person"), max_length=120, default="", blank=True
    )
    contact_person_email = models.EmailField(
        _("Contact e-mail"), default="", blank=True
    )

    show_in_widget = models.BooleanField(_("Show in Widget"), default=True)

    @property
    def get_site_url(self):
        return _get_site_url(self.site_id)

    def _get_site_prefix(self):
        host = _get_site_url(self.site_id)
        if self.site_id == 2:
            return os.path.join(host, "events/calendars/event")
        elif self.site_id == 7:
            return os.path.join(host, "news-resources/events-calendar")
        elif self.site_id == 3:
            return os.path.join(host, "events/calendars/event")
        elif self.site_id == 6:
            return os.path.join(host, "news-resources/events-calendar")
        return os.path.join(host, "events/calendars/event")

    @property
    def publish_status(self):
        if self.status == CONTENT_STATUS_PUBLISHED:
            published = "Published"
            if self.dirty:
                published = "Published (updates waiting for approval)"
        else:
            published = "Draft"
            if self.dirty:
                published = "Waiting for approval"
        return published

    def get_content_model(self):
        return self

    def get_absolute_url(self, prefix=None, site_filter=None):
        if site_filter == "eceee_ecodesign":
            return os.path.join(
                site_url, reverse("ecodesign-calendar-item", kwargs={"slug": self.slug})
            )
        return sitejoin(self._get_site_prefix(), self.slug)

    def get_admin_change_url(self):
        return reverse(
            "admin:%s_%s_change" % (self._meta.app_label, self._meta.model_name),
            args=[self.id],
        )

    def save(self, *args, **kwargs):
        """
        Save indexed fields for event day, month, year (start event)
        """
        if self.pk is None and not self.content and not self.title:
            self.status = CONTENT_STATUS_DRAFT
            self.content = self.draft
            self.title = self.draft_title

        self.gen_description = False

        try:
            self.event_year = "{0:04d}".format(self.event_date.year)
        except:
            try:
                self.event_year = str(self.event_date)[:4]
            except:
                self.event_year = None
        if self.event_year and len(self.event_year) != 4:
            self.event_year = None
        try:
            self.event_yearmonth = "{0:04d}{1:02d}".format(
                self.event_date.year, self.event_date.month
            )
        except:
            try:
                self.event_yearmonth = str(self.event_date)[:6]
            except:
                self.event_yearmonth = None
        if self.event_yearmonth and len(self.event_yearmonth) == 4:
            self.event_yearmonth = self.event_yearmonth + "01"
        try:
            if self.event_end_date:
                self.event_end = self.event_end_date.get_date(fallback=True)
            elif self.event_date:
                self.event_end = self.event_date.get_date(fallback=True)
        except:
            self.event_end = None

        if self.owner:
            if not self.contact_person:
                self.contact_person = "{} {}".format(
                    self.owner.first_name, self.owner.last_name
                )
            if not self.contact_person_email:
                self.contact_person_email = self.owner.email

        if self.approved and (
            (self.draft != self.draft_title and self.content != self.draft)
            or self.dirty
        ):
            self.approved_timestamp = now()
            self.content = self.draft
            self.title = self.draft_title
            self.dirty = False
            self.status = CONTENT_STATUS_PUBLISHED
        self.approved = False

        super(EceeeCalenderEvent, self).save(*args, **kwargs)


from urllib.parse import urljoin
