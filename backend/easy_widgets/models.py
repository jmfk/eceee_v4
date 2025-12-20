"""
Shared models for easy_widgets.

These models are used across multiple widget implementations.
"""

from typing import Optional, Literal
from pydantic import BaseModel, Field, ConfigDict
from pydantic.alias_generators import to_camel


class LinkData(BaseModel):
    """
    Link data model for menu items.
    
    Supports different link types with appropriate fields for each:
    - internal: page_id, anchor, page_title, page_short_title
    - external: url
    - email: address
    - phone: number
    - anchor: anchor
    
    Used by NavbarWidget and NavigationWidget.
    """
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )
    
    type: Literal["internal", "external", "email", "phone", "anchor", "media"]
    page_id: Optional[int] = None
    page_title: Optional[str] = None
    page_short_title: Optional[str] = None
    media_id: Optional[str] = None
    url: Optional[str] = None
    address: Optional[str] = None
    number: Optional[str] = None
    anchor: Optional[str] = None
    label: str = ""
    title: Optional[str] = None
    mime_type: Optional[str] = None
    is_active: bool = True
    target_blank: bool = False

