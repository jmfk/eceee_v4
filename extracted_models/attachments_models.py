import os
from datetime import datetime

from django.contrib.auth.models import User
from django.contrib.contenttypes import fields
from django.contrib.contenttypes.models import ContentType
from django.db import models
from django.utils.translation import gettext_lazy as _


class AttachmentManager(models.Manager):
    def attachments_for_object(self, obj):
        object_type = ContentType.objects.get_for_model(obj)
        return self.filter(content_type__pk=object_type.id,
                           object_id=obj.id)

class AttachmentBase(models.Model):
    def attachment_upload(instance, filename):
        """Stores the attachment in a "per module/appname/primary key" folder"""
        return 'attachments/%s/%s/%s' % (
            '%s_%s' % (instance.content_object._meta.app_label,
                       instance.content_object._meta.object_name.lower()),
                       instance.content_object.pk,
                       filename)

    objects = AttachmentManager()

    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    object_id = models.PositiveIntegerField()
    content_object = fields.GenericForeignKey('content_type', 'object_id')
    creator = models.ForeignKey(User, related_name="created_attachments",
                                verbose_name=_('creator'), on_delete=models.CASCADE)
    attachment_file = models.FileField(_('attachment'), upload_to=attachment_upload)
    created = models.DateTimeField(_('created'), auto_now_add=True)
    modified = models.DateTimeField(_('modified'), auto_now=True)
    mime_type = models.CharField(_("mime_type"), max_length=60, default='application/binary')

    class Meta:
        abstract = True

        ordering = ['-created']
        permissions = (
            ('delete_foreign_attachments', 'Can delete foreign attachments'),
        )

    def get_file_type(self):
        if self.mime_type:
            mime_type = self.mime_type.split('/')[-1]
            if mime_type:
                return mime_type
        return ''

    def __unicode__(self):
        mime_type = self.get_file_type()
        if mime_type:
            mime_type = u" (%s)" % mime_type
        return u'%s attached %s%s' % (self.creator.username, self.attachment_file.name, mime_type)

    @property
    def filename(self):
        return os.path.split(self.attachment_file.name)[1]


class Attachment(AttachmentBase):

    title = models.CharField(_("title"), max_length=100, blank=True)

    def __unicode__(self):
        mime_type = self.get_file_type()
        if mime_type:
            mime_type = u" (%s)" % mime_type
        return u'%s%s' % (self.title,mime_type)


