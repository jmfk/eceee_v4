"""
Default widget type implementations for the easy_v4 CMS.

This app contains the default widgets that ship with easy_v4.
These widgets can be disabled by removing 'easy_widgets' from INSTALLED_APPS,
or completely replaced by creating custom widget apps.

All widget implementations have been moved to the widgets/ submodule for better organization.
"""

# Import all widgets from the submodule
from .widgets import *
