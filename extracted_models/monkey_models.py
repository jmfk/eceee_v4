from __future__ import unicode_literals

from django.db import models

# Create your models here.

from django.apps import apps
from mezzanine.core.managers import DisplayableManager


def url_map(self, for_user=None, **kwargs):
    """
    Returns a dictionary of urls mapped to Displayable subclass
    instances, including a fake homepage instance if none exists.
    Used in ``mezzanine.core.sitemaps``.
    """
    #home = self.model(title=_("Home"))
    #setattr(home, "get_absolute_url", home_slug)
    #items = {home.get_absolute_url(): home}
    items = {}
    for model in apps.get_models():
        if issubclass(model, self.model):
            for item in (model.objects.published(for_user=for_user)
                              .filter(**kwargs)
                              .exclude(slug__startswith="http://")
                              .exclude(slug__startswith="https://")):
                items[item.get_absolute_url()] = item
    return items

DisplayableManager.url_map = url_map