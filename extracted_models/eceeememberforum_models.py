
from django.contrib.contenttypes.fields import GenericForeignKey
from django.db import models
from django.urls import reverse
from django.utils.text import slugify
from django.utils.translation import gettext_lazy as _
from eceeebase.fields import GenericCategoriesField
from eceeebase.value_lists import possible_countries
from mezzanine.core.fields import FileField, RichTextField
from mezzanine.core.managers import CurrentSiteManager
from mezzanine.core.models import Displayable, Orderable, Slugged
from mezzanine.utils.models import upload_to

from eceeememberforum.value_lists import MEMBER_ACTIVITIES


class MemberAffiliationManager(CurrentSiteManager):

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


class MemberAffiliation(Slugged):
    """
    Affiliations which are managed via a custom JavaScript based
    widget in the admin.
    """

    objects = MemberAffiliationManager()

    class Meta:
        verbose_name = _("Member Affiliation")
        verbose_name_plural = _("Member Affiliations")



class AssignedMemberAffiliation(Orderable):
    """
    A ``Affiliation`` assigned to a model instance.
    """

    affiliation = models.ForeignKey("MemberAffiliation", verbose_name=_("Member Affiliation"),
                                    related_name="affiliations", on_delete=models.CASCADE)
    content_type = models.ForeignKey("contenttypes.ContentType", on_delete=models.CASCADE)
    object_pk = models.IntegerField()
    content_object = GenericForeignKey("content_type", "object_pk")

    class Meta:
        order_with_respect_to = "content_object"

    def __str__(self):
        return str(self.affiliation)

    @classmethod
    def category_name(self):
        return 'affiliation'

    @classmethod
    def related_name(self):
        return 'affiliations'


class MemberCategoryManager(CurrentSiteManager):

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


class MemberCategory(Slugged):
    """
    Affiliations which are managed via a custom JavaScript based
    widget in the admin.
    """

    objects = MemberCategoryManager()

    class Meta:
        verbose_name = _("Member Category")
        verbose_name_plural = _("Member Categories")



