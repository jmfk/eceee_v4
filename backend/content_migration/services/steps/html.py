from .base import BaseStep
from typing import Any, Dict, Optional
from bs4 import BeautifulSoup
from content_import.services.media_downloader import MediaDownloader
from urllib.parse import urljoin

class ProcessHTMLStep(BaseStep):
    """
    Processes HTML content, downloads media, and rewrites URLs.
    config: {
        "html_var": "content",
        "base_url": "https://source-site.com",
        "download_media": True,
        "tags": ["imported"]
    }
    """
    def execute(self, context: Dict[str, Any], config: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        variables = context.get("variables", {})
        job = context.get("job")
        
        html_var = config.get("html_var", "content")
        html_content = variables.get(html_var)
        if not html_content:
            return context
            
        soup = BeautifulSoup(html_content, "html.parser")
        base_url = config.get("base_url", "")
        
        if config.get("download_media", True):
            namespace = job.plan.target_object_type.get_effective_namespace()
            downloader = MediaDownloader(
                user=job.created_by or job.plan.created_by,
                namespace=namespace,
                page_metadata={"tags": config.get("tags", [])}
            )
            
            # Find and process images
            for img in soup.find_all("img"):
                src = img.get("src")
                if not src: continue
                
                # Resolve relative URLs
                full_url = urljoin(base_url, src)
                
                try:
                    media_file = downloader.download_image({
                        "src": full_url,
                        "alt": img.get("alt", ""),
                        "title": img.get("title", ""),
                        "use_provided_tags": True
                    })
                    if media_file:
                        img["src"] = media_file.file_url
                except Exception:
                    pass # Keep original if download fails
                    
            # Find and process links to files (PDF, etc.)
            for a in soup.find_all("a"):
                href = a.get("href")
                if not href: continue
                
                if any(href.lower().endswith(ext) for ext in [".pdf", ".doc", ".docx", ".xls", ".xlsx", ".zip"]):
                    full_url = urljoin(base_url, href)
                    try:
                        media_file = downloader.download_file({
                            "url": full_url,
                            "text": a.get_text(),
                        })
                        if media_file:
                            a["href"] = media_file.file_url
                    except Exception:
                        pass
                        
        variables[html_var] = str(soup)
        context["variables"] = variables
        return context

