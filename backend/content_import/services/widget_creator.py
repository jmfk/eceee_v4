"""Widget creator service for generating widgets from content segments."""

import logging
import uuid
from typing import List, Dict, Any
from bs4 import BeautifulSoup

from .content_parser import ContentSegment


logger = logging.getLogger(__name__)


class WidgetCreator:
    """Create widgets from parsed content segments."""
    
    def __init__(self):
        """Initialize widget creator."""
        pass
    
    def create_widgets(
        self,
        segments: List[ContentSegment],
        url_mapping: Dict[str, str] = None
    ) -> List[Dict[str, Any]]:
        """
        Create widgets from content segments.
        
        Args:
            segments: List of ContentSegment objects
            url_mapping: Mapping of original URLs to media manager URLs
        
        Returns:
            List of widget configurations
        """
        widgets = []
        url_mapping = url_mapping or {}
        
        for segment in segments:
            widget = None
            
            if segment.type == 'content':
                widget = self._create_content_widget(segment, url_mapping)
            elif segment.type == 'table':
                widget = self._create_table_widget(segment)
            elif segment.type == 'image':
                # Images are handled inline in content widgets
                # But if they appear standalone, create a content widget with the image
                widget = self._create_image_content_widget(segment, url_mapping)
            elif segment.type == 'file':
                # File links are handled inline in content widgets
                # But if standalone, create a content widget with the link
                widget = self._create_file_content_widget(segment, url_mapping)
            
            if widget:
                widgets.append(widget)
        
        logger.info(f"Created {len(widgets)} widgets from {len(segments)} segments")
        
        return widgets
    
    def _create_content_widget(
        self,
        segment: ContentSegment,
        url_mapping: Dict[str, str]
    ) -> Dict[str, Any]:
        """
        Create a content widget from HTML content.
        
        Args:
            segment: ContentSegment with HTML content
            url_mapping: URL mapping for media files
        
        Returns:
            Widget configuration
        """
        content = segment.content
        
        # Replace image URLs with media manager URLs
        if url_mapping:
            content = self._replace_urls(content, url_mapping)
        
        return {
            'id': f"widget-{uuid.uuid4()}",
            'type': 'default_widgets.ContentWidget',
            'name': 'Imported Content',
            'config': {
                'content': content,
            }
        }
    
    def _create_table_widget(self, segment: ContentSegment) -> Dict[str, Any]:
        """
        Create a table widget.
        
        Args:
            segment: ContentSegment with table HTML
        
        Returns:
            Widget configuration
        """
        return {
            'id': f"widget-{uuid.uuid4()}",
            'type': 'default_widgets.TableWidget',
            'name': 'Imported Table',
            'config': {
                'tableHtml': segment.content,
                'responsive': True,
                'striped': False,
                'bordered': True,
            }
        }
    
    def _create_image_content_widget(
        self,
        segment: ContentSegment,
        url_mapping: Dict[str, str]
    ) -> Dict[str, Any]:
        """
        Create a content widget with an image.
        
        Args:
            segment: ContentSegment with image data
            url_mapping: URL mapping for media files
        
        Returns:
            Widget configuration
        """
        image_data = segment.content
        original_src = image_data.get('src', '')
        
        # Get mapped URL if available
        src = url_mapping.get(original_src, original_src)
        alt = image_data.get('alt', '')
        
        # Create simple image HTML
        img_html = f'<img src="{src}" alt="{alt}" />'
        
        return {
            'id': f"widget-{uuid.uuid4()}",
            'type': 'default_widgets.ContentWidget',
            'name': 'Imported Image',
            'config': {
                'content': img_html,
            }
        }
    
    def _create_file_content_widget(
        self,
        segment: ContentSegment,
        url_mapping: Dict[str, str]
    ) -> Dict[str, Any]:
        """
        Create a content widget with a file link.
        
        Args:
            segment: ContentSegment with file data
            url_mapping: URL mapping for file URLs
        
        Returns:
            Widget configuration
        """
        file_data = segment.content
        original_url = file_data.get('url', '')
        text = file_data.get('text', 'Download File')
        
        # Get mapped URL if available
        url = url_mapping.get(original_url, original_url)
        
        # Create link HTML
        link_html = f'<p><a href="{url}" target="_blank">{text}</a></p>'
        
        return {
            'id': f"widget-{uuid.uuid4()}",
            'type': 'default_widgets.ContentWidget',
            'name': 'Imported File Link',
            'config': {
                'content': link_html,
            }
        }
    
    def _replace_urls(self, html: str, url_mapping: Dict[str, str]) -> str:
        """
        Replace URLs in HTML with mapped URLs.
        
        Args:
            html: HTML content
            url_mapping: URL mapping dictionary
        
        Returns:
            HTML with replaced URLs
        """
        if not url_mapping:
            return html
        
        soup = BeautifulSoup(html, 'html.parser')
        
        # Replace image sources
        for img in soup.find_all('img'):
            src = img.get('src', '')
            if src in url_mapping:
                img['src'] = url_mapping[src]
        
        # Replace link hrefs
        for link in soup.find_all('a', href=True):
            href = link['href']
            if href in url_mapping:
                link['href'] = url_mapping[href]
        
        return str(soup)

