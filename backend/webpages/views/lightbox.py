import json
from django.http import HttpResponse
from django.template.loader import render_to_string


def lightbox_item_view(request):
    src = request.GET.get("src", "")
    caption = request.GET.get("caption", "")
    alt = request.GET.get("alt", "")
    group = request.GET.get("group", "")
    style = request.GET.get("style", "default")

    payload = {
        "src": src,
        "caption": caption,
        "alt": alt,
        "group": group,
        "style": style,
    }

    html = render_to_string(
        "lightbox/item_oob.html",
        {
            "payload_json": json.dumps(payload),
        },
        request=request,
    )
    return HttpResponse(html)


def lightbox_group_view(request):
    # Placeholder for future grouped navigation payloads
    return HttpResponse("")


