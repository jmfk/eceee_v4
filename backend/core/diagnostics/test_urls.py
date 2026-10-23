# Exercise tenant attribution through the real middleware without a CMS view dependency.
from django.http import JsonResponse
from django.urls import include, path

from .events import REQUEST_ID, TENANT


def context_probe(request):
    if request.GET.get("fail"):
        raise ValueError("test-only context reset")
    return JsonResponse({"tenant": TENANT.get(), "request_id": REQUEST_ID.get()})


urlpatterns = [
    path("api/v1/diagnostics/", include("core.diagnostics.urls")),
    path("test-diagnostic-context/", context_probe),
]
