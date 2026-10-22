"""Initial install profile. Live definitions remain PostgreSQL-owned and exportable."""

from copy import deepcopy

PROFILE = "eceee-editorial-v1"
OBJECT_TYPES = ("article", "columnist", "event", "library_item", "organization")


def field(title, component="text", **extra):
    return {
        "title": title,
        "componentType": component,
        "field_type": component,
        "type": "array" if component == "object_reference" else "boolean" if component == "boolean" else "string",
        **extra,
    }


DEFINITIONS = {
    "article": (
        "Artikel",
        "Artiklar",
        {
            "summary": field("Ingress", "textarea"),
            "presentationalPublishingDate": field("Visningsdatum", "datetime"),
            "sourceDate": field("Källdatum", "datetime"),
            "externalUrl": field("Extern källa", "url"),
            "featuredImage": field("Huvudbild", "image"),
            "authors": field(
                "Krönikörer",
                "object_reference",
                multiple=True,
                allowed_object_types=["columnist"],
                relationship_type="authors",
                default=[],
            ),
        },
    ),
    "columnist": (
        "Krönikör",
        "Krönikörer",
        {
            "firstName": field("Förnamn"),
            "lastName": field("Efternamn"),
            "prefix": field("Titel"),
            "affiliation": field("Organisationstillhörighet"),
            "homePage": field("Webbplats", "url"),
            "photo": field("Porträtt", "image"),
        },
    ),
    "event": (
        "Evenemang",
        "Evenemang",
        {
            "eventStartDate": field("Startdatum", "date"),
            "eventEndDate": field("Slutdatum", "date"),
            "eventTime": field("Tid"),
            "organiser": field("Arrangör"),
            "venue": field("Plats"),
            "focusAreas": field("Fokusområde", "textarea"),
            "externalUrl": field("Evenemangets webbplats", "url"),
        },
    ),
    "library_item": (
        "Publikation",
        "Publikationer",
        {
            "summary": field("Sammanfattning", "textarea"),
            "document": field("Huvuddokument", "file"),
            "externalUrl": field("Extern referens", "url"),
        },
    ),
    "organization": (
        "Organisation",
        "Organisationer",
        {
            "fullName": field("Publikt namn"),
            "homePage": field("Webbplats", "url"),
            "logo": field("Logotyp", "image"),
            "country": field("Land"),
            "isInternational": field("Internationell organisation", "boolean"),
        },
    ),
}
CLASSIFICATIONS = {
    "article_kind": ("Innehållsslag", ["article"]),
    "news_type": ("Nyhetstyp", ["article"]),
    "news_category": ("Nyhetskategori", ["article"]),
    "news_source": ("Källa", ["article"]),
    "news_topic": ("Ämne", ["article", "event", "library_item"]),
    "news_keyword": ("Nyckelord", ["article"]),
    "general": ("Allmänt", list(OBJECT_TYPES)),
    "event_type": ("Evenemangstyp", ["event"]),
    "event_category": ("Evenemangskategori", ["event"]),
    "publication_category": ("Publikationskategori", ["library_item"]),
    "organization_category": ("Organisationskategori", ["organization"]),
    "organization_affiliation": ("Organisationstillhörighet", ["organization"]),
}


def initial_bundle():
    definitions = []
    for key, (label, plural, properties) in DEFINITIONS.items():
        definitions.append(
            {
                "name": key,
                "label": label,
                "plural_label": plural,
                "is_active": True,
                "hierarchy_level": "top_level_only",
                "description": f"{label} i ECEEE:s gemensamma innehållsmodell.",
                "schema": {
                    "type": "object",
                    "properties": deepcopy(properties),
                    "propertyOrder": list(properties),
                    "required": [],
                },
                "slot_configuration": {
                    "slots": [
                        {
                            "name": "main",
                            "label": "Innehåll",
                            "allowed_widgets": ["easy_widgets.ContentWidget", "easy_widgets.TableWidget"],
                        }
                    ]
                },
                "metadata": {"content_profile": {"id": PROFILE, "version": 1}},
                "browser_group_name": "article" if key == "columnist" else None,
            }
        )
    return {
        "format": "eceee-content-definitions",
        "version": 1,
        "profile": PROFILE,
        "definitions": definitions,
        "classification_types": [
            {
                "key": key,
                "name": label,
                "object_types": uses,
                "resource_uses": ["pages", "media_files", "media_collections"] if key == "general" else [],
            }
            for key, (label, uses) in CLASSIFICATIONS.items()
        ],
        "terms": [
            {"type": "article_kind", "slug": "news", "name": "Nyhet", "parent": None},
            {"type": "article_kind", "slug": "column", "name": "Krönika", "parent": None},
            {"type": "article_kind", "slug": "press-release", "name": "Pressmeddelande", "parent": "news"},
        ],
    }
