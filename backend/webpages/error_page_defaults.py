"""Portable default content for editable site error pages."""

import uuid

ERROR_PAGE_CONTENT = {
    403: ("Access denied", "You do not have permission to view this page."),
    404: ("Page not found", "The page may have moved, or the address may be incorrect."),
    500: ("Something went wrong", "We could not complete your request. Please try again in a moment."),
    503: ("Temporarily unavailable", "This site is taking a short break. Please try again soon."),
}

ERROR_ILLUSTRATION = (
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 480 360'%3E"
    "%3Crect width='480' height='360' rx='48' fill='%23eef2ff'/%3E"
    "%3Cpath d='M95 244c34-92 85-138 153-138 56 0 102 35 137 106' fill='none' "
    "stroke='%236366f1' stroke-width='24' stroke-linecap='round'/%3E"
    "%3Ccircle cx='179' cy='177' r='17' fill='%231f2937'/%3E%3Ccircle cx='305' cy='177' r='17' fill='%231f2937'/%3E"
    "%3Cpath d='M190 254c28-25 72-25 100 0' fill='none' stroke='%231f2937' stroke-width='14' stroke-linecap='round'/%3E"
    "%3C/svg%3E"
)


def _widget_id(root_page_id: int, status_code: int, name: str) -> str:
    return str(uuid.uuid5(uuid.NAMESPACE_URL, f"https://eceee.org/site/{root_page_id}/error/{status_code}/{name}"))


def error_page_widgets(root_page_id: int, status_code: int) -> dict:
    title, explanation = ERROR_PAGE_CONTENT[status_code]
    return {
        "visual": [
            {
                "id": _widget_id(root_page_id, status_code, "illustration"),
                "type": "easy_widgets.ImageWidget",
                "config": {
                    "mediaItems": [
                        {
                            "id": _widget_id(root_page_id, status_code, "illustration-media"),
                            "url": ERROR_ILLUSTRATION,
                            "type": "image",
                            "altText": "Abstract illustration for an error page",
                            "title": "Error page illustration",
                        }
                    ],
                    "displayType": "gallery",
                    "galleryColumns": 1,
                    "showCaptions": False,
                    "enableLightbox": False,
                },
            }
        ],
        "message": [
            {
                "id": _widget_id(root_page_id, status_code, "headline"),
                "type": "easy_widgets.HeadlineWidget",
                "config": {"content": f"{status_code} — {title}", "headerLevel": "h1", "showBorder": False},
            },
            {
                "id": _widget_id(root_page_id, status_code, "explanation"),
                "type": "easy_widgets.ContentWidget",
                "config": {
                    "content": f"<p>{explanation}</p>",
                    "sanitizeHtml": True,
                    "showBorder": False,
                    "useContentMargins": False,
                },
            },
        ],
        "actions": [
            {
                "id": _widget_id(root_page_id, status_code, "actions"),
                "type": "easy_widgets.ContentWidget",
                "config": {
                    "content": '<p><a href="/">Return to the home page</a></p>',
                    "sanitizeHtml": True,
                    "showBorder": False,
                    "useContentMargins": False,
                },
            }
        ],
    }
