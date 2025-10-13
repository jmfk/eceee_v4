import re

from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from django.db import models
from django.db.models import Q
from django.db.models.query import QuerySet
from django.template import TemplateDoesNotExist, loader
from django.urls import reverse
from django.utils.timezone import now
from django.utils.translation import gettext_lazy as _
from mezzanine.conf import settings
from mezzanine.core.managers import CurrentSiteManager
from mezzanine.core.models import SiteRelated
from orderable.models import Orderable

from easywidget import registry
from easywidget.admin_inline import WidgetType
import logging

logger = logging.getLogger(__name__)

RE_FIRST_DIV = re.compile(r"<div[^>]*>")


class EasyWidgetViewBase(object):
    """
    Base class for all widget plugin classes
    """

    editableFields = ""
    template = None
    raw = False
    model = None

    def __init__(self, data=None):
        self.data = data

    def get_data(self):
        return self.data

    def get_context(
        self,
        context=None,
        widget=None,
        user=None,
        page=None,
        path=None,
        slot=None,
        do_random=False,
    ):
        if context is None:
            context = {}
        context["content_object"] = self.data
        context["data"] = self.data
        return context

    def get_queryset(
        self,
        context,
        widget=None,
        user=None,
        page=None,
        path=None,
        slot=None,
        do_random=False,
    ):
        return QuerySet.none

    def render(
        self,
        context=None,
        widget=None,
        user=None,
        page=None,
        path=None,
        slot=None,
        do_random=False,
        proxy_widget=None,
    ):
        context = self.get_context(
            context=context,
            widget=widget,
            page=page,
            path=path,
            user=user,
            slot=slot,
            do_random=do_random,
        )
        request = context["request"]
        no_edit = request.GET.get("no-edit", "false").lower() == "true"
        context["objects"] = self.get_queryset(
            context=context,
            widget=widget,
            page=page,
            path=path,
            user=user,
            slot=slot,
            do_random=do_random,
        )
        try:
            context["widget"] = widget
            template_name = self.get_template(context)
            if template_name is not None:
                template = loader.get_template(template_name)
                try:
                    template = template.template.render(context)
                except Exception as e:
                    logger.error(
                        """Failed to render template for widget %s\n%s"""
                        % (template_name, str(e))
                    )
                    return """<p>%s""" % (str(e),)
                if user.is_staff and not no_edit:
                    if proxy_widget is not None:
                        edit_url = reverse(
                            "admin:easywidget_easywidget_change",
                            args=(proxy_widget.id,),
                        )
                    else:
                        edit_url = reverse(
                            "admin:easywidget_easywidget_change", args=(widget.id,)
                        )
                    edit_button = """<div class="row"><div class="col"><p class="edit-widget-button"><a href="{}" target="_blank">Edit Widget</a></p></div></div>""".format(
                        edit_url
                    )
                    if edit_button:
                        first_div = RE_FIRST_DIV.search(template)
                        if first_div:
                            insert_point = RE_FIRST_DIV.search(template).end()
                            template = (
                                template[:insert_point]
                                + edit_button
                                + template[insert_point:]
                            )
                        else:
                            template = edit_button + template
                return template
            else:
                return "No template."
        except TemplateDoesNotExist as e:
            return "EasyWidgetViewBase render failed. TemplateDoesNotExist: %s." % (
                template,
            )
        return "EasyWidgetViewBase render failed."

    def cleanup(self, **kwargs):
        return True

    def get_template(self, context):
        try:
            return context["content_object"].template
        except:
            pass
        return self.template


