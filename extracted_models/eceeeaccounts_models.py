from django.db import models
from django.utils.translation import gettext_lazy as _


class ProfileModel(models.Model):
    """
    ProfileModel.
    """

    class Meta:
        verbose_name = _("Profile Model")
        verbose_name_plural = _("Profile Models")

    user = models.OneToOneField(
        "auth.User", on_delete=models.CASCADE, related_name="profile"
    )

    fm_id = models.IntegerField(_("FileMaker ID"), null=True, blank=True, db_index=True)
    fm_id_version = models.CharField(
        _("FileMaker ID Version"), null=True, blank=True, max_length=20, db_index=True
    )
