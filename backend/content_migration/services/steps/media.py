from .base import BaseStep
from typing import Any, Dict, Optional, List
from content_import.services.media_downloader import MediaDownloader
from file_manager.models import MediaTag

class MediaImportStep(BaseStep):
    """
    Step to import media files (images/files) from URLs.
    config: {
        "url_var": "image_url",
        "title_var": "image_title",
        "alt_var": "image_alt",
        "tags": ["imported", "migration"],
        "target_var": "media_id"
    }
    """
    def execute(self, context: Dict[str, Any], config: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        variables = context.get("variables", {})
        job = context.get("job")
        
        url = variables.get(config.get("url_var"))
        if not url:
            return context
            
        # Initialize media downloader
        # We need a namespace. Let's use the target object type's namespace or default.
        namespace = job.plan.target_object_type.get_effective_namespace()
        
        downloader = MediaDownloader(
            user=job.created_by or job.plan.created_by,
            namespace=namespace,
            page_metadata={
                "title": variables.get(config.get("title_var", "")),
                "tags": config.get("tags", [])
            }
        )
        
        # Decide if it's an image or file based on extension or config
        is_image = any(url.lower().endswith(ext) for ext in [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"])
        
        try:
            if is_image:
                media_file = downloader.download_image({
                    "src": url,
                    "alt": variables.get(config.get("alt_var", "")),
                    "title": variables.get(config.get("title_var", "")),
                    "use_provided_tags": True
                })
            else:
                media_file = downloader.download_file({
                    "url": url,
                    "text": variables.get(config.get("title_var", "")),
                })
                
            if media_file:
                target_var = config.get("target_var", "media_id")
                variables[target_var] = str(media_file.id)
                # Also store the URL in case we need to rewrite HTML
                variables[f"{target_var}_url"] = media_file.file_url
        except Exception as e:
            # We don't necessarily want to fail the whole task if media import fails
            # but we should log it
            import logging
            logger = logging.getLogger(__name__)
            logger.warning(f"Failed to import media from {url}: {e}")
            
        context["variables"] = variables
        return context

