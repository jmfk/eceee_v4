"""Content analysis utilities for identifying content types."""

from bs4 import BeautifulSoup
from typing import List, Dict, Any
import re


def identify_content_types(html: str) -> Dict[str, int]:
    """
    Analyze HTML and count different content types.
    
    Args:
        html: The HTML string to analyze
    
    Returns:
        Dictionary with counts of different content types
    """
    soup = BeautifulSoup(html, 'html.parser')
    
    counts = {
        'text_blocks': 0,
        'tables': 0,
        'images': 0,
        'file_links': 0,
        'headings': 0,
        'lists': 0,
    }
    
    # Count tables
    counts['tables'] = len(soup.find_all('table'))
    
    # Count images
    counts['images'] = len(soup.find_all('img'))
    
    # Count file links
    file_extensions = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.zip', '.rar']
    for link in soup.find_all('a', href=True):
        href = link['href'].lower()
        if any(href.endswith(ext) for ext in file_extensions):
            counts['file_links'] += 1
    
    # Count headings
    counts['headings'] = len(soup.find_all(['h1', 'h2', 'h3', 'h4', 'h5', 'h6']))
    
    # Count lists
    counts['lists'] = len(soup.find_all(['ul', 'ol']))
    
    # Count text blocks (p, blockquote, div with substantial text)
    for tag in soup.find_all(['p', 'blockquote', 'div']):
        text = tag.get_text(strip=True)
        if len(text) > 20:  # Only count substantial text blocks
            counts['text_blocks'] += 1
    
    return counts


def is_file_link(url: str) -> bool:
    """
    Check if a URL points to a downloadable file.
    
    Args:
        url: The URL to check
    
    Returns:
        True if URL appears to be a file download
    """
    file_extensions = [
        '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
        '.zip', '.rar', '.tar', '.gz', '.7z',
        '.csv', '.txt', '.rtf',
        '.jpg', '.jpeg', '.png', '.gif', '.svg',
    ]
    
    url_lower = url.lower()
    return any(url_lower.endswith(ext) for ext in file_extensions)


def extract_file_extension(url: str) -> str:
    """
    Extract file extension from URL.
    
    Args:
        url: The URL
    
    Returns:
        File extension (e.g., 'pdf', 'docx') or empty string
    """
    match = re.search(r'\.([a-zA-Z0-9]+)(?:\?|#|$)', url)
    if match:
        return match.group(1).lower()
    return ""


def get_link_text(link_element) -> str:
    """
    Get the text content of a link element.
    
    Args:
        link_element: BeautifulSoup link element
    
    Returns:
        Link text or URL if no text
    """
    text = link_element.get_text(strip=True)
    if text:
        return text
    
    # Fallback to href
    href = link_element.get('href', '')
    return href


def is_valid_image_url(url: str) -> bool:
    """
    Check if URL appears to be a valid image.
    
    Args:
        url: The URL to check
    
    Returns:
        True if URL looks like an image
    """
    if not url:
        return False
    
    # Check for data URLs
    if url.startswith('data:image/'):
        return True
    
    # Check for common image extensions
    image_extensions = ['.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp', '.bmp']
    url_lower = url.lower()
    
    return any(ext in url_lower for ext in image_extensions)

