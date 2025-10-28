"""Import processing view."""

import logging
from datetime import datetime
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from bs4 import BeautifulSoup

from content.models import Namespace, Tag
from webpages.models import WebPage, PageVersion
from ..models import ImportLog
from ..serializers import ProcessImportSerializer
from ..services.content_parser import ContentParser
from ..services.media_downloader import MediaDownloader
from ..services.widget_creator import WidgetCreator
from ..services.content_analyzer import ContentAnalyzer
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
        Process imported HTML content and create widgets.

        POST /api/content-import/process/
        {
            "html": "<div>...</div>",
            "slot_name": "main_content",
            "page_id": 123,
            "mode": "append",
            "namespace": "default",
            "source_url": "https://example.com"
        }

        Returns:
            {
                "widgets": [...],
                "media_files": [...],
                "errors": [...],
                "stats": {
                    "content_blocks": 3,
                    "tables": 1,
                    "images": 2,
                    "files": 1
                },
                "import_log_id": "..."
            }
        """
        serializer = ProcessImportSerializer(data=request.data)

        if not serializer.is_valid():
            return Response(
                {"errors": serializer.errors}, status=status.HTTP_400_BAD_REQUEST
            )

        validated_data = serializer.validated_data
        html = validated_data["html"]
        slot_name = validated_data["slot_name"]
        page_id = validated_data["page_id"]
        mode = validated_data["mode"]
        namespace_slug = validated_data["namespace"]
        source_url = validated_data.get("source_url", "")
        import_id = validated_data.get("import_id", "")
        uploaded_media_urls = validated_data.get("uploaded_media_urls", {})
        page_metadata = validated_data.get("page_metadata", {})

        # Get namespace
        try:
            if namespace_slug == "default":
                namespace = Namespace.get_default()
            else:
                namespace = Namespace.objects.get(slug=namespace_slug)
        except Namespace.DoesNotExist:
            return Response(
                {"error": "Invalid namespace"}, status=status.HTTP_400_BAD_REQUEST
            )

        # Create import log
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
            # Analyze content first
            content_stats = identify_content_types(html)
            import_log.stats = content_stats
            import_log.save()

            logger.info(f"Processing import: {content_stats}")

            # Use client import_id for WebSocket if provided, otherwise use log ID
            ws_id = import_id or str(import_log.id)
            self._send_progress(ws_id, "Analyzing content...", 10)

            # STEP 1: Scan HTML for images BEFORE parsing
            soup = BeautifulSoup(html, "html.parser")
            all_images = soup.find_all("img")
            all_file_links = []  # We'll handle file links later in the flow

            logger.info(f"Found {len(all_images)} images to process")

            # Use pre-uploaded media URLs if provided, otherwise download
            if uploaded_media_urls:
                # Media already uploaded - just use the mapping
                url_mapping = uploaded_media_urls
                downloaded_media = []
                errors = []
                logger.info(
                    f"Using {len(uploaded_media_urls)} pre-uploaded media files"
                )
            else:
                # STEP 2: Download images and build url_mapping
                logger.info("=" * 80)
                logger.info("📊 PAGE METADATA FOR IMAGE CONTEXT")
                logger.info("=" * 80)
                logger.info(f"  Title: {page_metadata.get('title', 'Not provided')}")
                logger.info(f"  Tags: {page_metadata.get('tags', [])}")
                logger.info(f"  Save to Page: {page_metadata.get('saveToPage', False)}")
                logger.info("=" * 80)

                media_downloader = MediaDownloader(
                    request.user, namespace, page_metadata
                )
                downloaded_media = []
                url_mapping = {}
                errors = []
                processed_media = 0
                total_media = len(all_images)

                logger.info(
                    f"🖼️  Processing {total_media} images with page context: {page_metadata.get('tags', [])}"
                )

                for img in all_images:
                    src = img.get("src", "")
                    if not src:
                        continue

                    # Track the original src from HTML (might be proxy URL)
                    original_html_src = src
                    logger.info(
                        f"📸 Image #{processed_media + 1} - Original src from HTML: {src[:120]}"
                    )

                    processed_media += 1
                    percent = (
                        20 + int((processed_media / total_media) * 50)
                        if total_media > 0
                        else 40
                    )
                    alt_text = img.get("alt", "Image")[:50]

                    # Build image_data dict similar to what _extract_image used to create
                    image_data = {
                        "src": src,
                        "alt": img.get("alt", ""),
                        "title": img.get("title", ""),
                        "context": "",
                        "html": str(img),
                        "parent_html": "",
                        "parent_classes": "",
                    }

                    # Get parent context for AI analysis
                    if img.parent:
                        image_data["context"] = img.parent.get_text(
                            separator=" ", strip=True
                        )[:200]
                        image_data["parent_html"] = str(img.parent)[:500]
                        image_data["parent_classes"] = " ".join(
                            img.parent.get("class", [])
                        )

                        # Also check grandparent for wrapper divs
                        if img.parent.parent:
                            grandparent_classes = " ".join(
                                img.parent.parent.get("class", [])
                            )
                            image_data["parent_classes"] = (
                                f"{image_data['parent_classes']} {grandparent_classes}".strip()
                            )

                    # Send detailed media item status - uploading
                    if channel_layer:
                        async_to_sync(channel_layer.group_send)(
                            f"import_{ws_id}",
                            {
                                "type": "import_progress",
                                "message": f"Processing image {processed_media}/{total_media}",
                                "percent": percent,
                                "current": processed_media,
                                "total": total_media,
                                "item": alt_text,
                                "mediaItem": {
                                    "id": original_html_src,
                                    "filename": alt_text,
                                    "type": "image",
                                    "status": "uploading",
                                },
                            },
                        )

                    media_file = media_downloader.download_image(
                        image_data, base_url=source_url
                    )

                    if media_file:
                        # Get layout config and metadata
                        layout_config = getattr(
                            media_file, "_import_layout_config", None
                        )
                        tags = [tag.name for tag in media_file.tags.all()[:5]]

                        downloaded_media.append(
                            {
                                "id": str(media_file.id),
                                "title": media_file.title,
                                "type": "image",
                                "url": media_file.file_url,
                                "layout": layout_config,
                                "originalSrc": original_html_src,  # Use src from HTML for tracking
                                "tags": tags,
                                "description": media_file.description,
                            }
                        )

                        # Create configured image HTML with WYSIWYG format
                        configured_html = self._create_image_html(
                            media_file.file_url,
                            image_data.get("alt", ""),
                            layout_config,
                            media_id=str(media_file.id),
                        )

                        # Use the EXACT src from HTML as key (might be proxy URL)
                        url_mapping[original_html_src] = configured_html

                        logger.info(f"🗺️  URL Mapping added:")
                        logger.info(f"   Key (HTML src): {original_html_src[:100]}")
                        logger.info(f"   Downloaded from: {src[:100]}")
                        logger.info(
                            f"   Value: <media-insert> with {len(configured_html)} chars"
                        )

                        # Send success status
                        if channel_layer:
                            # Check if this was a reused file
                            was_reused = media_file.created_at < import_log.created_at
                            async_to_sync(channel_layer.group_send)(
                                f"import_{ws_id}",
                                {
                                    "type": "import_progress",
                                    "message": f"Uploaded image {processed_media}/{total_media}",
                                    "percent": percent,
                                    "mediaItem": {
                                        "id": original_html_src,
                                        "title": media_file.title,
                                        "filename": media_file.original_filename,
                                        "type": "image",
                                        "status": "reused" if was_reused else "success",
                                        "tags": tags,
                                        "description": media_file.description,
                                    },
                                },
                            )
                    else:
                        error_msg = f"Failed to download image: {original_html_src}"
                        errors.append(error_msg)

                        # Send error status
                        if channel_layer:
                            async_to_sync(channel_layer.group_send)(
                                f"import_{ws_id}",
                                {
                                    "type": "import_progress",
                                    "message": f"Error uploading image",
                                    "mediaItem": {
                                        "id": original_html_src,
                                        "filename": alt_text,
                                        "type": "image",
                                        "status": "error",
                                        "error": error_msg,
                                    },
                                },
                            )

            # STEP 3: Now parse content into segments (with images still inline)
            self._send_progress(ws_id, "Parsing content...", 70)
            parser = ContentParser()
            segments = parser.parse(html)

            self._send_progress(ws_id, "Parsed content segments", 72)

            # Handle any remaining file segments from parsing
            file_segments = [s for s in segments if s.type == "file"]

            if file_segments and not uploaded_media_urls:
                # Download file links
                for segment in file_segments:
                    file_data = segment.content
                    processed_media += 1
                    percent = (
                        20 + int((processed_media / total_media) * 50)
                        if total_media > 0
                        else 40
                    )
                    file_text = file_data.get("text", "File")[:50]

                    # Send detailed media item status - uploading
                    if channel_layer:
                        async_to_sync(channel_layer.group_send)(
                            f"import_{ws_id}",
                            {
                                "type": "import_progress",
                                "message": f"Processing file {processed_media}/{total_media}",
                                "percent": percent,
                                "current": processed_media,
                                "total": total_media,
                                "item": file_text,
                                "mediaItem": {
                                    "id": file_data.get("url", ""),
                                    "filename": file_text,
                                    "type": "file",
                                    "status": "uploading",
                                },
                            },
                        )

                    media_file = media_downloader.download_file(
                        file_data, base_url=source_url
                    )

                    if media_file:
                        tags = [tag.name for tag in media_file.tags.all()[:5]]

                        downloaded_media.append(
                            {
                                "id": str(media_file.id),
                                "title": media_file.title,
                                "type": "file",
                                "url": media_file.file_url,
                                "originalUrl": file_data.get("url", ""),
                                "tags": tags,
                                "description": media_file.description,
                            }
                        )
                        url_mapping[file_data.get("url", "")] = media_file.file_url

                        # Send success status
                        if channel_layer:
                            was_reused = media_file.created_at < import_log.created_at
                            async_to_sync(channel_layer.group_send)(
                                f"import_{ws_id}",
                                {
                                    "type": "import_progress",
                                    "message": f"Uploaded file {processed_media}/{total_media}",
                                    "percent": percent,
                                    "mediaItem": {
                                        "id": file_data.get("url", ""),
                                        "title": media_file.title,
                                        "filename": media_file.original_filename,
                                        "type": "file",
                                        "status": "reused" if was_reused else "success",
                                        "tags": tags,
                                        "description": media_file.description,
                                    },
                                },
                            )
                    else:
                        error_msg = (
                            f"Failed to download file: {file_data.get('url', '')}"
                        )
                        errors.append(error_msg)

                        # Send error status
                        if channel_layer:
                            async_to_sync(channel_layer.group_send)(
                                f"import_{ws_id}",
                                {
                                    "type": "import_progress",
                                    "message": f"Error uploading file",
                                    "mediaItem": {
                                        "id": file_data.get("url", ""),
                                        "filename": file_text,
                                        "type": "file",
                                        "status": "error",
                                        "error": error_msg,
                                    },
                                },
                            )

            # Create widgets from segments
            self._send_progress(ws_id, "Creating widgets...", 75)
            logger.info(
                f"🔧 Creating widgets from {len(segments)} segments with {len(url_mapping)} URL mappings"
            )
            widget_creator = WidgetCreator()
            widgets = widget_creator.create_widgets(segments, url_mapping)
            logger.info(f"✅ Created {len(widgets)} widgets")

            # Update page with confirmed metadata (if enabled and provided)
            save_to_page = (
                page_metadata.get("saveToPage", False) if page_metadata else False
            )
            page_was_updated = False

            if (
                save_to_page
                and page_metadata
                and (page_metadata.get("title") or page_metadata.get("tags"))
            ):
                try:
                    page = WebPage.objects.get(id=page_id)

                    # Get latest PageVersion to store title and tags
                    page_version = page.get_latest_version()

                    if not page_version:
                        logger.warning(
                            f"⚠️  No PageVersion found for page #{page_id}, cannot save metadata"
                        )
                    else:
                        # Update version title if provided
                        title = page_metadata.get("title", "").strip()
                        if title:
                            page_version.version_title = title
                            page.title = (
                                title  # Also update WebPage title for consistency
                            )
                            logger.info(f"✅ Updated page version title to: {title}")

                        # Update tags if provided (PageVersion uses ArrayField, not ManyToMany)
                        tag_names = page_metadata.get("tags", [])
                        if tag_names:
                            # Set tags as array of strings on PageVersion
                            page_version.tags = tag_names
                            logger.info(
                                f"✅ Set {len(tag_names)} tags on page version: {tag_names}"
                            )

                            # Also create/increment usage for content.Tag objects for consistency
                            for tag_name in tag_names:
                                tag, created = Tag.get_or_create_tag(
                                    name=tag_name, namespace=namespace
                                )
                                if created:
                                    logger.info(
                                        f"   Created new content tag: {tag_name}"
                                    )
                                else:
                                    tag.increment_usage()
                                    logger.info(
                                        f"   Incremented usage for tag: {tag_name}"
                                    )

                        page_version.save()
                        page.save()
                        page_was_updated = True
                        logger.info(
                            f"✅ Updated page #{page_id} version with metadata: title={title}, tags={len(tag_names)}"
                        )
                except WebPage.DoesNotExist:
                    logger.warning(
                        f"⚠️  Page #{page_id} not found, could not update metadata"
                    )
                except Exception as e:
                    logger.error(
                        f"❌ Failed to update page metadata: {e}", exc_info=True
                    )
            elif page_metadata:
                logger.info(
                    f"ℹ️  Page metadata NOT saved to database (saveToPage={save_to_page}). Metadata used for image context only."
                )

            # Update import log
            self._send_progress(ws_id, "Finalizing import...", 90)
            import_log.status = "completed" if not errors else "partial"
            import_log.widgets_created = len(widgets)
            import_log.media_files_imported = len(downloaded_media)
            import_log.errors = errors
            import_log.completed_at = datetime.now()
            import_log.save()

            logger.info(
                f"Import completed: {len(widgets)} widgets, {len(downloaded_media)} media files"
            )

            # Log widget content for debugging
            for i, widget in enumerate(widgets[:2], 1):  # First 2 widgets
                content = widget.get("config", {}).get("content", "")
                logger.info(f"📦 Widget #{i} content preview: {content[:200]}...")
                # Check if it has media-insert divs
                if "media-insert" in content:
                    logger.info(f"   ✅ Contains media-insert div")
                elif "<img" in content:
                    logger.warning(
                        f"   ⚠️  Still contains <img> tags - replacement may have failed!"
                    )

            return Response(
                {
                    "widgets": widgets,
                    "media_files": downloaded_media,
                    "errors": errors,
                    "stats": content_stats,
                    "import_log_id": str(import_log.id),
                    "url_mapping": url_mapping,
                    "page_was_updated": page_was_updated,  # Tell frontend to reload page data
                }
            )

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
