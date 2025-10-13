# encoding: utf-8

import os
from string import punctuation
from urllib.parse import unquote
from zipfile import ZipFile

from bs4 import BeautifulSoup
from bs4.element import *
from django import forms
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.db import models
from django.template.loader import render_to_string
from django.urls import reverse
from django.utils import timezone
from django.utils.text import slugify
from django.utils.translation import gettext_lazy as _
from easypublisher.fields import ListField
from easypublisher.models import AcquisitionMixin
from eceeebase.fields import GenericCategoriesField, InheritCharField
from eceeebase.models import AccessLevelMixin, EceeeCategoryMixin
from eceeebase.value_lists import (
    possible_affiliation,
    possible_categories,
    possible_countries,
    possible_eceee_categories,
    possible_page_layouts,
    possible_widget_visibility,
)
from mezzanine.conf import settings
from mezzanine.core.fields import FileField, RichTextField
from mezzanine.core.managers import CurrentSiteManager, DisplayableManager
from mezzanine.core.models import Displayable, Orderable, RichText, Slugged
from mezzanine.generic.fields import CommentsField
from mezzanine.pages.managers import PageManager
from mezzanine.pages.models import Link, Page
from mezzanine.utils.importing import import_dotted_path
from mezzanine.utils.models import AdminThumbMixin, upload_to
from multiselectfield import MultiSelectField

possible_conferences = (
    ("summer", "eceee Summer Study"),
    ("industrial", "eceee Industrial Efficiency"),
    ("behaviour", "Energy Efficiency and Behaviour Conference"),
    ("right-light", "Right Light"),
    ("aceee-buildings", "ACEEE Buildings"),
    ("aceee-industry", "ACEEE Industry"),
    ("milen", "MILEN"),
)


class eceeeProceedingsKeywordManager(CurrentSiteManager):
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


class eceeeProceedingsKeyword(Slugged):
    """
    Categories which are managed via a custom JavaScript based
    widget in the admin.
    """

    objects = eceeeProceedingsKeywordManager()

    class Meta:
        verbose_name = _("eceee Proceedings Keyword")
        verbose_name_plural = _("eceee Proceedings Keywords")


