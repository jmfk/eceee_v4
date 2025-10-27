"""Proxy service for fetching and rewriting external web pages."""

import re
import logging
import requests
from typing import Dict, Any
from urllib.parse import urljoin, urlparse, urlunparse
from bs4 import BeautifulSoup
from django.urls import reverse


logger = logging.getLogger(__name__)


class ProxyService:
    """Service for proxying external web pages with URL rewriting."""
    
    def __init__(self, base_proxy_url: str = "/api/v1/content-import/proxy-asset/"):
        """
        Initialize proxy service.
        
        Args:
            base_proxy_url: Base URL for proxied assets
        """
        self.base_proxy_url = base_proxy_url
    
    def fetch_and_rewrite(self, url: str) -> Dict[str, Any]:
        """
        Fetch external page and rewrite all URLs to proxy through our backend.
        
        Args:
            url: The external URL to fetch
        
        Returns:
            Dictionary with:
                - html: Rewritten HTML
                - base_url: Original page URL
                - content_type: Content type
        
        Raises:
            Exception: If fetching fails
        """
        try:
            # Fetch the page
            response = requests.get(
                url,
                timeout=30,
                headers={
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            )
            response.raise_for_status()
            
            html = response.text
            content_type = response.headers.get('content-type', 'text/html')
            
            # Parse HTML
            soup = BeautifulSoup(html, 'html.parser')
            
            # Rewrite URLs
            self._rewrite_urls(soup, url)
            
            # Add click capture script
            self._inject_click_capture_script(soup)
            
            rewritten_html = str(soup)
            
            logger.info(f"Successfully fetched and rewrote {url}")
            
            return {
                'html': rewritten_html,
                'base_url': url,
                'content_type': content_type,
            }
            
        except Exception as e:
            logger.error(f"Failed to fetch and rewrite {url}: {e}")
            raise Exception(f"Proxy fetch failed: {str(e)}")
    
    def _rewrite_urls(self, soup: BeautifulSoup, base_url: str):
        """
        Rewrite all URLs in HTML to proxy through our backend.
        
        Args:
            soup: BeautifulSoup object
            base_url: Original page URL for resolving relative URLs
        """
        # Rewrite image sources
        for img in soup.find_all('img'):
            if img.get('src'):
                absolute_url = urljoin(base_url, img['src'])
                img['src'] = self._create_proxy_url(absolute_url)
            
            if img.get('srcset'):
                # Rewrite srcset URLs
                srcset_parts = []
                for part in img['srcset'].split(','):
                    part = part.strip()
                    if ' ' in part:
                        url_part, descriptor = part.rsplit(' ', 1)
                        absolute_url = urljoin(base_url, url_part)
                        srcset_parts.append(f"{self._create_proxy_url(absolute_url)} {descriptor}")
                    else:
                        absolute_url = urljoin(base_url, part)
                        srcset_parts.append(self._create_proxy_url(absolute_url))
                img['srcset'] = ', '.join(srcset_parts)
        
        # Rewrite link hrefs (CSS)
        for link in soup.find_all('link', href=True):
            absolute_url = urljoin(base_url, link['href'])
            link['href'] = self._create_proxy_url(absolute_url)
        
        # Rewrite script sources
        for script in soup.find_all('script', src=True):
            absolute_url = urljoin(base_url, script['src'])
            script['src'] = self._create_proxy_url(absolute_url)
        
        # Rewrite anchor hrefs - make them non-functional to prevent navigation
        for a in soup.find_all('a', href=True):
            a['href'] = 'javascript:void(0)'
            a['data-original-href'] = urljoin(base_url, a.get('href', ''))
        
        # Rewrite CSS url() references in style tags
        for style in soup.find_all('style'):
            if style.string:
                style.string = self._rewrite_css_urls(style.string, base_url)
        
        # Rewrite inline style attributes
        for tag in soup.find_all(style=True):
            tag['style'] = self._rewrite_css_urls(tag['style'], base_url)
    
    def _rewrite_css_urls(self, css: str, base_url: str) -> str:
        """
        Rewrite url() references in CSS.
        
        Args:
            css: CSS content
            base_url: Base URL for resolving relative URLs
        
        Returns:
            CSS with rewritten URLs
        """
        def replace_url(match):
            url = match.group(1).strip('\'"')
            absolute_url = urljoin(base_url, url)
            proxy_url = self._create_proxy_url(absolute_url)
            return f"url('{proxy_url}')"
        
        return re.sub(r'url\(["\']?([^)"\']+)["\']?\)', replace_url, css)
    
    def _create_proxy_url(self, url: str) -> str:
        """
        Create a proxied URL.
        
        Args:
            url: Original URL
        
        Returns:
            Proxied URL path
        """
        # For now, return a data-uri encoded version
        # In production, this would proxy through our backend
        from urllib.parse import quote
        return f"{self.base_proxy_url}?url={quote(url)}"
    
    def _inject_click_capture_script(self, soup: BeautifulSoup):
        """
        Inject JavaScript to capture clicks and communicate with parent window.
        
        Args:
            soup: BeautifulSoup object
        """
        script = soup.new_tag('script')
        script.string = """
        (function() {
            // Prevent default navigation
            document.addEventListener('click', function(e) {
                e.preventDefault();
                
                // Get the clicked element
                const element = e.target;
                
                // Find nearest block-level element
                let blockElement = element;
                const blockTags = ['article', 'section', 'div', 'main', 'aside', 'header', 'footer'];
                
                while (blockElement && !blockTags.includes(blockElement.tagName.toLowerCase())) {
                    blockElement = blockElement.parentElement;
                }
                
                if (blockElement) {
                    // Send element data to parent window
                    window.parent.postMessage({
                        type: 'CONTENT_SELECTED',
                        data: {
                            html: blockElement.outerHTML,
                            innerHtml: blockElement.innerHTML,
                            tagName: blockElement.tagName.toLowerCase(),
                            textContent: blockElement.textContent,
                            className: blockElement.className,
                            id: blockElement.id
                        }
                    }, '*');
                }
            }, true);
            
            // Add hover highlighting
            let currentHighlight = null;
            document.addEventListener('mouseover', function(e) {
                const element = e.target;
                
                // Remove previous highlight
                if (currentHighlight) {
                    currentHighlight.style.outline = '';
                }
                
                // Add highlight to hovered element
                element.style.outline = '2px solid rgba(59, 130, 246, 0.6)';
                element.style.outlineOffset = '2px';
                currentHighlight = element;
            }, true);
        })();
        """
        
        # Append script to body
        if soup.body:
            soup.body.append(script)
        else:
            # If no body, add to head
            if not soup.head:
                soup.insert(0, soup.new_tag('head'))
            soup.head.append(script)
    
    def fetch_asset(self, url: str) -> bytes:
        """
        Fetch an asset (image, CSS, JS, etc.) from external URL.
        
        Args:
            url: The asset URL
        
        Returns:
            Asset bytes
        
        Raises:
            Exception: If fetching fails
        """
        try:
            response = requests.get(url, timeout=30)
            response.raise_for_status()
            return response.content
        except Exception as e:
            logger.error(f"Failed to fetch asset {url}: {e}")
            raise Exception(f"Asset fetch failed: {str(e)}")

