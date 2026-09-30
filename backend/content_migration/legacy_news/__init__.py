"""Shared legacy News extraction and import pipeline."""

from .extractor import ExtractedNews, extract_news_html

__all__ = ["ExtractedNews", "extract_news_html"]
