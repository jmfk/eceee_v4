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

    def fetch_and_rewrite(
        self, url: str, request=None, strip_design: bool = True
    ) -> Dict[str, Any]:
        """
        Fetch external page and rewrite all URLs to proxy through our backend.

        Args:
            url: The external URL to fetch
            request: Django request object for building absolute URLs
            strip_design: Whether to strip original design and use basic typography

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
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
                },
            )
            response.raise_for_status()

            html = response.text
            content_type = response.headers.get("content-type", "text/html")

            # Parse HTML
            soup = BeautifulSoup(html, "html.parser")

            # Add jQuery shim FIRST (before any other scripts)
            self._inject_jquery_shim(soup)

            # Add base tag for URL resolution in iframe
            self._inject_base_tag(soup, request)

            # Rewrite URLs
            self._rewrite_urls(soup, url, request)

            # Add design stripping CSS if requested
            if strip_design:
                self._inject_design_stripping_css(soup)

            # Add click capture script
            self._inject_click_capture_script(soup)

            rewritten_html = str(soup)

            logger.info(f"Successfully fetched and rewrote {url}")

            return {
                "html": rewritten_html,
                "base_url": url,
                "content_type": content_type,
            }

        except Exception as e:
            logger.error(f"Failed to fetch and rewrite {url}: {e}")
            raise Exception(f"Proxy fetch failed: {str(e)}")

    def _rewrite_urls(self, soup: BeautifulSoup, base_url: str, request=None):
        """
        Rewrite all URLs in HTML to proxy through our backend.

        Args:
            soup: BeautifulSoup object
            base_url: Original page URL for resolving relative URLs
            request: Django request object for building absolute URLs
        """
        # Rewrite image sources
        for img in soup.find_all("img"):
            if img.get("src"):
                absolute_url = urljoin(base_url, img["src"])
                img["src"] = self._create_proxy_url(absolute_url, request)

            if img.get("srcset"):
                # Rewrite srcset URLs
                srcset_parts = []
                for part in img["srcset"].split(","):
                    part = part.strip()
                    if " " in part:
                        url_part, descriptor = part.rsplit(" ", 1)
                        absolute_url = urljoin(base_url, url_part)
                        srcset_parts.append(
                            f"{self._create_proxy_url(absolute_url, request)} {descriptor}"
                        )
                    else:
                        absolute_url = urljoin(base_url, part)
                        srcset_parts.append(
                            self._create_proxy_url(absolute_url, request)
                        )
                img["srcset"] = ", ".join(srcset_parts)

        # Rewrite link hrefs (CSS)
        for link in soup.find_all("link", href=True):
            absolute_url = urljoin(base_url, link["href"])
            link["href"] = self._create_proxy_url(absolute_url, request)

        # Rewrite script sources
        for script in soup.find_all("script", src=True):
            absolute_url = urljoin(base_url, script["src"])
            script["src"] = self._create_proxy_url(absolute_url, request)

        # Rewrite anchor hrefs - make them non-functional to prevent navigation
        for a in soup.find_all("a", href=True):
            a["href"] = "javascript:void(0)"
            a["data-original-href"] = urljoin(base_url, a.get("href", ""))

        # Rewrite CSS url() references in style tags
        for style in soup.find_all("style"):
            if style.string:
                style.string = self._rewrite_css_urls(style.string, base_url, request)

        # Rewrite inline style attributes
        for tag in soup.find_all(style=True):
            tag["style"] = self._rewrite_css_urls(tag["style"], base_url, request)

    def _rewrite_css_urls(self, css: str, base_url: str, request=None) -> str:
        """
        Rewrite url() references in CSS.

        Args:
            css: CSS content
            base_url: Base URL for resolving relative URLs
            request: Django request object for building absolute URLs

        Returns:
            CSS with rewritten URLs
        """

        def replace_url(match):
            url = match.group(1).strip("'\"")
            absolute_url = urljoin(base_url, url)
            proxy_url = self._create_proxy_url(absolute_url, request)
            return f"url('{proxy_url}')"

        return re.sub(r'url\(["\']?([^)"\']+)["\']?\)', replace_url, css)

    def _create_proxy_url(self, url: str, request=None) -> str:
        """
        Create a proxied URL with absolute path for iframe usage.

        Args:
            url: Original URL
            request: Django request object for building absolute URLs

        Returns:
            Proxied URL (absolute if request provided, relative otherwise)
        """
        from urllib.parse import quote

        # Build absolute URL if request is available (needed for iframe srcDoc)
        if request:
            scheme = "https" if request.is_secure() else "http"
            host = request.get_host()

            # In development, replace Docker internal hostname with localhost for frontend access
            if host.startswith("backend:"):
                host = host.replace("backend:", "localhost:")
                logger.debug(f"Replaced Docker hostname with localhost: {host}")

            return f"{scheme}://{host}{self.base_proxy_url}?url={quote(url)}"

        # Fallback to relative URL
        return f"{self.base_proxy_url}?url={quote(url)}"

    def _inject_base_tag(self, soup: BeautifulSoup, request):
        """
        Inject base tag for proper URL resolution in iframe.

        Args:
            soup: BeautifulSoup object
            request: Django request object
        """
        if request:
            scheme = "https" if request.is_secure() else "http"
            host = request.get_host()
            base_url = f"{scheme}://{host}/"

            base_tag = soup.new_tag("base", href=base_url)
            if not soup.head:
                soup.insert(0, soup.new_tag("head"))
            soup.head.insert(0, base_tag)

    def _inject_design_stripping_css(self, soup: BeautifulSoup):
        """
        Inject CSS to strip original design and show basic typography.

        Args:
            soup: BeautifulSoup object
        """
        style = soup.new_tag("style")
        style.string = """
        * {
            background: white !important;
            background-color: white !important;
            background-image: none !important;
            box-shadow: none !important;
            border-radius: 0 !important;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;
            line-height: 1.6 !important;
            color: #333 !important;
            padding: 20px !important;
            max-width: 100% !important;
        }
        h1, h2, h3, h4, h5, h6 {
            color: #111 !important;
            margin: 1em 0 0.5em !important;
            font-weight: bold !important;
        }
        p, li {
            margin: 0.5em 0 !important;
        }
        img {
            max-width: 100% !important;
            height: auto !important;
            display: block !important;
            margin: 1em 0 !important;
            border: 1px solid #ddd !important;
        }
        table {
            border-collapse: collapse !important;
            width: 100% !important;
            margin: 1em 0 !important;
        }
        th, td {
            border: 1px solid #ddd !important;
            padding: 8px !important;
            text-align: left !important;
        }
        th {
            background-color: #f5f5f5 !important;
            font-weight: bold !important;
        }
        nav, header, footer, aside, [role="navigation"], [role="banner"], [role="contentinfo"] {
            opacity: 0.3 !important;
        }
        """

        if not soup.head:
            soup.insert(0, soup.new_tag("head"))
        soup.head.append(style)

    def _inject_jquery_shim(self, soup: BeautifulSoup):
        """
        Inject jQuery shim at the very beginning to prevent errors.

        Args:
            soup: BeautifulSoup object
        """
        script = soup.new_tag("script")
        script.string = """
        // jQuery shim - must load before any jQuery code
        (function() {
            window.$ = window.jQuery = function(selector) {
                // Return a fake jQuery object
                var fakeJQuery = {
                    ready: function(fn) { 
                        if (typeof fn === 'function') {
                            if (document.readyState === 'complete') {
                                fn();
                            } else {
                                window.addEventListener('DOMContentLoaded', fn);
                            }
                        }
                        return this;
                    },
                    on: function() { return this; },
                    off: function() { return this; },
                    click: function() { return this; },
                    find: function() { return this; },
                    each: function() { return this; },
                    addClass: function() { return this; },
                    removeClass: function() { return this; },
                    css: function() { return this; },
                    attr: function() { return this; },
                    html: function() { return this; },
                    text: function() { return this; },
                    append: function() { return this; },
                    hide: function() { return this; },
                    show: function() { return this; }
                };
                return fakeJQuery;
            };
            
            // jQuery static methods
            window.$.ajax = function() { return Promise.reject('Ajax disabled'); };
            window.$.get = function() { return Promise.reject('Get disabled'); };
            window.$.post = function() { return Promise.reject('Post disabled'); };
            
            // Suppress script errors
            window.addEventListener('error', function(e) { 
                e.preventDefault(); 
                return true;
            }, true);
        })();
        """

        # Insert at very beginning of head
        if not soup.head:
            soup.insert(0, soup.new_tag("head"))
        soup.head.insert(0, script)

    def _inject_click_capture_script(self, soup: BeautifulSoup):
        """
        Inject JavaScript to capture clicks and communicate with parent window.

        Args:
            soup: BeautifulSoup object
        """
        script = soup.new_tag("script")
        script.string = """
        (function() {
            // Track selected element and hierarchy
            let selectedElement = null;
            let hierarchyElements = [];
            
            // Quick statistics calculation for an element
            function getQuickStats(element) {
                const TEXT_TAGS = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'blockquote', 'li'];
                const textBlocks = element.querySelectorAll(TEXT_TAGS.join(', ')).length;
                const images = element.querySelectorAll('img').length;
                const tables = element.querySelectorAll('table').length;
                const files = Array.from(element.querySelectorAll('a[href]')).filter(link => {
                    const href = link.href.toLowerCase();
                    return href.endsWith('.pdf') || href.endsWith('.doc') || 
                           href.endsWith('.docx') || href.endsWith('.xls') || 
                           href.endsWith('.xlsx') || href.endsWith('.zip');
                }).length;
                
                return { textBlocks, images, tables, files };
            }
            
            // Build hierarchy from element up to body
            function buildHierarchy(clickedElement) {
                const hierarchy = [];
                let current = clickedElement;
                const SKIP_TAGS = ['html'];
                
                while (current && current !== document.documentElement) {
                    const tagName = current.tagName.toLowerCase();
                    
                    // Skip html tag
                    if (SKIP_TAGS.includes(tagName)) {
                        current = current.parentElement;
                        continue;
                    }
                    
                    // Get element info
                    const classes = current.className || '';
                    const id = current.id || '';
                    const quickStats = getQuickStats(current);
                    
                    hierarchy.push({
                        tagName: tagName,
                        classes: classes,
                        id: id,
                        html: current.outerHTML,
                        quickStats: quickStats,
                        element: current  // Store reference for highlighting
                    });
                    
                    current = current.parentElement;
                }
                
                return hierarchy;
            }
            
            // Find content-bearing parent element (default selection)
            function findContentBlock(clickedElement) {
                let current = clickedElement;
                const SKIP_TAGS = ['html', 'body', 'nav', 'header', 'footer', 'aside', 'form', 'button', 'a'];
                const CONTENT_TAGS = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'img', 'table', 'blockquote'];
                
                // Walk up the tree to find a good content container
                while (current && current !== document.body) {
                    const tagName = current.tagName.toLowerCase();
                    
                    // Skip navigation/header/footer containers and links
                    if (SKIP_TAGS.includes(tagName)) {
                        current = current.parentElement;
                        continue;
                    }
                    
                    // Check if this element is primarily links (navigation menu)
                    const links = current.querySelectorAll('a');
                    const paragraphs = current.querySelectorAll('p, h1, h2, h3, h4, h5, h6');
                    const images = current.querySelectorAll('img');
                    const tables = current.querySelectorAll('table');
                    
                    // If it's mostly links and no real content, skip it
                    if (links.length > 3 && paragraphs.length === 0 && images.length === 0 && tables.length === 0) {
                        current = current.parentElement;
                        continue;
                    }
                    
                    // Check if this element contains actual content
                    const hasContent = CONTENT_TAGS.some(tag => 
                        current.querySelector(tag) !== null
                    );
                    
                    if (hasContent) {
                        // Check size - should be substantial but not whole page
                        const rect = current.getBoundingClientRect();
                        const widthPercent = rect.width / window.innerWidth;
                        const heightPercent = rect.height / window.innerHeight;
                        
                        // Good size range: 20% to 90% of viewport
                        if (widthPercent < 0.9 && heightPercent < 0.9 && 
                            rect.width > 200 && rect.height > 100) {
                            return current;
                        }
                    }
                    
                    current = current.parentElement;
                }
                
                // Fallback: find nearest article/section/main/div with content
                current = clickedElement;
                while (current && current !== document.body) {
                    const tagName = current.tagName.toLowerCase();
                    if (['article', 'section', 'main', 'div'].includes(tagName)) {
                        const text = current.textContent?.trim() || '';
                        if (text.length > 50) {
                            return current;
                        }
                    }
                    current = current.parentElement;
                }
                
                return clickedElement;
            }
            
            // Prevent default navigation
            document.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                
                // Build full hierarchy from clicked element
                const hierarchy = buildHierarchy(e.target);
                hierarchyElements = hierarchy;
                
                // Find default content-bearing block
                const blockElement = findContentBlock(e.target);
                
                // Find index of the default block in hierarchy
                const clickedIndex = hierarchy.findIndex(h => h.element === blockElement);
                
                if (blockElement) {
                    // Clear previous selection highlight
                    if (selectedElement && selectedElement !== blockElement) {
                        selectedElement.style.outline = '';
                        selectedElement.style.outlineOffset = '';
                        selectedElement.style.backgroundColor = '';
                    }
                    
                    // Highlight the selected element with persistent styling
                    blockElement.style.outline = '3px solid rgb(34, 197, 94)';
                    blockElement.style.outlineOffset = '2px';
                    blockElement.style.backgroundColor = 'rgba(34, 197, 94, 0.1)';
                    selectedElement = blockElement;
                    
                    // Send hierarchy data to parent window
                    const hierarchyData = hierarchy.map(h => ({
                        tagName: h.tagName,
                        classes: h.classes,
                        id: h.id,
                        html: h.html,
                        quickStats: h.quickStats
                    }));
                    
                    window.parent.postMessage({
                        type: 'CONTENT_SELECTED',
                        data: {
                            hierarchy: hierarchyData,
                            clickedIndex: clickedIndex >= 0 ? clickedIndex : 0
                        }
                    }, '*');
                }
            }, true);
            
            // Listen for highlight requests from parent
            window.addEventListener('message', function(event) {
                if (event.data.type === 'HIGHLIGHT_ELEMENT') {
                    const index = event.data.index;
                    
                    if (index >= 0 && index < hierarchyElements.length) {
                        const element = hierarchyElements[index].element;
                        
                        // Clear all highlights except selected
                        hierarchyElements.forEach(h => {
                            if (h.element !== selectedElement) {
                                h.element.style.outline = '';
                                h.element.style.outlineOffset = '';
                                h.element.style.backgroundColor = '';
                            }
                        });
                        
                        // Highlight the hovered element (if not selected)
                        if (element !== selectedElement) {
                            element.style.outline = '3px solid rgba(59, 130, 246, 0.8)';
                            element.style.outlineOffset = '2px';
                            element.style.backgroundColor = 'rgba(59, 130, 246, 0.1)';
                        }
                    }
                } else if (event.data.type === 'SELECT_ELEMENT') {
                    const index = event.data.index;
                    
                    if (index >= 0 && index < hierarchyElements.length) {
                        const element = hierarchyElements[index].element;
                        
                        // Clear previous selection
                        if (selectedElement) {
                            selectedElement.style.outline = '';
                            selectedElement.style.outlineOffset = '';
                            selectedElement.style.backgroundColor = '';
                        }
                        
                        // Set new selection
                        element.style.outline = '3px solid rgb(34, 197, 94)';
                        element.style.outlineOffset = '2px';
                        element.style.backgroundColor = 'rgba(34, 197, 94, 0.1)';
                        selectedElement = element;
                    }
                } else if (event.data.type === 'CLEAR_HIGHLIGHT') {
                    // Clear hover highlights (keep selection)
                    hierarchyElements.forEach(h => {
                        if (h.element !== selectedElement) {
                            h.element.style.outline = '';
                            h.element.style.outlineOffset = '';
                            h.element.style.backgroundColor = '';
                        }
                    });
                }
            });
            
            // Add hover highlighting - highlight content blocks (but not selected)
            let currentHighlight = null;
            document.addEventListener('mouseover', function(e) {
                e.stopPropagation();
                const blockElement = findContentBlock(e.target);
                
                // Don't highlight if this is the selected element
                if (blockElement === selectedElement) {
                    if (currentHighlight && currentHighlight !== selectedElement) {
                        currentHighlight.style.outline = '';
                        currentHighlight.style.outlineOffset = '';
                    }
                    currentHighlight = null;
                    return;
                }
                
                // Remove previous highlight
                if (currentHighlight && currentHighlight !== blockElement && currentHighlight !== selectedElement) {
                    currentHighlight.style.outline = '';
                    currentHighlight.style.outlineOffset = '';
                }
                
                if (blockElement && blockElement !== currentHighlight && blockElement !== selectedElement) {
                    // Add blue hover highlight (different from green selection)
                    blockElement.style.outline = '3px solid rgba(59, 130, 246, 0.8)';
                    blockElement.style.outlineOffset = '2px';
                    currentHighlight = blockElement;
                }
            }, true);
            
            document.addEventListener('mouseout', function(e) {
                // Only remove hover highlight if leaving the document
                if (!e.relatedTarget || e.relatedTarget === document.documentElement) {
                    if (currentHighlight && currentHighlight !== selectedElement) {
                        currentHighlight.style.outline = '';
                        currentHighlight.style.outlineOffset = '';
                        currentHighlight = null;
                    }
                }
            }, true);
        })();
        """

        # Append script to body
        if soup.body:
            soup.body.append(script)
        else:
            # If no body, add to head
            if not soup.head:
                soup.insert(0, soup.new_tag("head"))
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
