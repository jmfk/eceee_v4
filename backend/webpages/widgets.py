"""
DEPRECATED: Widget implementations have been moved to the core_widgets app.

This file now serves as a compatibility layer for any existing imports.
For new widgets, create them in separate Django apps or in core_widgets.

The core_widgets app can be disabled in settings.py if you want to use only
custom widgets without the built-in widget types.
"""

# Import core widgets from the new app for backwards compatibility
try:
    from core_widgets.widgets import *
except ImportError:
    # core_widgets app is not installed/enabled
    # This allows the system to work without core widgets
    import logging
    logger = logging.getLogger(__name__)
    logger.info("core_widgets app not available - no built-in widgets loaded")
    pass