class EasyWidgetManager(CurrentSiteManager):
    def published(self, for_user=None):
        """
        For non-staff/permissionless users, return items with a published status and
        whose publish and expiry dates fall before and after the
        current date when specified.
        :param for_user:
        """

        return self.filter(
            Q(publish_date__lte=now()) | Q(publish_date__isnull=True),
            Q(expiry_date__gte=now()) | Q(expiry_date__isnull=True),
            Q(enabled=True),
        )

    def published_for_path(self, path, slot=None, for_user=None, noinherence=False):
        """
        For non-staff/permissionless users, return items with that are published and
        belong to a certain page or page less
        """
        if path is None:
            return self.none()
        if path.endswith("/"):
            path = path[:-1]
        path_so_far = ""
        paths = []
        path_subs = []
        for p in path.split("/"):
            if path_so_far != "/":
                path_so_far += "/" + p
            else:
                path_so_far += p
            path_subs.append(path_so_far)
        path_subs.reverse()
        current_path = path_subs.pop(0)
        while current_path:
            quit_now = noinherence
            result = None
            # if no match look for wildcard / wildcard
            q = Q(path=current_path)
            if current_path:
                q = (
                    q
                    | Q(path__startswith=current_path + ";")
                    | Q(path__contains=";" + current_path + ";")
                )
            if slot:
                result = (
                    self.published(for_user).filter(widgetslot=slot).filter(q)
                )  # Q(path=current_path) | Q(path__contains=';'+current_path))
            else:
                result = self.published(for_user).filter(
                    q
                )  # Q(path=current_path) | Q(path__contains=';'+current_path))
            # if no match look for wildcard
            if result.count() == 0:
                new_current_path = "/".join(current_path.split("/")[:-1])
                wildcard_current_path = new_current_path + "/*"
                q = Q(path=new_current_path) | Q(path=wildcard_current_path)
                if current_path:
                    q = (
                        q
                        | Q(path__contains=";" + new_current_path + ";")
                        | Q(path__startswith=new_current_path + ";")
                        | Q(path__contains=";" + wildcard_current_path + ";")
                        | Q(path__startswith=wildcard_current_path + ";")
                    )
                if slot:
                    result = self.published(for_user).filter(widgetslot=slot).filter(q)
                else:
                    result = self.published(for_user).filter(q)
            if result.count() == 0:
                new_current_path = "/".join(current_path.split("/")[:-2])
                wildcard_current_path = new_current_path + "/*"
                wildcard_current_path_2 = new_current_path + "/*/*"
                q = (
                    Q(path=new_current_path)
                    | Q(path=wildcard_current_path)
                    | Q(path=wildcard_current_path_2)
                )
                if current_path:
                    q = (
                        q
                        | Q(path__startswith=new_current_path + ";")
                        | Q(path__contains=";" + new_current_path + ";")
                        | Q(path__startswith=wildcard_current_path + ";")
                        | Q(path__contains=";" + wildcard_current_path + ";")
                        | Q(path__startswith=wildcard_current_path_2 + ";")
                        | Q(path__contains=";" + wildcard_current_path_2 + ";")
                    )
                if slot:
                    result = self.published(for_user).filter(widgetslot=slot).filter(q)
                else:
                    result = self.published(for_user).filter(q)
            new_result = []
            for r in result:
                if r.end_path:
                    end_paths = r.end_path.replace(",", ";").split(";")
                    end_paths = ["/" + x.strip().strip("/") for x in end_paths]
                    if (
                        len([x for x in end_paths if path.startswith(x) and x != path])
                        == 0
                    ):
                        new_result.append(r.id)
                else:
                    new_result.append(r.id)
            if len(new_result):
                new_result = self.published(for_user).filter(id__in=new_result)
                paths.append((path_so_far, new_result))  # paths could be removed
                break
            if len(path_subs) > 0:
                current_path = path_subs.pop(0)
            else:
                current_path = None
        if paths:
            return paths[-1][1]
        return self.none()


class EasyWidget(Orderable, SiteRelated):
    # Add more fields to this class, before replicating it for more page-classes.
    title = models.CharField(_("Title"), max_length=200, blank=False)
    enabled = models.BooleanField(_("Enabled"), default=True)
    widgetslot = models.CharField(
        max_length=255,
        default=settings.WIDGETS_SLOTS[0][0],
        choices=settings.WIDGETS_SLOTS,
    )

    path = models.CharField(
        _("Start Path"), max_length=1024, default="", null=False, blank=True
    )
    end_path = models.CharField(
        _("End Paths (separated by ;)"),
        max_length=1024,
        default="",
        null=False,
        blank=True,
    )

    publish_date = models.DateTimeField(
        _("Published from"),
        help_text=_("With published checked, won't be shown until this time"),
        blank=True,
        null=True,
    )
    expiry_date = models.DateTimeField(
        _("Expires on"),
        help_text=_("With published checked, won't be shown after this time"),
        blank=True,
        null=True,
    )

    objects = EasyWidgetManager()

    class Meta:
        verbose_name = _("Widget")
        verbose_name_plural = _("Widgets")

    def __unicode__(self):
        return self.title or _("No name")

    def get_view(self, default=None):
        content_type = ContentType.objects.get_for_model(self)
        widget_type = WidgetType.objects.filter(
            object_id=self.id, content_type=content_type
        ).first()
        if widget_type:
            view = registry.get_widget(widget_type.widget_type)
            if view and view.model is not None:
                data = view.model.objects.filter(object_id=self.id).first()
                if data is None:
                    data = view.model(content_type=content_type, object_id=self.id)
                    data.save()
                return view(data=data)
        return default

    def save(self, *args, **kwargs):
        """
        Save indexed fields for event day, month, year (start event)
        """
        self.path = self.path.strip()
        paths = []
        for path in self.path.split(";"):
            path = path.strip("/")
            if path != "":
                if not path.startswith("/"):
                    path = "/" + path
                paths.append(path)
        if len(paths) > 1 and paths[-1] != "":
            paths.append("")
        self.path = ";".join(paths)
        if self.path == "":
            self.path = "/"
        if self.end_path:
            end_paths = self.end_path.replace(",", ";").split(";")
            end_paths = ["/" + x.strip().strip("/") for x in end_paths]
            self.end_path = "; ".join(end_paths)
        super(EasyWidget, self).save(*args, **kwargs)


class EasyWidgetModelBase(models.Model):
    class Meta:
        abstract = True

    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    object_id = models.PositiveIntegerField()
    content_object = GenericForeignKey("content_type", "object_id")
