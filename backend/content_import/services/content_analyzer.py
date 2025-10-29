"""Content analyzer service for analyzing HTML containers and providing statistics."""

import logging
from typing import Dict, List, Any
from bs4 import BeautifulSoup
from collections import Counter

logger = logging.getLogger(__name__)


class ContentAnalyzer:
    """Analyze HTML containers and provide content statistics."""

    def __init__(self):
        """Initialize content analyzer."""
        self.text_tags = ["h1", "h2", "h3", "h4", "h5", "h6", "p", "blockquote", "li"]
        self.file_extensions = [
            ".pdf",
            ".doc",
            ".docx",
            ".xls",
            ".xlsx",
            ".ppt",
            ".pptx",
            ".zip",
            ".tar",
            ".gz",
        ]

    def analyze_container(self, html: str) -> Dict[str, Any]:
        """
        Analyze a container and return statistics.

        Args:
            html: HTML string of the container

        Returns:
            Dictionary with content statistics:
            {
                "text_blocks": 5,  # h1-h6, p, blockquote, li
                "images": 3,
                "tables": 1,
                "files": 2,  # file links
                "total_text_length": 1234,
                "child_containers": 10,  # nested divs/sections
                "headings": {"h1": 1, "h2": 3, "h3": 2},
                "lists": 2  # ul/ol elements
            }
        """
        try:
            soup = BeautifulSoup(html, "html.parser")

            # Count text blocks
            text_blocks = len(soup.find_all(self.text_tags))

            # Count images
            images = len(soup.find_all("img"))

            # Count tables
            tables = len(soup.find_all("table"))

            # Count file links
            files = self._count_file_links(soup)

            # Get total text length
            total_text_length = len(soup.get_text(strip=True))

            # Count child containers
            child_containers = len(
                soup.find_all(["div", "section", "article", "main", "aside", "nav"])
            )

            # Count headings by level
            headings = {}
            for i in range(1, 7):
                tag = f"h{i}"
                count = len(soup.find_all(tag))
                if count > 0:
                    headings[tag] = count

            # Count lists
            lists = len(soup.find_all(["ul", "ol"]))

            return {
                "text_blocks": text_blocks,
                "images": images,
                "tables": tables,
                "files": files,
                "total_text_length": total_text_length,
                "child_containers": child_containers,
                "headings": headings,
                "lists": lists,
            }

        except Exception as e:
            logger.error(f"Failed to analyze container: {e}")
            return {
                "text_blocks": 0,
                "images": 0,
                "tables": 0,
                "files": 0,
                "total_text_length": 0,
                "child_containers": 0,
                "headings": {},
                "lists": 0,
                "error": str(e),
            }

    def analyze_hierarchy(self, elements: List[Dict[str, str]]) -> List[Dict[str, Any]]:
        """
        Analyze multiple elements in a hierarchy.

        Args:
            elements: List of elements with html, tag, and classes

        Returns:
            List of statistics for each element
        """
        results = []
        for element in elements:
            stats = self.analyze_container(element.get("html", ""))
            stats["tag"] = element.get("tag", "")
            stats["classes"] = element.get("classes", "")
            results.append(stats)

        return results

    def detect_patterns(self, html: str) -> List[Dict[str, Any]]:
        """
        Detect repeating similar containers (e.g., blog post cards, product listings).

        Args:
            html: HTML string to analyze

        Returns:
            List of detected patterns:
            [
                {
                    "pattern_name": "Similar articles",
                    "count": 5,
                    "sample_html": "<article>...</article>",
                    "similarity": 0.85,
                    "tag_name": "article",
                    "common_classes": ["post", "item"]
                }
            ]
        """
        try:
            soup = BeautifulSoup(html, "html.parser")
            patterns = []

            # Look for containers with children that have similar structure
            container_tags = ["div", "section", "article", "main", "ul", "ol"]

            for container_tag in container_tags:
                containers = soup.find_all(container_tag)

                for container in containers:
                    # Get direct children
                    children = [
                        child
                        for child in container.children
                        if hasattr(child, "name") and child.name
                    ]

                    if len(children) < 3:
                        continue

                    # Group children by tag name
                    tag_counter = Counter([child.name for child in children])

                    # Find repeating tags
                    for tag_name, count in tag_counter.items():
                        if count >= 3:  # At least 3 similar elements
                            # Get elements of this tag
                            similar_elements = container.find_all(
                                tag_name, recursive=False
                            )

                            # Check for common classes
                            class_sets = [
                                set(elem.get("class", [])) for elem in similar_elements
                            ]
                            if class_sets:
                                common_classes = list(
                                    set.intersection(*class_sets)
                                    if class_sets
                                    else set()
                                )
                            else:
                                common_classes = []

                            # Get sample HTML (truncated)
                            sample = similar_elements[0] if similar_elements else None
                            sample_html = str(sample)[:200] + "..." if sample else ""

                            # Calculate similarity (basic - based on class overlap)
                            similarity = (
                                len(common_classes) / max(len(class_sets[0]), 1)
                                if class_sets
                                else 0.5
                            )

                            pattern_name = f"Similar {tag_name} elements"
                            if common_classes:
                                pattern_name += f" ({', '.join(common_classes[:2])})"

                            patterns.append(
                                {
                                    "pattern_name": pattern_name,
                                    "count": count,
                                    "sample_html": sample_html,
                                    "similarity": round(similarity, 2),
                                    "tag_name": tag_name,
                                    "common_classes": common_classes,
                                }
                            )

            # Sort by count (most common patterns first)
            patterns.sort(key=lambda x: x["count"], reverse=True)

            # Return top 5 patterns
            return patterns[:5]

        except Exception as e:
            logger.error(f"Failed to detect patterns: {e}")
            return []

    def _count_file_links(self, soup: BeautifulSoup) -> int:
        """
        Count file links in HTML.

        Args:
            soup: BeautifulSoup object

        Returns:
            Number of file links
        """
        count = 0
        for link in soup.find_all("a"):
            href = link.get("href", "")
            href = href.lower()
            if any(href.endswith(ext) for ext in self.file_extensions):
                count += 1
        return count

    def format_stats_summary(self, stats: Dict[str, Any]) -> str:
        """
        Format statistics into a human-readable summary.

        Args:
            stats: Statistics dictionary

        Returns:
            Formatted summary string
        """
        parts = []

        if stats.get("text_blocks", 0) > 0:
            parts.append(f"{stats['text_blocks']} text blocks")

        if stats.get("images", 0) > 0:
            parts.append(f"{stats['images']} images")

        if stats.get("tables", 0) > 0:
            parts.append(f"{stats['tables']} tables")

        if stats.get("files", 0) > 0:
            parts.append(f"{stats['files']} files")

        if not parts:
            return "No content"

        return ", ".join(parts)
