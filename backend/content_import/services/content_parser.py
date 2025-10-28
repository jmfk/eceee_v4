"""Content parser service for splitting HTML into content segments."""

import logging
from typing import List, Dict, Any
from bs4 import BeautifulSoup, NavigableString, Tag
from ..utils.html_sanitizer import sanitize_html, deep_clean_html
from ..utils.content_analyzer import is_file_link, extract_file_extension


logger = logging.getLogger(__name__)


class ContentSegment:
    """Represents a segment of content."""

    def __init__(
        self, segment_type: str, content: Any, metadata: Dict[str, Any] = None
    ):
        self.type = segment_type
        self.content = content
        self.metadata = metadata or {}

    def to_dict(self) -> Dict[str, Any]:
        """Convert segment to dictionary."""
        return {
            "type": self.type,
            "content": self.content,
            "metadata": self.metadata,
        }


class ContentParser:
    """Parse HTML content into structured segments."""

    def __init__(self):
        """Initialize content parser."""
        self.segments = []

    def parse(self, html: str) -> List[ContentSegment]:
        """
        Parse HTML into content segments.

        Args:
            html: The HTML string to parse

        Returns:
            List of ContentSegment objects in document order
        """
        # Step 1: Sanitize HTML (remove dangerous tags/scripts)
        clean_html = sanitize_html(html)

        # Step 2: Deep clean (remove spans/fonts/attributes/nested blocks)
        clean_html = deep_clean_html(clean_html)

        # Parse with BeautifulSoup
        soup = BeautifulSoup(clean_html, "html.parser")

        # Step 3: Remove all wrapper divs before processing
        # Divs are just containers - unwrap them to get to actual content
        div_count = 0
        for wrapper in soup.find_all(["div", "section", "article", "main", "aside"]):
            wrapper.unwrap()
            div_count += 1

        # Show first 10 elements after unwrapping
        content_elements = soup.find_all(
            [
                "h1",
                "h2",
                "h3",
                "h4",
                "h5",
                "h6",
                "p",
                "blockquote",
                "ul",
                "ol",
                "table",
                "img",
            ]
        )[:10]
        for i, tag in enumerate(content_elements, 1):
            tag_str = str(tag)[:150].replace("\n", " ")

        segments = []

        # Process content (keeping images inline)
        self._process_element(soup, segments)

        # Merge consecutive text content segments
        segments = self._merge_text_segments(segments)


        return segments

    def _process_element(self, element, segments: List[ContentSegment], depth: int = 0):
        """
        Recursively process element and extract segments.

        Args:
            element: BeautifulSoup element
            segments: List to append segments to
            depth: Current recursion depth
        """
        # Prevent infinite recursion
        if depth > 10:
            return

        for child in element.children:
            if isinstance(child, NavigableString):
                # Skip empty text nodes
                text = str(child).strip()
                if text:
                    segments.append(ContentSegment("text", text))
            elif isinstance(child, Tag):
                # Handle different tag types
                if child.name == "table":
                    self._extract_table(child, segments)
                elif child.name == "a" and child.get("href"):
                    # Check if it's a file link
                    href = child.get("href", "")
                    if is_file_link(href):
                        self._extract_file_link(child, segments)
                    else:
                        # Regular link - include in text content
                        self._process_element(child, segments, depth + 1)
                elif child.name in [
                    "h1",
                    "h2",
                    "h3",
                    "h4",
                    "h5",
                    "h6",
                    "p",
                    "blockquote",
                    "ul",
                    "ol",
                    "pre",
                ]:
                    # Content blocks - extract as HTML
                    segments.append(
                        ContentSegment("content", str(child), {"tag": child.name})
                    )
                else:
                    # Other tags - process children
                    self._process_element(child, segments, depth + 1)

    def _extract_table(self, table_element, segments: List[ContentSegment]):
        """Extract table as a segment."""
        table_html = str(table_element)

        # Get table statistics
        rows = len(table_element.find_all("tr"))
        cols = 0
        first_row = table_element.find("tr")
        if first_row:
            cols = len(first_row.find_all(["td", "th"]))

        segments.append(
            ContentSegment(
                "table",
                table_html,
                {
                    "rows": rows,
                    "cols": cols,
                },
            )
        )

    def _extract_file_link(self, link_element, segments: List[ContentSegment]):
        """Extract file link as a segment."""
        href = link_element.get("href", "")
        link_text = link_element.get_text(strip=True)
        title = link_element.get("title", "")

        # Get file extension
        extension = extract_file_extension(href)

        # Get surrounding context
        context = ""
        if link_element.parent:
            context = link_element.parent.get_text(separator=" ", strip=True)[:200]

        segments.append(
            ContentSegment(
                "file",
                {
                    "url": href,
                    "text": link_text,
                    "title": title,
                    "extension": extension,
                    "context": context,
                },
                {
                    "extension": extension,
                    "text": link_text,
                },
            )
        )

    def _merge_text_segments(
        self, segments: List[ContentSegment]
    ) -> List[ContentSegment]:
        """
        Merge only consecutive text segments, preserving order with tables/images.

        Args:
            segments: List of segments

        Returns:
            List with consecutive text merged, but tables/images preserved in order
        """
        if not segments:
            return []

        merged = []
        current_content = []

        for segment in segments:
            if segment.type == "text":
                # Accumulate plain text
                current_content.append(segment.content)
            elif segment.type == "content":
                # Accumulate HTML content
                current_content.append(segment.content)
            else:
                # Hit a table/image/file - flush accumulated text first
                if current_content:
                    merged_content = "\n".join(current_content).strip()
                    if merged_content:  # Only add if there's actual content
                        merged.append(ContentSegment("content", merged_content))
                    current_content = []

                # Add the non-text segment (preserves order)
                merged.append(segment)

        # Flush remaining content at end
        if current_content:
            merged_content = "\n".join(current_content).strip()
            if merged_content:
                merged.append(ContentSegment("content", merged_content))

        return merged

    def get_statistics(self, segments: List[ContentSegment]) -> Dict[str, int]:
        """
        Get statistics about parsed segments.

        Args:
            segments: List of segments

        Returns:
            Dictionary with counts
        """
        stats = {
            "content_blocks": 0,
            "tables": 0,
            "images": 0,
            "files": 0,
            "total": len(segments),
        }

        for segment in segments:
            if segment.type == "content":
                stats["content_blocks"] += 1
            elif segment.type == "table":
                stats["tables"] += 1
            elif segment.type == "image":
                stats["images"] += 1
            elif segment.type == "file":
                stats["files"] += 1

        return stats
