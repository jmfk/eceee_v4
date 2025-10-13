#encoding: utf-8
import datetime
import os
from string import punctuation
from urllib.parse import unquote
from zipfile import ZipFile

from bs4 import BeautifulSoup
from dateutil.relativedelta import relativedelta
from django import forms
from django.contrib.auth.models import User
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.core.mail import send_mail
from django.db import models
from django.template.loader import render_to_string
from django.urls import reverse
from django.utils.text import slugify
from django.utils.timezone import now
from django.utils.translation import gettext_lazy as _
from easypublisher.fields import ApprovedField, ListField
from easypublisher.models import AcquisitionMixin
from eceeebase.fields import GenericCategoriesField, InheritCharField
from eceeebase.value_lists import eceee_sites, possible_jobs_types
from flexibledatefield.fields import FlexibleDateField
from mezzanine.conf import settings
from mezzanine.core.fields import FileField, OrderField, RichTextField
from mezzanine.core.managers import CurrentSiteManager, DisplayableManager
from mezzanine.core.models import (CONTENT_STATUS_DRAFT,
                                   CONTENT_STATUS_PUBLISHED, Displayable,
                                   Orderable, RichText, Slugged)
from mezzanine.generic.fields import CommentsField
from mezzanine.generic.models import AssignedKeyword, Keyword
from mezzanine.pages.models import Link, Page
from mezzanine.utils.importing import import_dotted_path
from mezzanine.utils.models import AdminThumbMixin, upload_to
from multiselectfield import MultiSelectField


class EceeeJobsItemManager(DisplayableManager):

    def get_current_jobs(self):
        return self.published().filter(deleted=False, approved_timestamp__isnull=False, due_date__gte=now()).order_by('approved_timestamp')

    def get_by_year_months(self):
        result = []
        for due_year_month in self.get_year_months():
            items = self.published().filter(due_date__gte=now()).filter(due_year_month=due_year_month).order_by('due_year_month')
            due_date_grouped = items.first().due_date
            result.append({'year_month': due_year_month, 'due_date_grouped':due_date_grouped,  'items': items})
        return result

    def get_year_months(self):
        qs = self.published().filter(due_date__gte=now()).values_list('due_year_month', flat=True).distinct().order_by('due_year_month')
        return qs

    def clone(self, objs=None):
        clones = []
        if objs is not None:
            for obj in objs:
                clone = self.create(
                    due_date=obj.due_date, due_year_month=obj.due_year_month,
                    title=u'Clone: ' + obj.title,
                    draft_title=u'Clone: ' + obj.draft_title,
                    owner=obj.owner,
                    content=obj.content, draft=obj.draft,
                    ingress=obj.ingress, draft_ingress=obj.draft_ingress,
                    dirty=obj.dirty, deleted=False, approved=obj.approved,
                    approved_timestamp=obj.approved_timestamp, jobs_types=obj.jobs_types,
                    contact_person=obj.contact_person, contact_person_email=obj.contact_person_email, contact_person_phone=obj.contact_person_phone,
                    company_address=obj.company_address, euvat_no=obj.euvat_no, member_organisation=obj.member_organisation,
                    job_period=obj.job_period, url=obj.url, agree_to_terms=obj.agree_to_terms,
                )
                clone.save()
                clones.append(clone)
        return clones


