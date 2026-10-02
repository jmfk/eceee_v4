"""Create deterministic pages and objects for Django/Next publisher parity testing."""

import hashlib
from datetime import timedelta

from django.contrib.auth.models import User
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from content.models import Namespace
from core.models import Tenant
from file_manager.models import MediaCollection, MediaFile
from object_storage.models import ObjectInstance, ObjectTypeDefinition, ObjectVersion
from webpages.models import PageTheme, PageVersion, WebPage


def widget(widget_id, widget_type, config):
    return {
        "id": widget_id,
        "type": widget_type,
        "config": config,
        "isPublished": True,
        "inheritanceLevel": 0,
        "inheritanceBehavior": "override_parent",
    }


class Command(BaseCommand):
    help = "Seed a comprehensive local site for Django/Next publisher parity tests"

    def add_arguments(self, parser):
        parser.add_argument("--hostname", default="renderer-supertest.localhost")

    @transaction.atomic
    def handle(self, *args, **options):
        hostname = WebPage.normalize_hostname(options["hostname"])
        user, _ = User.objects.get_or_create(
            username="publisher_supertest",
            defaults={"email": "publisher-supertest@example.invalid", "is_staff": True},
        )
        user.set_unusable_password()
        user.save(update_fields=["password"])
        tenant, _ = Tenant.objects.get_or_create(
            identifier="publisher-supertest",
            defaults={"name": "Publisher Supertest", "created_by": user},
        )
        namespace, _ = Namespace.objects.get_or_create(
            slug="publisher-supertest",
            defaults={
                "name": "Publisher Supertest",
                "description": "Deterministic Django/Next parity fixtures",
                "created_by": user,
                "tenant": tenant,
            },
        )

        theme, _ = PageTheme.objects.update_or_create(
            tenant=tenant,
            name="Publisher Supertest",
            defaults={
                "description": "High-contrast deterministic parity theme",
                "created_by": user,
                "is_active": True,
                "is_default": True,
                "colors": {"primary": "#164e63", "secondary": "#f59e0b"},
                "fonts": {},
                "breakpoints": {"sm": 640, "md": 768, "lg": 1024, "xl": 1280},
                "image_styles": self._image_styles(),
                "custom_css": ".supertest-marker { border-left: 4px solid #f59e0b; padding-left: 1rem; }",
            },
        )
        collection = self._media_collection(namespace, tenant, user)
        object_type, objects = self._objects(namespace, tenant, user)

        root = self._page(None, tenant, user, "renderer-supertest", "Renderer Supertest", hostname=hostname)
        features = self._page(root, tenant, user, "features", "Widget and carousel supertest")
        news = self._page(root, tenant, user, "objects", "Published objects", path_pattern_key="news_slug")
        generic_list = self._page(root, tenant, user, "generic-object-list", "Generic object list")
        generic_detail = self._page(root, tenant, user, "generic-object-detail", "Generic object detail")

        now = timezone.now()
        self._version(
            root,
            user,
            theme,
            now,
            {
                "main": [
                    widget(
                        "supertest-home",
                        "easy_widgets.ContentWidget",
                        {
                            "content": (
                                '<h1>Renderer Supertest</h1><p class="supertest-marker">'
                                "Deterministic fixtures for Django and Next.</p>"
                                '<ul><li><a href="/features/">Widgets and carousel</a></li>'
                                '<li><a href="/objects/">Dynamic object list and details</a></li>'
                                '<li><a href="/generic-object-list/">Generic object list</a></li>'
                                '<li><a href="/generic-object-detail/">Generic object detail</a></li></ul>'
                            )
                        },
                    )
                ]
            },
        )
        self._version(features, user, theme, now, self._feature_widgets(collection))
        self._version(
            news,
            user,
            theme,
            now,
            {
                "main": [
                    widget(
                        "supertest-object-list",
                        "easy_widgets.NewsListWidget",
                        {
                            "objectTypes": [object_type.id],
                            "limit": 10,
                            "sortOrder": "-publish_date",
                            "hideOnDetailView": True,
                            "showExcerpts": True,
                            "showFeaturedImage": False,
                            "showPublishDate": True,
                        },
                    ),
                    widget(
                        "supertest-object-detail",
                        "easy_widgets.NewsDetailWidget",
                        {
                            "objectTypes": [object_type.id],
                            "slugVariableName": "news_slug",
                            "showFeaturedImage": False,
                            "showMetadata": True,
                            "showObjectType": True,
                            "renderObjectWidgets": True,
                            "emptyMessage": "Choose a supertest article.",
                        },
                    ),
                    widget("supertest-path", "easy_widgets.PathDebugWidget", {}),
                ]
            },
        )
        self._version(
            generic_list,
            user,
            theme,
            now,
            {
                "main": [
                    widget(
                        "supertest-generic-object-list",
                        "object_storage.ObjectListWidget",
                        {
                            "object_type": object_type.name,
                            "limit": 3,
                            "order_by": "-publish_date",
                            "status_filter": "published",
                            "display_template": "list",
                            "show_excerpt": True,
                        },
                    )
                ]
            },
        )
        self._version(
            generic_detail,
            user,
            theme,
            now,
            {
                "main": [
                    widget(
                        "supertest-generic-object-detail",
                        "object_storage.ObjectDetailWidget",
                        {
                            "object_type": object_type.name,
                            "object_slug": "alpha-object",
                            "display_template": "full",
                            "show_metadata": True,
                            "show_hierarchy": False,
                            "show_widgets": True,
                        },
                    )
                ]
            },
        )
        self.stdout.write(
            self.style.SUCCESS(
                f"Seeded {hostname}: widget, dynamic object, generic list/detail, "
                f"and {len(objects)} object detail fixtures"
            )
        )

    def _page(self, parent, tenant, user, slug, title, hostname=None, path_pattern_key=""):
        page, _ = WebPage.objects.update_or_create(
            parent=parent,
            tenant=tenant,
            slug=slug,
            defaults={
                "title": title,
                "description": title,
                "hostnames": [hostname] if hostname else [],
                "path_pattern_key": path_pattern_key,
                "created_by": user,
                "last_modified_by": user,
            },
        )
        return page

    def _version(self, page, user, theme, effective_date, widgets):
        page_data = {"metaTitle": page.title, "metaDescription": page.description}
        latest = page.versions.order_by("-version_number").first()
        if (
            latest
            and latest.widgets == widgets
            and latest.page_data == page_data
            and latest.theme_id == theme.id
            and latest.code_layout == "main_layout"
        ):
            return latest

        return PageVersion.objects.create(
            page=page,
            version_number=(latest.version_number + 1) if latest else 1,
            version_title="Publisher supertest fixture",
            meta_title=page.title,
            meta_description=page.description,
            code_layout="main_layout",
            page_data=page_data,
            widgets=widgets,
            theme=theme,
            change_summary={"action": "seed_publisher_supertest_site"},
            created_by=user,
            effective_date=effective_date,
            expiry_date=None,
        )

    def _objects(self, namespace, tenant, user):
        object_type, _ = ObjectTypeDefinition.objects.update_or_create(
            name="publisher_supertest_article",
            defaults={
                "label": "Supertest article",
                "plural_label": "Supertest articles",
                "description": "Objects used by publisher parity tests",
                "schema": {
                    "type": "object",
                    "properties": {"summary": {"type": "string"}},
                    "property_order": ["summary"],
                },
                "slot_configuration": {"slots": [{"name": "main", "label": "Main"}]},
                "namespace": namespace,
                "is_active": True,
                "created_by": user,
            },
        )
        objects = []
        now = timezone.now()
        for index, (slug, title) in enumerate(
            [("alpha-object", "Alpha object"), ("beta-object", "Beta object"), ("gamma-object", "Gamma object")]
        ):
            instance, _ = ObjectInstance.objects.update_or_create(
                object_type=object_type,
                slug=slug,
                defaults={"title": title, "status": "published", "tenant": tenant, "created_by": user},
            )
            latest = instance.versions.order_by("-version_number").first()
            if latest and latest.change_description == "Publisher supertest fixture v2":
                version = latest
            else:
                version = ObjectVersion.objects.create(
                    object_instance=instance,
                    version_number=(latest.version_number + 1) if latest else 1,
                    data={
                        "summary": f"Deterministic summary for {title}.",
                        "externalUrl": "https://example.org/source",
                    },
                    widgets={
                        "main": [
                            widget(
                                f"{slug}-content",
                                "easy_widgets.ContentWidget",
                                {"content": f"<h2>{title} body</h2><p>Structured object widget {index + 1}.</p>"},
                            )
                        ]
                    },
                    created_by=user,
                    change_description="Publisher supertest fixture v2",
                    effective_date=now - timedelta(seconds=index),
                    expiry_date=None,
                    is_featured=index == 1,
                )
            instance.current_version = version
            instance.version = version.version_number
            instance.save(update_fields=["current_version", "version"])
            objects.append(instance)
        return object_type, objects

    def _media_collection(self, namespace, tenant, user):
        collection, _ = MediaCollection.objects.update_or_create(
            namespace=namespace,
            slug="publisher-supertest-slides",
            defaults={
                "title": "Publisher supertest slides",
                "description": "Three deterministic carousel slides",
                "access_level": "public",
                "created_by": user,
                "last_modified_by": user,
            },
        )
        for index, color in enumerate(("0e7490", "f59e0b", "7c3aed"), start=1):
            url = (
                "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='450'%3E"
                f"%3Crect width='800' height='450' fill='%23{color}'/%3E%3C/svg%3E"
            )
            media, _ = MediaFile.objects.update_or_create(
                file_hash=hashlib.sha256(f"publisher-supertest-{index}".encode()).hexdigest(),
                defaults={
                    "title": f"Supertest slide {index}",
                    "slug": f"publisher-supertest-slide-{index}",
                    "description": f"Caption for slide {index}",
                    "original_filename": f"supertest-slide-{index}.svg",
                    "file_path": f"publisher-supertest/slide-{index}.svg",
                    "file_url": url,
                    "file_size": len(url),
                    "content_type": "image/svg+xml",
                    "file_type": "image",
                    "width": 800,
                    "height": 450,
                    "namespace": namespace,
                    "tenant": tenant,
                    "uploaded_by": user,
                    "created_by": user,
                    "last_modified_by": user,
                    "access_level": "public",
                },
            )
            media.collections.add(collection)
        return collection

    def _image_styles(self):
        style = dict(PageTheme.get_default_carousel_styles()["carousel-with-indicators"])
        style.update(
            {
                "styleType": "carousel",
                "defaultShowCaptions": True,
                "defaultAutoPlay": False,
                "imgproxy_config": {},
            }
        )
        return {"publisher-supertest-carousel": style}

    def _feature_widgets(self, collection):
        return {
            "hero": [
                widget(
                    "supertest-hero",
                    "easy_widgets.HeroWidget",
                    {
                        "beforeText": "Django ↔ Next",
                        "header": "Special-function supertest",
                        "afterText": "Carousel, nested layouts, table and form interactions.",
                        "backgroundColor": "#164e63",
                        "textColor": "#ffffff",
                    },
                )
            ],
            "main": [
                widget(
                    "supertest-heading", "easy_widgets.HeadlineWidget", {"content": "Carousel", "headerLevel": "h1"}
                ),
                widget(
                    "supertest-carousel",
                    "easy_widgets.ImageWidget",
                    {
                        "image": {"id": str(collection.id), "type": "collection"},
                        "imageStyle": "publisher-supertest-carousel",
                        "showCaptions": True,
                        "autoPlay": False,
                    },
                ),
                widget(
                    "supertest-section",
                    "easy_widgets.SectionWidget",
                    {
                        "enableCollapse": True,
                        "startExpanded": True,
                        "expandText": "Expand nested content",
                        "contractText": "Collapse nested content",
                        "slots": {
                            "content": [
                                widget(
                                    "nested-heading",
                                    "easy_widgets.HeadlineWidget",
                                    {"content": "Nested section", "headerLevel": "h2"},
                                ),
                                widget(
                                    "nested-content",
                                    "easy_widgets.ContentWidget",
                                    {"content": "<p>Nested content is visible.</p>"},
                                ),
                            ]
                        },
                    },
                ),
                widget(
                    "supertest-columns",
                    "easy_widgets.TwoColumnsWidget",
                    {
                        "slots": {
                            "left": [
                                widget("column-left", "easy_widgets.ContentWidget", {"content": "<p>Left column</p>"})
                            ],
                            "right": [
                                widget("column-right", "easy_widgets.ContentWidget", {"content": "<p>Right column</p>"})
                            ],
                        }
                    },
                ),
                widget(
                    "supertest-table",
                    "easy_widgets.TableWidget",
                    {
                        "caption": "Renderer comparison values",
                        "showBorders": True,
                        "stripedRows": True,
                        "rows": [
                            {"isHeader": True, "cells": [{"content": "Renderer"}, {"content": "Expected"}]},
                            {"cells": [{"content": "Django"}, {"content": "Visible"}]},
                            {"cells": [{"content": "Next"}, {"content": "Visible"}]},
                        ],
                    },
                ),
                widget(
                    "supertest-form",
                    "easy_widgets.FormsWidget",
                    {
                        "title": "Interaction test",
                        "fields": [
                            {"name": "name", "label": "Name", "type": "text", "required": True},
                            {"name": "message", "label": "Message", "type": "textarea"},
                            {"name": "topic", "label": "Topic", "type": "select", "options": ["Parity", "Objects"]},
                        ],
                        "submitButtonText": "Submit test",
                    },
                ),
            ],
        }
