"""Import processing view."""

import logging
from datetime import datetime
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated

from content.models import Namespace
from ..models import ImportLog
from ..serializers import ProcessImportSerializer
from ..services.content_parser import ContentParser
from ..services.media_downloader import MediaDownloader
from ..services.widget_creator import WidgetCreator
from ..utils.content_analyzer import identify_content_types


logger = logging.getLogger(__name__)


class ProcessImportView(APIView):
    """Process imported content and create widgets."""

    permission_classes = [IsAuthenticated]

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

            # Parse content into segments
            parser = ContentParser()
            segments = parser.parse(html)

            # Download and import media files
            media_downloader = MediaDownloader(request.user, namespace)
            downloaded_media = []
            url_mapping = {}
            errors = []

            for segment in segments:
                if segment.type == "image":
                    image_data = segment.content
                    media_file = media_downloader.download_image(
                        image_data, base_url=source_url
                    )
                    if media_file:
                        downloaded_media.append(
                            {
                                "id": str(media_file.id),
                                "title": media_file.title,
                                "type": "image",
                                "url": media_file.file_url,
                            }
                        )
                        url_mapping[image_data.get("src", "")] = media_file.file_url
                    else:
                        errors.append(
                            f"Failed to download image: {image_data.get('src', '')}"
                        )

                elif segment.type == "file":
                    file_data = segment.content
                    media_file = media_downloader.download_file(
                        file_data, base_url=source_url
                    )
                    if media_file:
                        downloaded_media.append(
                            {
                                "id": str(media_file.id),
                                "title": media_file.title,
                                "type": "file",
                                "url": media_file.file_url,
                            }
                        )
                        url_mapping[file_data.get("url", "")] = media_file.file_url
                    else:
                        errors.append(
                            f"Failed to download file: {file_data.get('url', '')}"
                        )

            # Create widgets from segments
            widget_creator = WidgetCreator()
            widgets = widget_creator.create_widgets(segments, url_mapping)

            # Update import log
            import_log.status = "completed" if not errors else "partial"
            import_log.widgets_created = len(widgets)
            import_log.media_files_imported = len(downloaded_media)
            import_log.errors = errors
            import_log.completed_at = datetime.now()
            import_log.save()

            logger.info(
                f"Import completed: {len(widgets)} widgets, {len(downloaded_media)} media files"
            )

            return Response(
                {
                    "widgets": widgets,
                    "media_files": downloaded_media,
                    "errors": errors,
                    "stats": content_stats,
                    "import_log_id": str(import_log.id),
                    "url_mapping": url_mapping,
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

    def _get_client_ip(self, request):
        """Get client IP address from request."""
        x_forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
        if x_forwarded_for:
            ip = x_forwarded_for.split(",")[0]
        else:
            ip = request.META.get("REMOTE_ADDR")
        return ip