class EceeeJobsItem(AcquisitionMixin, Displayable):
    """
    EceeeJobsItem. All Pages should be based on this.
    """

    class Meta:
        verbose_name = _("Jobs Item")
        verbose_name_plural = _("Jobs Items")
        #app_label = 'briskee'

    page_layout = 'layout_content'

    objects = EceeeJobsItemManager()

    def __init__(self, *args, **kwargs):
        super(EceeeJobsItem, self).__init__(*args, **kwargs)


    due_date = models.DateTimeField(_(u'Unpublish Date'), null=True, blank=True, default=None)
    due_year_month = models.IntegerField(default=None, null=True, editable=False)
    draft_title = models.CharField(_("Draft Title"), max_length=120)
    owner = models.ForeignKey(User, related_name="jobsitems",
                              default=None, null=True, on_delete=models.CASCADE)
    content = RichTextField(_("Content"), default='', blank=True)
    draft = RichTextField(_("Draft Content"),  max_length=60000)

    ingress = models.TextField(_("Short Description"), default='', max_length=300, blank=True)
    draft_ingress = models.TextField(_("Draft Short Description"), default='', max_length=300, blank=True)

    dirty = models.BooleanField(_("Changed by User"), default=True, db_index=True, editable=False)
    deleted = models.BooleanField(_("Deleted"), default=False, db_index=True, editable=False)
    approved = models.BooleanField(_("Approve"), default=False, db_index=True)
    approved_timestamp = models.DateTimeField(_(u'Approved Timestamp'), null=True, blank=None, default=None, editable=False)
    #jobs_types = models.CharField(_("Contact person"), max_length=120, default='', blank=True)
    jobs_types = models.CharField(_("Type of job, tender, invitation"), max_length=80, blank=True, null=True,
        default=possible_jobs_types[0][0], choices=possible_jobs_types)

    contact_person = models.CharField(_("Contact person"), max_length=120, default='', blank=True)
    contact_person_email = models.EmailField(_("Contact e-mail"), default='', blank=True)
    contact_person_phone = models.CharField(_("Phone number "), max_length=120, default='', blank=True)
    company_address =  models.TextField(_("Company address and billing information"), max_length=600, default='', blank=True)
    euvat_no =  models.CharField(_("EUVAT No. (if applicable)"), max_length=120, default='', blank=True)
    member_organisation = models.CharField(_("eceee member organisation name (needed for discounted price)"), max_length=120, default='', blank=True)

    CHOICES = ((3, 'Max 3 months display',), (6, 'Max 6 months display',))
    job_period = models.IntegerField(_("Job/tender posting"), null=True, default=None, choices=CHOICES) #max_length=2,
    url = models.URLField(_("URL (optional)"), null=True, blank=True)
    agree_to_terms  = ApprovedField(_("I agree on the terms and conditions stated above " \
                                      "and is aware that eceee will invoice me. " \
                                      "I am aware that eceee will store mine and my " \
                                      "company’s data digitally, but eceee will not " \
                                      "sell or share this data."), default=False)

    def get_content_model(self):
        return self

    def get_absolute_url(self, site_filter=None):
        return reverse('eceeejobs-item', kwargs={'slug': self.slug} )

    def get_admin_change_url(self):
        return reverse('admin:%s_%s_change' %(self._meta.app_label,  self._meta.model_name),  args=[self.id] )

    @property
    def is_published(self):
        return not self.deleted and self.status==CONTENT_STATUS_PUBLISHED and self.due_date > now()

    @property
    def publish_status(self):
        published = "Pending Approval"
        if self.deleted:
            published = "Manually Unpublished"
        elif self.due_date is not None and self.due_date <= now():
            published = "Over Due"
        elif self.status==CONTENT_STATUS_PUBLISHED:
            published = "Published"
            if self.dirty:
                published = "Published (updates waiting for approval)"
        else:
            published = "Pending Approval"
            if self.dirty:
                published = "Pending Approval"
        return published

    @property
    def has_been_approved(self):
        return True if self.approved_timestamp!=None else False

    @property
    def calculated_due_date(self):
        return now() + relativedelta(months=self.job_period or 3, days=3)

    def do_approve(self):
        self.content = self.draft
        self.title = self.draft_title
        self.approved = False
        self.approved_timestamp = now()
        self.dirty = False
        self.deleted = False
        self.save()
        return self

    def save(self, *args, **kwargs):
        """
        Set the description field on save.
        """
        if self.pk is None and not self.slug:
            self.slug = slugify(self.draft_title)
        if self.pk is None and not self.title:
            self.status = CONTENT_STATUS_DRAFT
            self.title = "Needs Approval"
        if self.pk is None and not self.title:
            self.status = CONTENT_STATUS_DRAFT
            self.content = "<h1>Needs Approval</h1>"
        if self.description:
            self.gen_description = False
        else:
            self.gen_description = True

        if self.approved and ((self.draft!=self.draft_title or self.content!=self.draft or self.ingress!=self.draft_ingress) or self.dirty or self.deleted):
            self.approved_timestamp = now()
            self.ingress = self.draft_ingress
            self.content = self.draft
            self.title = self.draft_title
            self.dirty = False
            self.deleted = False
            self.status = CONTENT_STATUS_PUBLISHED
            self.due_date = now() + relativedelta(months=self.job_period, days=3)
            due_year_month = self.due_date.year * 100 + self.due_date.month
            if self.due_year_month!=due_year_month:
                self.due_year_month = due_year_month

            tolist = ['johan@colliberty.com']
            if self.contact_person_email:
                tolist.append(self.contact_person_email)
            if self.owner and self.owner.email:
                tolist.append(self.owner.email)
            view_url = reverse('eceeejobs-item', kwargs={'slug': self.slug} )
            edit_url = reverse('eceeejobs-edit-post', kwargs={'slug': self.slug} )
            subject = "[eceee job] Job Posting Approved"
            body = "[eceee job] Job Posting Approved.\n\n" \
                   "Your job posting %s has been approved. Due date is %s.\n" \
                   "View it here https://www.eceee.org%s.\n" \
                   "Edit it here https://www.eceee.org%s" % (self.title, self.due_date.strftime('%d/%m/%Y'), view_url, edit_url)
            send_mail(subject, body, settings.DEFAULT_FROM_EMAIL, tolist)
        self.approved = False
        super(EceeeJobsItem, self).save(*args, **kwargs)
