"""
DEPRECATED: Widget models have been moved to the core_widgets app.

This file now serves as a compatibility layer for any existing imports.
For new widget models, create them in separate Django apps or in core_widgets.
"""

# Import core widget models from the new app for backwards compatibility
try:
    from core_widgets.widget_models import *
except ImportError:
    # core_widgets app is not installed/enabled
    # This allows the system to work without core widget models
    import logging

    logger = logging.getLogger(__name__)
    logger.info("core_widgets app not available - no built-in widget models loaded")
    pass
