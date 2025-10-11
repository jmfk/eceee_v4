"""
Path Pattern Registry System

This module provides a secure, pluggable system for defining URL path patterns
that can be used for dynamic object publishing. Instead of allowing arbitrary
regex patterns, users select from predefined, validated patterns.

This prevents ReDoS attacks and provides better UX with validated metadata.
"""

from abc import ABC, abstractmethod
from typing import Dict, List, Any, Optional, Type
from django.core.exceptions import ImproperlyConfigured
import re
import logging

logger = logging.getLogger(__name__)


class BasePathPattern(ABC):
    """
    Abstract base class for all path pattern implementations.

    Third-party apps should subclass this to create custom path patterns.
    Each pattern defines a regex for matching URL paths and extracting variables.
    """

    # Required class attributes that must be defined in subclasses
    key: str = None  # Unique identifier (e.g., "news_slug")
    name: str = None  # Human-readable name
    description: str = ""  # Explanation of when to use this pattern
    regex_pattern: str = None  # The actual regex (e.g., ^(?P<slug>[\w-]+)/$)
    example_url: str = ""  # Example path that matches (e.g., "my-article/")

    # Metadata about captured variables
    extracted_variables: List[Dict[str, str]] = []
    # Each dict should have: name, type, description, example

    def __init__(self):
        """Initialize and validate the path pattern"""
        if self.key is None:
            raise ImproperlyConfigured(
                f"Path pattern class {self.__class__.__name__} must define a 'key' attribute"
            )
        if self.name is None:
            raise ImproperlyConfigured(
                f"Path pattern class {self.__class__.__name__} must define a 'name' attribute"
            )
        if self.regex_pattern is None:
            raise ImproperlyConfigured(
                f"Path pattern class {self.__class__.__name__} must define a 'regex_pattern' attribute"
            )

        # Validate that the regex pattern is valid
        try:
            self._compiled_pattern = re.compile(self.regex_pattern)
        except re.error as e:
            raise ImproperlyConfigured(
                f"Invalid regex pattern in {self.__class__.__name__}: {e}"
            )

        # Validate that it uses named groups
        if "(" in self.regex_pattern and "?P<" not in self.regex_pattern:
            logger.warning(
                f"Path pattern '{self.key}' has unnamed capture groups. "
                "Use named groups like (?P<name>...) for better widget integration."
            )

    def validate_match(self, path: str) -> Optional[Dict[str, str]]:
        """
        Validate that the path matches this pattern and extract variables.

        Args:
            path: The URL path to match against

        Returns:
            Dict of extracted variables if match succeeds, None otherwise

        Example:
            pattern.validate_match("my-article/")
            # Returns: {"slug": "my-article"}
        """
        try:
            match = self._compiled_pattern.match(path)
            if match:
                return match.groupdict()
            return None
        except Exception as e:
            logger.error(
                f"Error matching path '{path}' against pattern '{self.key}': {e}"
            )
            return None

    def to_dict(self) -> Dict[str, Any]:
        """
        Serialize the pattern to a dictionary for API responses.

        Returns:
            Dict containing all pattern metadata
        """
        return {
            "key": self.key,
            "name": self.name,
            "description": self.description,
            "regex_pattern": self.regex_pattern,
            "example_url": self.example_url,
            "extracted_variables": self.extracted_variables,
        }

    def __str__(self):
        return f"{self.name} ({self.key})"

    def __repr__(self):
        return f"<{self.__class__.__name__}: {self.key}>"


class PathPatternRegistry:
    """
    Global registry for path pattern classes.

    Provides methods to register path patterns and retrieve them by key.
    """

    def __init__(self):
        self._patterns: Dict[str, Type[BasePathPattern]] = {}
        self._instances: Dict[str, BasePathPattern] = {}

    def register(self, pattern_class: Type[BasePathPattern]) -> None:
        """
        Register a path pattern class.

        Args:
            pattern_class: A subclass of BasePathPattern
        """
        if not issubclass(pattern_class, BasePathPattern):
            raise ImproperlyConfigured(
                f"Path pattern class {pattern_class.__name__} must inherit from BasePathPattern"
            )

        # Create instance to validate
        instance = pattern_class()

        key = instance.key
        if key in self._patterns:
            logger.warning(
                f"Path pattern '{key}' is being re-registered. "
                "Previous registration will be overwritten."
            )

        self._patterns[key] = pattern_class
        self._instances[key] = instance

        logger.info(f"Registered path pattern: {key}")

    def unregister(self, key: str) -> None:
        """Unregister a path pattern by key."""
        if key in self._patterns:
            del self._patterns[key]
            del self._instances[key]
            logger.info(f"Unregistered path pattern: {key}")

    def get_pattern(self, key: str) -> Optional[BasePathPattern]:
        """Get a path pattern instance by key."""
        return self._instances.get(key)

    def get_pattern_class(self, key: str) -> Optional[Type[BasePathPattern]]:
        """Get a path pattern class by key."""
        return self._patterns.get(key)

    def is_registered(self, key: str) -> bool:
        """Check if a pattern is registered by key."""
        return key in self._patterns

    def list_patterns(self) -> List[BasePathPattern]:
        """
        Get a list of all registered path pattern instances.

        Returns:
            List of BasePathPattern instances
        """
        return list(self._instances.values())

    def list_pattern_keys(self) -> List[str]:
        """
        Get a list of all registered pattern keys.

        Returns:
            List of pattern keys
        """
        return list(self._patterns.keys())

    def to_dict(self) -> List[Dict[str, Any]]:
        """
        Serialize all patterns to a list of dictionaries for API responses.

        Returns:
            List of pattern dictionaries
        """
        return [pattern.to_dict() for pattern in self._instances.values()]

    def validate_path(self, pattern_key: str, path: str) -> Optional[Dict[str, str]]:
        """
        Validate a path against a specific pattern.

        Args:
            pattern_key: The key of the pattern to use
            path: The URL path to validate

        Returns:
            Dict of extracted variables if valid, None otherwise
        """
        pattern = self.get_pattern(pattern_key)
        if not pattern:
            logger.warning(f"Pattern '{pattern_key}' not found in registry")
            return None

        return pattern.validate_match(path)

    def clear(self) -> None:
        """Clear all registered patterns. Primarily for testing."""
        self._patterns.clear()
        self._instances.clear()
        logger.info("Cleared all path patterns from registry")


# Global registry instance
path_pattern_registry = PathPatternRegistry()


def register_path_pattern(
    pattern_class: Type[BasePathPattern],
) -> Type[BasePathPattern]:
    """
    Decorator to register a path pattern class.

    Usage:
        @register_path_pattern
        class MyPattern(BasePathPattern):
            key = "my_pattern"
            name = "My Pattern"
            regex_pattern = r"^(?P<id>\d+)/$"
            # ... rest of implementation
    """
    path_pattern_registry.register(pattern_class)
    return pattern_class


def get_pattern(key: str) -> Optional[BasePathPattern]:
    """Convenience function to get a path pattern by key."""
    return path_pattern_registry.get_pattern(key)