class AssignedMemberCategory(Orderable):
    """
    A ``MemberCategory`` assigned to a model instance.
    """

    category = models.ForeignKey("MemberAffiliation", verbose_name=_("Member Category"),
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


class EceeeMemberOrganization(Displayable):
    """
    EceeeMemberOrganization. All Pages should be based on this.
    """

    class Meta:
        verbose_name = _("Member Organization")
        verbose_name_plural = _("Member Organization")

    page_layout = 'layout_content'

    page_header = models.CharField(
        _("Page Header"), max_length=400, blank=True, default='', editable=False)

    organization = models.CharField(
        _("Organization (short and secret)"), max_length=200, blank=False)
    organizations_full_name = models.CharField(
        _("Organizations Full Name"), max_length=200, blank=False)
    quote = models.CharField(_("Quote"), max_length=200,
                             blank=True, null=False, default='')
    text = RichTextField(
        _("Description of the organisation"), blank=True, default="")
    homepage = models.URLField(
        _("Homepage"), null=False, blank=True, default="")

    logo = FileField(_("Organisation Logo"), max_length=200, format="Image", upload_to=upload_to(
        "eceeelibrary.memberorganizations.image", "memberorganizations"), null=True, blank=True)
    affiliations = GenericCategoriesField('eceeememberforum.models.AssignedMemberAffiliation',
                                          'eceeememberforum.models.MemberAffiliation',
                                          category_name='affiliation',
                                          verbose_name=_("MemberAffiliations"))
    categories = GenericCategoriesField('eceeememberforum.models.AssignedMemberCategory',
                                        'eceeememberforum.models.MemberCategory',
                                        category_name='category',
                                        verbose_name=_("MemberCategories"))

    language = models.CharField(
        _("Language"), max_length=200, blank=True, null=True, default=u"")
    rights = models.CharField(
        _("Rights"), max_length=200, blank=True, null=True, default=u"")

    country = models.CharField(
        _("Country"), max_length=200, blank=True, null=True, choices=possible_countries)
    is_international = models.BooleanField(
        _("Is International"), default=False, db_index=False)
    priority = models.BooleanField(
        _(u"Priority"), default=False, db_index=False)

    def get_content_model(self):
        return self

    def get_absolute_url(self, site_filter=None):
        return reverse('eceee-member-organisation', kwargs={'organisation': self.slug})

    def save(self, *args, **kwargs):
        """
        Set the description field on save.
        """
        if not self.title:
            self.title = self.organization
        if not self.organizations_full_name:
            self.organizations_full_name = self.organization
        if self.description:
            self.gen_description = False
        else:
            self.gen_description = True
        super(EceeeMemberOrganization, self).save(*args, **kwargs)


class ProjectCategoryManager(CurrentSiteManager):

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


class ProjectCategory(Slugged):
    """
    Affiliations which are managed via a custom JavaScript based
    widget in the admin.
    """

    objects = ProjectCategoryManager()

    class Meta:
        verbose_name = _("Project Category")
        verbose_name_plural = _("Project Categories")



class AssignedProjectCategory(Orderable):
    """
    A ``Affiliation`` assigned to a model instance.
    """

    project_category = models.ForeignKey("ProjectCategory", verbose_name=_("Project Category"),
                                         related_name="project_categories", on_delete=models.CASCADE)
    content_type = models.ForeignKey("contenttypes.ContentType", on_delete=models.CASCADE)
    object_pk = models.IntegerField()
    content_object = GenericForeignKey("content_type", "object_pk")

    class Meta:
        order_with_respect_to = "content_object"

    def __str__(self):
        return str(self.project_category)

    @classmethod
    def category_name(self):
        return 'project_category'

    @classmethod
    def related_name(self):
        return 'project_categories'


class ReportCategoryManager(CurrentSiteManager):

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


class ReportCategory(Slugged):
    """
    Affiliations which are managed via a custom JavaScript based
    widget in the admin.
    """

    objects = ReportCategoryManager()

    class Meta:
        verbose_name = _("Report Category")
        verbose_name_plural = _("Report Categories")



class AssignedReportCategory(Orderable):
    """
    A ``Affiliation`` assigned to a model instance.
    """

    report_category = models.ForeignKey("ReportCategory", verbose_name=_("Report Category"),
                                        related_name="report_categories", on_delete=models.CASCADE)
    content_type = models.ForeignKey("contenttypes.ContentType", on_delete=models.CASCADE)
    object_pk = models.IntegerField()
    content_object = GenericForeignKey("content_type", "object_pk")

    class Meta:
        order_with_respect_to = "content_object"

    def __str__(self):
        return str(self.report_category)

    @classmethod
    def category_name(self):
        return 'report_category'

    @classmethod
    def related_name(self):
        return 'report_categories'


class EceeeMemberActivity(Displayable):
    """
    EceeeMemberActivity. All Pages should be based on this.
    """

    class Meta:
        verbose_name = _("Member Activity")
        verbose_name_plural = _("Member Activities")

    page_layout = 'layout_content'
    type_of_activity = models.CharField(_("Type of Activity"), max_length=400, blank=False, default=MEMBER_ACTIVITIES[0][0], choices=MEMBER_ACTIVITIES
                                        )
    page_header = models.CharField(
        _("Page Header"), max_length=400, blank=True, default='', editable=False)
    text = RichTextField(
        _("Description of the organisation"), blank=True, default="")
    # project_category = models.CharField(_("Project Categories"), max_length=200, blank=True, null=True, default=None
    #        , choices=possible_categories)
    activity_link = models.URLField(
        _("Activity Link"), max_length=2000, blank=True, null=False, default='')
    project_categories = GenericCategoriesField('eceeememberforum.models.AssignedProjectCategory',
                                                'eceeememberforum.models.ProjectCategory', category_name='project_category', verbose_name=_("Project Categories"))
    report_category = GenericCategoriesField('eceeememberforum.models.AssignedReportCategory',
                                             'eceeememberforum.models.ReportCategory', category_name='report_category', verbose_name=_("Report Categories"))
    eceee_categories = GenericCategoriesField('eceeebase.models.AssignedeceeeCategory',
                                              'eceeebase.models.eceeeCategory', category_name='eceee_category', verbose_name=_("eceee Categories"))
    organisation = models.ForeignKey("EceeeMemberOrganization", verbose_name=_(
        'Member Organisation'), related_name="projects", on_delete=models.CASCADE)

    def get_absolute_url(self, site_filter=None):
        organisation = self.organisation.slug
        if organisation:
            return reverse('eceee-member-activity', kwargs={'organisation': organisation, 'activity': self.slug})
        return reverse('eceee-member-activity')

    def get_slug(self, site_filter=None):
        organisation = self.organisation.slug
        if organisation:
            return u"{}/{}".format(organisation, self.slug)
        return self.slug

    def save(self, *args, **kwargs):
        """
        Set the description field on save.
        """
        if not self.slug:
            self.slug = slugify(self.title)
        if not self.title:
            self.title = self.page_header
        if self.description:
            self.gen_description = False
        else:
            self.gen_description = True
        super(EceeeMemberActivity, self).save(*args, **kwargs)