class AssignedeceeeProceedingsKeyword(Orderable):
    """
    A ``Category`` assigned to a model instance.
    """

    eceeeproceedingskeyword = models.ForeignKey(
        "eceeeProceedingsKeyword",
        verbose_name=_("eceeeProceedingsKeyword"),
        related_name="keywords",
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
        return str(self.eceeeproceedingskeyword)

    @classmethod
    def category_name(self):
        return "eceeeproceedingskeyword"

    @classmethod
    def related_name(self):
        return "keywords"


class ConferencePageManager(PageManager):
    def order_by_slug(self):
        order_counter = 1
        for cp in self.all().order_by("-slug"):
            cp._order = order_counter
            order_counter += 1
            cp.save()


class ConferencePage(AcquisitionMixin, EceeeCategoryMixin, Page, RichText):
    """
    Basic ConferencePage. All Pages should be based on this.
    """

    class Meta:
        verbose_name = _("eceee Conference Page")
        verbose_name_plural = _("eceee Conference Pages")

    objects = ConferencePageManager()

    # Base
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
    page_layout = models.CharField(
        _("Page Layout"),
        max_length=200,
        blank=True,
        null=True,
        default=possible_page_layouts[0][0],
        choices=possible_page_layouts,
    )

    site_sub_text = models.CharField(
        _("Site Sub Text"), max_length=2000, blank=True, default=""
    )
    sub_title = models.CharField(
        _("Sub Title"), max_length=2000, blank=True, default=""
    )
    sub_title_short = models.CharField(
        _("Sub Title (short)"), max_length=200, blank=True, default=""
    )
    slogan = models.CharField(_("Event Slogan"), max_length=400, blank=True, default="")

    conference = models.CharField(
        _("Conference"),
        max_length=30,
        blank=False,
        default=possible_conferences[0][0],
        choices=possible_conferences,
    )
    conference_year = models.CharField(
        _("Ev22_SumStYear"), max_length=10, blank=True, default=""
    )
    venue = models.CharField(
        _("Venue"), max_length=800, blank=True, default="", db_index=True
    )
    folder_name_for_sitedocs = models.CharField(
        _("folder_name_for_sitedocs"), max_length=800, blank=True, default=""
    )
    folder_name_for_pdf = models.CharField(
        _("folder_name_for_pdf"), max_length=800, blank=True, default=""
    )
    keyword_index_filename = models.CharField(
        _("keyword_index_filename"), max_length=800, blank=True, default=""
    )
    author_index_filename = models.CharField(
        _("author_index_filename"), max_length=800, blank=True, default=""
    )
    toc_filename = models.CharField(
        _("toc_filename"), max_length=800, blank=True, default=""
    )
    appendix_filename = models.CharField(
        _("Ev554_EventAppendix"), max_length=200, blank=True, default=""
    )

    date = models.CharField(
        _("Date"), max_length=180, blank=True, default="", db_index=True
    )
    isbn = models.CharField(
        _("ISBN"), max_length=80, blank=True, default="", db_index=True
    )
    issn = models.CharField(
        _("ISSN"), max_length=80, blank=True, default="", db_index=True
    )
    access_level = models.CharField(
        _("Access Level"), max_length=80, blank=True, default="", db_index=True
    )
    show_php = models.CharField(
        _("Show PHP"), max_length=80, blank=True, default="", db_index=True
    )
    presentational_publishing_date = models.DateTimeField(
        _("Presentational Publishing Date"), null=False, blank=False, db_index=True
    )

    description_registation = models.TextField(
        _("Ev542_EventDescription_Reg"), blank=True, default=""
    )
    description_paper = models.TextField(
        _("Ev541_EventDescription_Paper"), blank=True, default=""
    )
    description_proc = models.TextField(
        _("Ev543_EventDescription_Proc"), blank=True, default=""
    )

    proceedings_title = models.TextField(
        _("Ev542_EventDescription_Reg"), blank=True, default=""
    )
    conference_full_name = models.TextField(
        _("Ev542_EventDescription_Reg"), blank=True, default=""
    )
    conference_short_name = models.TextField(
        _("Ev542_EventDescription_Reg"), blank=True, default=""
    )

    fm_id = models.IntegerField(_("FileMaker ID"), null=True, blank=True, db_index=True)
    fm_id_version = models.CharField(
        _("FileMaker ID Version"), null=True, blank=True, max_length=20, db_index=True
    )

    def __str__(self):
        return self.sub_title_short

    @property
    def year(self):
        return self.conference_year

    def is_open(self):
        return self.access_level.lower() == "1"

    def get_panels(self):
        return PanelPage.objects.filter(conference=self).order_by("panel_prefix")

    def contents_url(self):
        return "https://{0}/docs/{1}/{2}".format(
            settings.PROCEEDINGS_HOST, self.folder_name_for_sitedocs, self.toc_filename
        )

    def authors_url(self):
        return "https://{0}/docs/{1}/{2}".format(
            settings.PROCEEDINGS_HOST,
            self.folder_name_for_sitedocs,
            self.author_index_filename,
        )

    def appendix_url(self):
        return "https://{0}/docs/{1}/{2}".format(
            settings.PROCEEDINGS_HOST,
            self.folder_name_for_sitedocs,
            self.appendix_filename,
        )

    def keywords_url(self):
        return "https://{0}/docs/{1}/{2}".format(
            settings.PROCEEDINGS_HOST,
            self.folder_name_for_sitedocs,
            self.keyword_index_filename,
        )

    def save(self, *args, **kwargs):
        self.gen_description = False
        if self.presentational_publishing_date is None:
            self.presentational_publishing_date = timezone.now()
        super(ConferencePage, self).save(*args, **kwargs)


class ConferenceLogo(Orderable):

    title = models.CharField(
        _("Title"), max_length=128, blank=True, null=True, default=""
    )
    url = models.CharField(
        _("Partner URL"), max_length=512, blank=True, null=True, default=""
    )
    logo = FileField(
        _("Partner Logo"),
        max_length=200,
        format="Image",
        upload_to=upload_to("eceee.Organisations.organisations", "logos"),
        blank=True,
        null=True,
        default="",
    )

    conference = models.ForeignKey(
        "ConferencePage",
        related_name="logos",
        default=None,
        null=True,
        on_delete=models.CASCADE,
    )


class ConferencePageProxy(AcquisitionMixin, EceeeCategoryMixin, Page):
    class Meta:
        verbose_name = _("eceee Conference Page Proxy")
        verbose_name_plural = _("eceee Conference Page Proxies")

    nav_title = models.CharField(
        _("Navigation Title"), max_length=80, blank=True, null=False, default=""
    )
    conference = models.CharField(
        _("Conference"),
        max_length=30,
        blank=False,
        default=possible_conferences[0][0],
        choices=possible_conferences,
    )


class ConferenceYearPageProxy(AcquisitionMixin, EceeeCategoryMixin, Page):
    class Meta:
        verbose_name = _("eceee Conference Year Page Proxy")
        verbose_name_plural = _("eceee Conference Year Page Proxies")

    nav_title = models.CharField(
        _("Navigation Title"), max_length=80, blank=True, null=False, default=""
    )
    conference_year = models.CharField(
        _("Ev22_SumStYear"), max_length=10, blank=True, default=""
    )


class PanelPage(
    AccessLevelMixin,
    AcquisitionMixin,
    EceeeCategoryMixin,
    Orderable,
    Displayable,
    RichText,
):  # Page #Displayable
    """
    Basic PanelPage. All Pages should be based on this.
    """

    class Meta:
        verbose_name = _("eceee Panel Page")
        verbose_name_plural = _("eceee Panel Pages")

    # Base
    page_header = models.CharField(
        _("Page Header"), max_length=400, blank=True, default="", editable=False
    )
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
    page_layout = models.CharField(
        _("Page Layout"),
        max_length=200,
        blank=True,
        null=True,
        default=possible_page_layouts[0][0],
        choices=possible_page_layouts,
    )

    panel_leaders = ListField(_("Panel Leaders"), blank=True, default="")
    panel_prefix = models.CharField(
        _("Panel Prefix"), max_length=40, blank=True, default=""
    )
    presentational_publishing_date = models.DateTimeField(
        _("Presentational Publishing Date"), null=False, blank=False
    )

    conference = models.ForeignKey(
        "ConferencePage",
        related_name="panels",
        default=None,
        null=True,
        on_delete=models.CASCADE,
    )

    panel_info = models.FileField(
        verbose_name=_("Panel Info"),
        blank=True,
        upload_to=upload_to("eceee.WebPage.proceedings", "panels"),
    )
    panel_info_purl = models.CharField(
        _("Panel Info URL"), max_length=400, blank=True, default=""
    )

    additional_information = RichTextField(_("Additional Information"), blank=True)

    access_level = models.CharField(
        _("Access Level"), max_length=80, blank=True, default="", db_index=True
    )
    show_php = models.CharField(
        _("Show PHP"), max_length=80, blank=True, default="", db_index=True
    )
    folder_name_for_sitedocs = models.CharField(
        _("folder_name_for_sitedocs"), max_length=800, blank=True, default=""
    )

    fm_id = models.IntegerField(_("FileMaker ID"), null=True, blank=True, db_index=True)
    fm_id_version = models.CharField(
        _("FileMaker ID Version"), null=True, blank=True, max_length=20, db_index=True
    )

    def __str__(self):
        return self.title

    def get_content_model(self):
        return self

    def get_absolute_url(self):
        library, conference_proceedings, conference, year, panel = self.slug.split("/")[
            :5
        ]
        return reverse(
            "eceee-panel",
            kwargs={"conference": conference, "year": year, "panel": panel},
        )

    def get_proceedings(self):
        return self.proceedings.all().order_by("doc_nummer")

    def get_panels(self):
        return PanelPage.objects.filter(conference=self.conference).order_by(
            "panel_prefix"
        )

    def get_panel_leaders(self):
        return [
            x
            for x in [
                {
                    "name": a.split(",", 1)[0],
                    "affiliation": (
                        a.split(",", 1)[1] if len(a.split(",", 1)) == 2 else ""
                    ),
                }
                for a in self.panel_leaders.split("\n")
                if a
            ]
            if x["name"]
        ]

    def get_panel_prefix(self):
        return "panel " + self.panel_prefix or self.nav_title

    def has_panel_info_url(self):
        return self.panel_info or self.panel_info_purl != ""

    def panel_info_url(self):
        """Fix pabel info"""
        if self.panel_info:
            return settings.MEDIA_URL + self.panel_info.url
        if self.panel_info_purl:
            return "https://{0}/docs/{1}".format(
                settings.PROCEEDINGS_HOST, self.panel_info_purl
            )
        return ""

    def save(self, *args, **kwargs):
        self.gen_description = False
        if self.presentational_publishing_date is None:
            self.presentational_publishing_date = timezone.now()
        super(PanelPage, self).save(*args, **kwargs)


class ProceedingPageManager(DisplayableManager):
    # Fix for HAYSTACK not indexing all sites
    def get_everything(self):
        return self._queryset_class(self.model, using=self._db, hints=self._hints)


class ProceedingPage(
    AccessLevelMixin,
    AcquisitionMixin,
    EceeeCategoryMixin,
    Orderable,
    Displayable,
    RichText,
):
    """
    Basic ProceedingPage. All Pages should be based on this.
    """

    objects = ProceedingPageManager()

    class Meta:
        verbose_name = _("eceee Proceeding Page")
        verbose_name_plural = _("eceee Proceeding Pages")

    # Base
    page_header = models.CharField(
        _("Page Header"), max_length=400, blank=True, default="", editable=False
    )
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
    page_layout = models.CharField(
        _("Page Layout"),
        max_length=200,
        blank=True,
        null=True,
        default=possible_page_layouts[0][0],
        choices=possible_page_layouts,
    )

    proceedings_keywords = GenericCategoriesField(
        "eceeeproceedings.models.AssignedeceeeProceedingsKeyword",
        "eceeeproceedings.models.eceeeProceedingsKeyword",
        verbose_name=_("Proceedings Keywords"),
    )

    authors = ListField(_("Authors (one organizaion per line)"), blank=True, default="")
    presentational_publishing_date = models.DateTimeField(
        _("Presentational Publishing Date"), null=False, blank=False, db_index=True
    )
    abstract = RichTextField(_("Abstract"), blank=True)
    doc_nummer = models.CharField(
        _("Doc Nummer"), max_length=40, blank=True, default=""
    )
    doc_status = models.CharField(
        _("Doc Status"), max_length=120, blank=True, default=""
    )
    peer_review = models.CharField(
        _("Peer review"), max_length=40, blank=True, default=""
    )
    Do192_NotPeerReviewWeb_c = models.TextField(
        _("Do192_NotPeerReviewWeb_c"), blank=True, null=False, default=""
    )

    paper = models.FileField(
        verbose_name=_("Paper"),
        blank=True,
        max_length=1400,
        upload_to=upload_to("eceee.WebPage.proceedings", "proceedings"),
    )

    presentation = models.FileField(
        verbose_name=_("Presentation"),
        blank=True,
        max_length=1400,
        upload_to=upload_to("eceee.WebPage.proceedings", "proceedings"),
    )

    panel = models.ForeignKey(
        "PanelPage",
        related_name="proceedings",
        default=None,
        null=True,
        on_delete=models.CASCADE,
    )
    folder_name_for_sitedocs = models.CharField(
        _("folder_name_for_sitedocs"), max_length=800, blank=True, default=""
    )
    access_level = models.CharField(
        _("Access Level"), max_length=80, blank=True, default="", db_index=True
    )

    fm_id = models.IntegerField(_("FileMaker ID"), null=True, blank=True, db_index=True)
    fm_id_version = models.CharField(
        _("FileMaker ID Version"), null=True, blank=True, max_length=20, db_index=True
    )

    def get_content_model(self):
        return self

    def get_absolute_url(self):
        (
            library,
            conference_proceedings,
            conference,
            year,
            panel,
        ) = self.panel.slug.split("/")[:5]
        paper = self.slug.split("/")[-1]
        return reverse(
            "eceee-proceedings-paper",
            kwargs={
                "conference": conference,
                "year": year,
                "panel": panel,
                "paper": paper,
            },
        )

    @property
    def is_accepted_extended_abstract(self):
        return self.doc_status.endswith("ccepted extended abstract")

    def get_authors(self):
        return [
            {
                "name": a.split(",", 1)[0],
                "affiliation": a.split(",", 1)[1] if len(a.split(",", 1)) == 2 else "",
            }
            for a in self.authors.split("\n")
            if a
        ]

    def save(self, *args, **kwargs):
        self.gen_description = False
        if self.presentational_publishing_date is None:
            self.presentational_publishing_date = timezone.now()
        super(ProceedingPage, self).save(*args, **kwargs)


class ProceedingFile(AccessLevelMixin, AcquisitionMixin, Displayable):

    filename = models.CharField(_("Filename"), max_length=400, blank=True, default="")
    purl = models.CharField(
        _("Proceedings URL"), max_length=400, blank=True, default="", db_index=True
    )
    proceeding = models.ForeignKey(
        "ProceedingPage",
        related_name="files",
        default=None,
        null=True,
        on_delete=models.CASCADE,
    )
    folder_name_for_sitedocs = models.CharField(
        _("folder_name_for_sitedocs"),
        max_length=800,
        blank=True,
        default="",
        db_index=True,
    )
    access_level = models.CharField(
        _("Access Level"), max_length=80, blank=True, default="", db_index=True
    )

    fm_id = models.IntegerField(_("FileMaker ID"), null=True, blank=True, db_index=True)
    fm_id_version = models.CharField(
        _("FileMaker ID Version"), null=True, blank=True, max_length=20, db_index=True
    )

    def get_content_model(self):
        return self

    def get_absolute_url(self):
        return self.slug

    def get_file_url(self):
        (
            library,
            conference_proceedings,
            conference,
            year,
            panel,
            paper,
        ) = self.slug.split("/")[:6]
        try:
            return reverse(
                "eceee-download-proceedings-paper",
                kwargs={
                    "conference": conference,
                    "year": year,
                    "panel": panel,
                    "paper": paper,
                    "folder": self.folder_name_for_sitedocs,
                    "filename": self.filename,
                },
            )
        except:
            return ""


from urllib.parse import urljoin
