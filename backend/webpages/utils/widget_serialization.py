import re
from typing import Dict, List, Any
from ..widget_registry import widget_type_registry

def snake_to_camel_case(name: str) -> str:
    """Convert snake_case to camelCase"""
    components = name.split("_")
    return components[0] + "".join(word.capitalize() for word in components[1:])

def convert_snake_to_camel(obj: Any) -> Any:
    """Convert snake_case keys to camelCase recursively"""
    if isinstance(obj, dict):
        converted = {}
        for key, value in obj.items():
            camel_key = snake_to_camel_case(key)
            converted[camel_key] = convert_snake_to_camel(value)
        return converted
    elif isinstance(obj, list):
        return [convert_snake_to_camel(item) for item in obj]
    else:
        return obj

def serialize_widget_instance(widget: Dict[str, Any]) -> Dict[str, Any]:
    """
    Process a widget instance for the frontend:
    1. Inject active variants based on config
    2. Convert all keys to camelCase
    """
    if not isinstance(widget, dict):
        return widget

    processed_widget = widget.copy()
    
    # Look up widget type to get active variants
    widget_type_id = widget.get("type") or widget.get("widget_type")
    widget_type = widget_type_registry.get_widget_type_flexible(widget_type_id)
    
    if "config" in widget:
        # Inject active variants before converting config to camelCase
        if widget_type:
            active_variants = widget_type.get_active_variants(widget["config"])
            processed_widget["active_variants"] = active_variants

        processed_widget["config"] = convert_snake_to_camel(widget["config"])

    # Convert entire widget object to camelCase
    final_widget = {}
    for key, value in processed_widget.items():
        camel_key = snake_to_camel_case(key)
        final_widget[camel_key] = value
    
    return final_widget

def serialize_widget_slots(widgets_data: Dict[str, List[Dict[str, Any]]]) -> Dict[str, List[Dict[str, Any]]]:
    """Process all widget slots for the frontend"""
    if not isinstance(widgets_data, dict):
        return widgets_data

    serialized_slots = {}
    for slot_name, widgets in widgets_data.items():
        if not isinstance(widgets, list):
            serialized_slots[slot_name] = widgets
            continue

        serialized_slots[slot_name] = [serialize_widget_instance(w) for w in widgets]

    return serialized_slots

