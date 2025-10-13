import os

from django.contrib.contenttypes.fields import GenericForeignKey
from django.db import models
from django.urls import reverse
from django.utils.text import slugify
from django.utils.translation import gettext_lazy as _
from easypublisher.models import AcquisitionMixin
from eceeebase.fields import GenericCategoriesField
from eceeebase.models import AccessLevelMixin, AcquisitionMixin, EceeeCategoryMixin
from eceeebase.utils import _get_site_url
from eceeebase.value_lists import eceee_sites, possible_page_layouts
from mezzanine.core.managers import CurrentSiteManager, DisplayableManager
from mezzanine.core.models import Displayable, Orderable, RichText, Slugged
from mezzanine.generic.fields import BaseGenericRelation, KeywordsField
from mezzanine.generic.models import Keyword
from multiselectfield import MultiSelectField


class eceeeNewsTypeManager(CurrentSiteManager):
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


class eceeeNewsType(Slugged):
    """
    Categories which are managed via a custom JavaScript based
    widget in the admin.
    """

    objects = eceeeNewsTypeManager()

    class Meta:
        verbose_name = _("News Type")
        verbose_name_plural = _("News Types")


class AssignedeceeeNewsType(Orderable):
    """
    A ``Category`` assigned to a model instance.
    """

    news_type = models.ForeignKey(
        "eceeeNewsType",
        verbose_name=_("eceeeNewsType"),
        related_name="news_types",
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
        return str(self.news_type)

    @classmethod
    def category_name(self):
        return "news_type"

    @classmethod
    def related_name(self):
        return "news_types"


class eceeeNewsCategoryManager(CurrentSiteManager):
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


class eceeeNewsCategory(Slugged):
    """
    Categories which are managed via a custom JavaScript based
    widget in the admin.
    """

    objects = eceeeNewsCategoryManager()

    class Meta:
        verbose_name = _("News Category")
        verbose_name_plural = _("News Categories")


class AssignedeceeeNewsCategory(Orderable):
    """
    A ``Category`` assigned to a model instance.
    """

    news_category = models.ForeignKey(
        "eceeeNewsCategory",
        verbose_name=_("eceeeNewsCategory"),
        related_name="news_categories",
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
        return str(self.news_category)

    @classmethod
    def category_name(self):
        return "news_category"

    @classmethod
    def related_name(self):
        return "news_categories"


class eceeeNewsSourceManager(CurrentSiteManager):
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


class eceeeNewsSource(Slugged):
    """
    Categories which are managed via a custom JavaScript based
    widget in the admin.
    """

    objects = eceeeNewsSourceManager()

    class Meta:
        verbose_name = _("News Source")
        verbose_name_plural = _("News Sources")


class AssignedeceeeNewsSource(Orderable):
    """
    A ``Category`` assigned to a model instance.
    """

    news_source = models.ForeignKey(
        "eceeeNewsSource",
        verbose_name=_("News Source"),
        related_name="news_sources",
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
        return str(self.news_source)

    @classmethod
    def category_name(self):
        return "news_source"

    @classmethod
    def related_name(self):
        return "news_sources"


class AssignedKeywordSub(Orderable):
    """
    A ``Keyword`` assigned to a model instance.
    """

    keyword = models.ForeignKey(
        Keyword,
        verbose_name=_("Keyword"),
        related_name="assignments_sub",
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
        return str(self.keyword)


class KeywordsSubField(KeywordsField):
    default_related_model = "eceeenews.AssignedKeywordSub"

    def save_form_data(self, instance, data):
        """
        The ``KeywordsWidget`` field will return data as a string of
        comma separated IDs for the ``Keyword`` model - convert these
        into actual ``AssignedKeywordSub`` instances. Also delete
        ``Keyword`` instances if their last related ``AssignedKeywordSub``
        instance is being removed.
        """
        from mezzanine.generic.models import Keyword

        related_manager = getattr(instance, self.name)
        # Get a list of Keyword IDs being removed.
        old_ids = [str(a.keyword_id) for a in related_manager.all()]
        new_ids = data.split(",")
        removed_ids = set(old_ids) - set(new_ids)
        # Remove current AssignedKeywordSub instances.
        related_manager.all().delete()
        # Convert the data into AssignedKeywordSub instances.
        if data:
            data = [AssignedKeywordSub(keyword_id=i) for i in new_ids]
        # Remove Keyword instances than no longer have a
        # related AssignedKeywordSub instance.
        existing = AssignedKeywordSub.objects.filter(keyword__id__in=removed_ids)
        existing_ids = set([str(a.keyword_id) for a in existing])
        unused_ids = removed_ids - existing_ids
        Keyword.objects.filter(id__in=unused_ids).delete()
        super(BaseGenericRelation, self).save_form_data(instance, data)


class RelatedNewsManager(CurrentSiteManager):
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


class RelatedNews(Slugged):
    """
    Categories which are managed via a custom JavaScript based
    widget in the admin.
    """

    objects = RelatedNewsManager()

    class Meta:
        verbose_name = _("Related News")
        verbose_name_plural = _("Related News")


class AssignedRelatedNews(Orderable):
    """
    A ``Category`` assigned to a model instance.
    """

    related_newsitem = models.ForeignKey(
        "RelatedNews",
        verbose_name=_("Related News"),
        related_name="related_newsitems",
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
        return str(self.related_newsitem)

    @classmethod
    def category_name(self):
        return "related_newsitem"

    @classmethod
    def related_name(self):
        return "related_newsitems"


class eceeeNewsManager(DisplayableManager):
    def get_everything(self):
        return self._queryset_class(self.model, using=self._db, hints=self._hints)

    def get_by_type(self, news_type, **kwargs):
        """ """
        try:
            kw = eceeeNewsType.objects.get(title=news_type)
            result = self.get_queryset().filter(news_types__news_type=kw)
        except:
            result = self.none()
        return result

    def get_by_category(self, category, **kwargs):
        """ """
        try:
            kw = eceeeNewsCategory.objects.get(title=category)
            result = self.get_queryset().filter(news_categories__news_category=kw)
        except:
            result = self.none()
        return result

    def get_by_source(self, source, **kwargs):
        """ """
        try:
            kw = eceeeNewsSource.objects.get(title=source)
            result = self.get_queryset().filter(news_sources__news_source=kw)
        except:
            result = self.none()
        return result

    def get_by_keyword(self, keyword, **kwargs):
        """ """
        try:
            kw = Keyword.objects.get(title=keyword_sub)
            result = self.get_queryset().filter(keywords__keyword=kw)
        except:
            result = self.none()
        return result

    def get_by_keyword_sub(self, keyword_sub, **kwargs):
        """ """
        try:
            kw = Keyword.objects.get(title=keyword_sub)
            result = self.get_queryset().filter(keywords_sub__keyword=kw)
        except:
            result = self.none()
        return result


class eceeeNews(
    AccessLevelMixin, AcquisitionMixin, EceeeCategoryMixin, Displayable, RichText
):
    """
    Basic eceeeNews. All Pages should be based on this.

    """

    objects = eceeeNewsManager()

    class Meta:
        verbose_name = _("News")
        verbose_name_plural = _("News")

    page_header = models.CharField(
        _("Page Header"), max_length=400, blank=True, default="", editable=False
    )
    nav_title = models.CharField(
        _("Navigation Title"), max_length=80, blank=True, null=False, default=""
    )
    page_layout = models.CharField(
        _("Page Layout"),
        max_length=200,
        blank=True,
        null=True,
        default=possible_page_layouts[0][0],
        choices=possible_page_layouts,
    )

    presentational_publishing_date = models.DateTimeField(
        _("Presentational Publishing Date"), db_index=True
    )
    presentational_yearmonth = models.CharField(
        _("Presentational Year-Month index"),
        max_length=80,
        blank=True,
        null=False,
        default="",
        db_index=True,
        editable=False,
    )
    presentational_yearmonthday = models.CharField(
        _("Presentational Year-Month-Day index"),
        max_length=80,
        blank=True,
        null=False,
        default="",
        db_index=True,
        editable=False,
    )
    presentational_year = models.CharField(
        _("Presentational Year"),
        max_length=80,
        blank=True,
        null=False,
        default="",
        db_index=True,
        editable=False,
    )
    presentational_month = models.CharField(
        _("Presentational Month"),
        max_length=80,
        blank=True,
        null=False,
        default="",
        db_index=True,
        editable=False,
    )

    keywords_sub = KeywordsSubField(
        verbose_name=_("Keyword Sub"), editable=False
    )  # Disabled in admin
    related_newsitems = GenericCategoriesField(
        "eceeenews.models.AssignedRelatedNews",
        "eceeenews.models.RelatedNews",
        category_name="related_newsitem",
        verbose_name=_("Related News"),
    )

    eceee_sites = MultiSelectField(
        _("Show on Sites"), default="eceee", choices=eceee_sites, blank=True, null=False
    )

    news_types = GenericCategoriesField(
        "eceeenews.models.AssignedeceeeNewsType",
        "eceeenews.models.eceeeNewsType",
        category_name="news_type",
        verbose_name=_("News Types"),
    )
    news_categories = GenericCategoriesField(
        "eceeenews.models.AssignedeceeeNewsCategory",
        "eceeenews.models.eceeeNewsCategory",
        category_name="news_category",
        verbose_name=_("News Categories"),
    )
    news_sources = GenericCategoriesField(
        "eceeenews.models.AssignedeceeeNewsSource",
        "eceeenews.models.eceeeNewsSource",
        category_name="news_source",
        verbose_name=_("News Source"),
    )
    source_date = models.DateTimeField(
        _("Source Date"), null=True, blank=True, db_index=True
    )

    external_url = models.CharField(
        _("External URL"), max_length=400, blank=True, default=""
    )
    publish_on_front_page = models.BooleanField(
        _("Publish on Front Page"), default=False, db_index=True
    )

    @property
    def get_site_url(self):
        return _get_site_url(self.site_id)

    @property
    def year(self):
        date = (
            self.presentational_publishing_date
            or self.source_date
            or self.publish_date
            or self.create
        )
        return date.strftime("%Y")

    @property
    def month(self):
        date = (
            self.presentational_publishing_date
            or self.source_date
            or self.publish_date
            or self.create
        )
        return date.strftime("%m")

    @property
    def month_name(self):
        date = (
            self.presentational_publishing_date
            or self.source_date
            or self.publish_date
            or self.create
        )
        return date.strftime("%B")

    @property
    def is_pressrelease(self):
        press_release = self.news_types.filter(news_type__title="Press Release").count()
        return press_release

    def get_absolute_url(self, prefix=None, site_filter=None):
        if prefix:
            return os.path.join(prefix, self.slug)
        date = (
            self.presentational_publishing_date
            or self.source_date
            or self.publish_date
            or self.create
        )
        year = date.strftime("%Y")
        news_types = [x.news_type.slug for x in self.news_types.all()]
        if "eceee-press-release" in news_types or "press-release" in news_types:
            return reverse(
                "all-press-release-item", kwargs={"year": year, "slug": self.slug}
            )
        return reverse("all-eceee-news-item", kwargs={"year": year, "slug": self.slug})

    def save(self, *args, **kwargs):
        """
        Set the description field on save.
        """
        new_slug = self.slug.encode("iso-8859-1").decode("utf-8", "ignore")
        if new_slug != self.slug:
            self.slug = new_slug
        self.gen_description = False
        if self.presentational_publishing_date is not None:
            self.presentational_yearmonth = (
                self.presentational_publishing_date.strftime("%Y-%m")
            )
            self.presentational_yearmonthday = (
                self.presentational_publishing_date.strftime("%Y-%m-%d")
            )
            self.presentational_year = self.year
            self.presentational_month = self.month_name
        if self.page_header:
            self.title = self.page_header
            self.page_header = ""
        super(eceeeNews, self).save(*args, **kwargs)


from urllib.parse import urljoin
