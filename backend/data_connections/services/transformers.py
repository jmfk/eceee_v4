from typing import Any, Dict, List, Optional
from django.core.cache import cache
import json

import requests
from bs4 import BeautifulSoup
import uuid

class DataTransformerService:
    """
    Handles data transformation based on a configuration.
    """
    def transform(self, data: List[Dict[str, Any]], config: Dict[str, Any]) -> List[Dict[str, Any]]:
        # Handle HTML parsing if configured
        if config.get('parse_html'):
            data = self.parse_html_fields(data, config.get('html_fields', []))
            
        # Handle file validation if configured
        if config.get('validate_files'):
            data = self.validate_files(data, config.get('file_url_fields', []))

        mode = config.get('mode', 'simple') # 'simple' or 'object_type'
        
        if mode == 'object_type':
            return self.transform_to_object_type(data, config)
            
        return self.transform_simple(data, config)

    def validate_files(self, data: List[Dict[str, Any]], fields: List[str]) -> List[Dict[str, Any]]:
        """
        Checks if file URLs exist.
        """
        for item in data:
            for field in fields:
                url = self._get_nested_value(item, field)
                if not url or not isinstance(url, str):
                    continue
                
                try:
                    response = requests.head(url, timeout=5, allow_redirects=True)
                    item[f"{field}_exists"] = response.status_code < 400
                except:
                    item[f"{field}_exists"] = False
        return data

    def parse_html_fields(self, data: List[Dict[str, Any]], fields: List[str]) -> List[Dict[str, Any]]:
        """
        Extracts images and links from HTML fields.
        """
        for item in data:
            for field in fields:
                html_content = self._get_nested_value(item, field)
                if not html_content or not isinstance(html_content, str):
                    continue
                
                soup = BeautifulSoup(html_content, 'html.parser')
                
                # Extract images
                images = []
                for img in soup.find_all('img'):
                    src = img.get('src')
                    if src:
                        images.append({
                            'src': src,
                            'alt': img.get('alt', ''),
                            'title': img.get('title', '')
                        })
                
                # Extract links
                links = []
                for a in soup.find_all('a'):
                    href = a.get('href')
                    if href:
                        links.append({
                            'href': href,
                            'text': a.get_text(strip=True)
                        })
                
                item[f"{field}_extracted"] = {
                    'images': images,
                    'links': links
                }
        return data

    def transform_simple(self, data: List[Dict[str, Any]], config: Dict[str, Any]) -> List[Dict[str, Any]]:
        mappings = config.get('mappings', {})
        static_fields = config.get('static_fields', {})
        
        if not mappings and not static_fields:
            return data
            
        transformed_data = []
        for item in data:
            new_item = {}
            # Apply mappings
            for target, source in mappings.items():
                val = self._get_nested_value(item, source)
                self._set_nested_value(new_item, target, val)
            
            # Apply static fields
            for key, val in static_fields.items():
                new_item[key] = val
                
            transformed_data.append(new_item)
            
        return transformed_data

    def transform_to_object_type(self, data: List[Dict[str, Any]], config: Dict[str, Any]) -> Dict[str, Any]:
        """
        Transforms data into an ObjectType-compatible structure (slots/widgets).
        config example:
        {
          "mode": "object_type",
          "slots": {
            "main": {
              "widget_type": "news_list",
              "item_mapping": {
                 "title": "title",
                 "content": "body"
              }
            }
          }
        }
        """
        result_widgets = {}
        slot_configs = config.get('slots', {})
        
        for slot_name, slot_cfg in slot_configs.items():
            widget_type = slot_cfg.get('widget_type')
            item_mapping = slot_cfg.get('item_mapping', {})
            
            widgets = []
            for i, item in enumerate(data):
                widget_config = {}
                for target, source in item_mapping.items():
                    widget_config[target] = self._get_nested_value(item, source)
                
                widgets.append({
                    "id": str(uuid.uuid4()),
                    "type": widget_type,
                    "config": widget_config,
                    "order": i
                })
            
            result_widgets[slot_name] = widgets
            
        return result_widgets

    def _get_nested_value(self, data: Dict[str, Any], path: str) -> Any:
        parts = path.split('.')
        current = data
        for part in parts:
            if isinstance(current, dict):
                current = current.get(part)
            else:
                return None
        return current

    def _set_nested_value(self, data: Dict[str, Any], path: str, value: Any):
        parts = path.split('.')
        current = data
        for i, part in enumerate(parts[:-1]):
            if part not in current:
                current[part] = {}
            current = current[part]
        current[parts[-1]] = value

class ConnectionCacheService:
    """
    Handles caching for data streams.
    """
    @staticmethod
    def get_cache_key(stream_id: int, query_params: Dict[str, Any] = None) -> str:
        params_str = json.dumps(query_params, sort_keys=True) if query_params else ""
        return f"data_stream_{stream_id}_{hash(params_str)}"

    @staticmethod
    def get(stream_id: int, query_params: Dict[str, Any] = None) -> Optional[List[Dict[str, Any]]]:
        key = ConnectionCacheService.get_cache_key(stream_id, query_params)
        return cache.get(key)

    @staticmethod
    def set(stream_id: int, data: List[Dict[str, Any]], ttl: int, query_params: Dict[str, Any] = None):
        key = ConnectionCacheService.get_cache_key(stream_id, query_params)
        cache.set(key, data, ttl)

    @staticmethod
    def invalidate(stream_id: int):
        # This is tricky because of the hash. 
        # For simplicity, we might want to store a list of keys per stream or use a pattern.
        # Redis supports pattern deletion.
        # For now, let's just use a versioned key if we need easy invalidation.
        pass

