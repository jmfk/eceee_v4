from django.db import models


class PagePathAlias(models.Model):
    """A former public path resolves to the page's current path, without chains."""

    tenant = models.ForeignKey("core.Tenant", on_delete=models.CASCADE)
    root = models.ForeignKey("webpages.WebPage", on_delete=models.CASCADE, related_name="path_aliases")
    page = models.ForeignKey("webpages.WebPage", on_delete=models.CASCADE, related_name="previous_paths")
    path = models.CharField(max_length=2048)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["root", "path"], name="page_alias_root_path")]
