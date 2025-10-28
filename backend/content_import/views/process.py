"""Import processing view."""

import logging
from datetime import datetime
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated

from content.models import Namespace, Tag
from webpages.models import WebPage
from ..models import ImportLog
from ..serializers import ProcessImportSerializer
from ..services.content_parser import ContentParser
from ..services.content_analyzer import ContentAnalyzer
from ..services.widget_creator import WidgetCreator
from ..utils.content_analyzer import identify_content_types


logger = logging.getLogger(__name__)
channel_layer = get_channel_layer()


class ProcessImportView(APIView):
    """Process imported content and create widgets."""

    permission_classes = [IsAuthenticated]

    def _send_progress(
        self,
        import_id: str,
        message: str,
        percent: int = 0,
        current: int = 0,
        total: int = 0,
        item: str = "",
    ):
        """Send progress update via WebSocket."""
        if channel_layer:
            try:
                async_to_sync(channel_layer.group_send)(
                    f"import_{import_id}",
                    {
                        "type": "import_progress",
                        "message": message,
                        "percent": percent,
                        "current": current,
                        "total": total,
                        "item": item,
                    },
                )
            except Exception as e:
                logger.warning(f"Failed to send progress update: {e}")

    def post(self, request):
        """
        Process imported HTML content with pre-uploaded media and create widgets.

        POST /api/content-import/process/
        {
            "html": "<div>...</div>",
            "uploaded_media_urls": [{url, media_manager_id, alt, layout}, ...],
            "slot_name": "main_content",
            "page_id": 123,
            "mode": "append",
            "namespace": "default",
            "source_url": "https://example.com",
            "page_metadata": {"title": "", "tags": [], "saveToPage": false}
        }

        Returns:
            {
                "widgets": [...],
                "media_files": [...],
                "stats": {...},
                "import_log_id": "...",
                "page_was_updated": true/false
            }
        """
        # 1. Validate input
        serializer = ProcessImportSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {"errors": serializer.errors}, status=status.HTTP_400_BAD_REQUEST
            )

        validated_data = serializer.validated_data
        html = validated_data["html"]
        uploaded_media = validated_data["uploaded_media_urls"]
        slot_name = validated_data["slot_name"]
        page_id = validated_data["page_id"]
        mode = validated_data["mode"]
        namespace_slug = validated_data["namespace"]
        source_url = validated_data.get("source_url", "")
        import_id = validated_data.get("import_id", "")
        page_metadata = validated_data.get("page_metadata", {})

        # 2. Get namespace
        try:
            if namespace_slug == "default":
                namespace = Namespace.get_default()
            else:
                namespace = Namespace.objects.get(slug=namespace_slug)
        except Namespace.DoesNotExist:
            return Response(
                {"error": "Invalid namespace"}, status=status.HTTP_400_BAD_REQUEST
            )

        # 3. Create import log
        import_log = ImportLog.objects.create(
            source_url=source_url or "Unknown",
            slot_name=slot_name,
            page_id=page_id,
            namespace=namespace,
            mode=mode,
            status="processing",
            created_by=request.user,
            ip_address=self._get_client_ip(request),
            html_content=html,
        )

        try:
            ws_id = import_id or str(import_log.id)
            
            # Analyze content
            content_stats = identify_content_types(html)
            import_log.stats = content_stats
            import_log.save()
            
            self._send_progress(ws_id, "Building media mapping...", 20)

            # 4. Build URL mapping from uploaded_media_urls
            from file_manager.models import MediaFile
            
            url_mapping = {}
            media_files_info = []
            
            logger.info(f"📦 Processing {len(uploaded_media)} pre-uploaded media items")
            
            for item in uploaded_media:
                original_url = item.get("url", "")
                media_id = item.get("media_manager_id", "")
                alt_text = item.get("alt", "")
                layout = item.get("layout", {})

                if not original_url or not media_id:
                    logger.warning(f"⚠️  Skipping invalid media item: {item}")
                    continue

                # Get MediaFile and create proper media-insert HTML
                try:
                    media_file = MediaFile.objects.get(id=media_id)
                    
                    # Use the _create_image_html helper for proper WYSIWYG format
                    media_insert_html = self._create_image_html(
                        media_file.get_file_url(),
                        alt_text,
                        layout,
                        media_id=str(media_id)
                    )
                    
                    url_mapping[original_url] = media_insert_html
                    
                    # Collect media info for response
                    tags = [tag.name for tag in media_file.tags.all()[:5]]
                    media_files_info.append({
                        "id": str(media_file.id),
                        "title": media_file.title,
                        "type": "image",
                        "url": media_file.file_url,
                        "originalSrc": original_url,
                        "tags": tags,
                        "description": media_file.description,
                    })
                    
                    logger.info(f"✓ Mapped {original_url[:80]} -> MediaFile {media_id}")
                    
                except MediaFile.DoesNotExist:
                    logger.warning(f"⚠️  MediaFile {media_id} not found")
                    continue

            logger.info(f"📦 Built URL mapping with {len(url_mapping)} entries")

            # 5. Parse content into segments
            self._send_progress(ws_id, "Parsing content...", 50)
            parser = ContentParser()
            segments = parser.parse(html)
            
            logger.info(f"📄 Parsed {len(segments)} content segments")

            # 6. Create widgets from segments with URL replacements
            self._send_progress(ws_id, "Creating widgets...", 70)
            widget_creator = WidgetCreator()
            widgets = widget_creator.create_widgets(segments, url_mapping)
            
            logger.info(f"🎨 Created {len(widgets)} widgets")

            # 7. Update page metadata (optional)
            page_was_updated = False
            save_to_page = page_metadata.get("saveToPage", False) if page_metadata else False

            if save_to_page and page_metadata and (page_metadata.get("title") or page_metadata.get("tags")):
                try:
                    page = WebPage.objects.get(id=page_id)
                    page_version = page.get_latest_version()

                    if page_version:
                        # Update title if provided
                        title = page_metadata.get("title", "").strip()
                        if title:
                            page_version.version_title = title
                            page.title = title

                        # Update tags if provided
                        tag_names = page_metadata.get("tags", [])
                        if tag_names:
                            page_version.tags = tag_names
                            
                            # Create/update Tag objects for consistency
                            for tag_name in tag_names:
                                tag, created = Tag.get_or_create_tag(
                                    name=tag_name, namespace=namespace
                                )
                                if not created:
                                    tag.increment_usage()

                        page_version.save()
                        page.save()
                        page_was_updated = True
                        logger.info(f"✓ Updated page metadata for page #{page_id}")
                        
                except WebPage.DoesNotExist:
                    logger.warning(f"⚠️  Page #{page_id} not found")
                except Exception as e:
                    logger.error(f"❌ Failed to update page metadata: {e}", exc_info=True)

            # 8. Update import log
            self._send_progress(ws_id, "Finalizing import...", 90)
            import_log.status = "completed"
            import_log.widgets_created = len(widgets)
            import_log.media_files_imported = len(media_files_info)
            import_log.errors = []
            import_log.completed_at = datetime.now()
            import_log.save()

            # 9. Return response
            self._send_progress(ws_id, "Import complete!", 100)
            
            return Response({
                "widgets": widgets,
                "media_files": media_files_info,
                "errors": [],
                "stats": content_stats,
                "import_log_id": str(import_log.id),
                "page_was_updated": page_was_updated,
            })

        except Exception as e:
            logger.error(f"Failed to process import: {e}", exc_info=True)

            # Update import log with error
            import_log.status = "failed"
            import_log.errors = [str(e)]
            import_log.save()

            return Response(
                {"error": str(e), "import_log_id": str(import_log.id)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    def _create_image_html(
        self, image_url: str, alt: str, layout_config: dict = None, media_id: str = None
    ) -> str:
        """
        Create WYSIWYG-compatible inline image HTML.

        Args:
            image_url: URL to the image in media manager
            alt: Alt text
            layout_config: AI-determined layout configuration
            media_id: Media file ID for data-media-id attribute

        Returns:
            HTML string with .media-insert container (WYSIWYG format)
        """
        # Map AI layout config to WYSIWYG settings
        if layout_config:
            alignment = layout_config.get("alignment", "center")
            size = layout_config.get("size", "medium")
            caption = layout_config.get("caption", "")
        else:
            alignment = "center"
            size = "medium"
            caption = ""

        # Map AI alignment to WYSIWYG align values
        align_map = {
            "left": "left",
            "center": "center",
            "right": "right",
            "full-width": "center",
        }
        align = align_map.get(alignment, "center")

        # Map AI size to WYSIWYG width values
        width_map = {
            "small": "small",  # ~400px
            "medium": "medium",  # ~600px
            "large": "large",  # ~900px
            "original": "full",  # 100%
        }
        width = width_map.get(size, "medium")

        # Build WYSIWYG-compatible media insert HTML
        caption_html = f'<div class="media-caption">{caption}</div>' if caption else ""

        media_id_attr = f'data-media-id="{media_id}"' if media_id else ""

        html = f"""<div 
    class="media-insert media-width-{width} media-align-{align}" 
    data-media-insert="true"
    data-media-type="image"
    {media_id_attr}
    data-width="{width}"
    data-align="{align}"
    contenteditable="false"
    draggable="true"
><img src="{image_url}" alt="{alt}" />{caption_html}</div>"""

        return html

    def _get_client_ip(self, request):
        """Get client IP address from request."""
        x_forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
        if x_forwarded_for:
            ip = x_forwarded_for.split(",")[0]
        else:
            ip = request.META.get("REMOTE_ADDR")
        return ip


class AnalyzeHierarchyView(APIView):
    """Analyze HTML elements hierarchy and return content statistics."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        """
        Analyze multiple HTML elements and return statistics for each.

        POST /api/v1/content-import/analyze-hierarchy/
        {
            "elements": [
                {"html": "<div>...</div>", "tag": "div", "classes": "container"},
                {"html": "<section>...</section>", "tag": "section", "classes": "main"}
            ]
        }

        Returns:
            {
                "results": [
                    {
                        "tag": "div",
                        "classes": "container",
                        "text_blocks": 5,
                        "images": 3,
                        "tables": 1,
                        "files": 2,
                        "total_text_length": 1234,
                        "child_containers": 10,
                        "headings": {"h1": 1, "h2": 3},
                        "lists": 2,
                        "summary": "5 text blocks, 3 images, 1 table"
                    }
                ]
            }
        """
        elements = request.data.get("elements", [])

        if not elements:
            return Response(
                {"error": "elements array is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            analyzer = ContentAnalyzer()
            results = []

            for element in elements:
                html = element.get("html", "")
                tag = element.get("tag", "")
                classes = element.get("classes", "")

                # Analyze this element
                stats = analyzer.analyze_container(html)
                stats["tag"] = tag
                stats["classes"] = classes
                stats["summary"] = analyzer.format_stats_summary(stats)

                results.append(stats)

            return Response({"results": results})

        except Exception as e:
            logger.error(f"Failed to analyze hierarchy: {e}", exc_info=True)
            return Response(
                {"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
