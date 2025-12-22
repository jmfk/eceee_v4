import json
import requests
from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional
from django.db.models import Q
from object_storage.models import ObjectInstance, ObjectTypeDefinition
from webpages.models.web_page import WebPage
from content.models import Tag
from file_manager.models import MediaFile

class BaseQueryEngine(ABC):
    @abstractmethod
    def execute(self, query_dsl: str, config: Dict[str, Any]) -> List[Dict[str, Any]]:
        pass

class InternalQueryEngine(BaseQueryEngine):
    """
    Query engine for internal system data.
    Query DSL can be a JSON string defining filters.
    Example:
    {
        "model": "ObjectInstance",
        "filters": {"object_type__name": "news"},
        "limit": 10,
        "order_by": "-created_at",
        "version": "published",
        "fields": ["id", "title", "data"]
    }
    """
    def execute(self, query_dsl: str, config: Dict[str, Any]) -> List[Dict[str, Any]]:
        try:
            query = json.loads(query_dsl)
        except json.JSONDecodeError:
            return []

        model_name = query.get('model', 'ObjectInstance')
        filters = query.get('filters', {})
        limit = query.get('limit', 100)
        order_by = query.get('order_by', '-id')
        version = query.get('version', 'latest')
        fields = query.get('fields', [])

        if model_name == 'ObjectInstance':
            if version == 'published':
                from django.utils import timezone
                now = timezone.now()
                queryset = ObjectInstance.published.published_only(now)
            else:
                queryset = ObjectInstance.objects.all()
            
            # For ObjectInstance, 'data' and 'widgets' are properties from the version
            # If these are requested, we must fetch objects and extract them
            has_properties = any(f in ['data', 'widgets'] for f in fields)
            
            queryset = queryset.filter(**filters)
            if order_by:
                queryset = queryset.order_by(order_by)
            
            results = queryset[:limit]
            
            output = []
            for obj in results:
                # If specific fields are requested, construct a dict
                if fields:
                    item = {}
                    for f in fields:
                        if hasattr(obj, f):
                            val = getattr(obj, f)
                            # Handle version properties
                            if f in ['data', 'widgets'] and version == 'published':
                                pub_version = obj.get_current_published_version()
                                val = getattr(pub_version, f) if pub_version else {}
                            
                            # Simple serialization
                            if hasattr(val, 'to_dict'):
                                item[f] = val.to_dict()
                            else:
                                item[f] = val
                        else:
                            item[f] = None
                    # Always include ID
                    if 'id' not in item:
                        item['id'] = obj.id
                    output.append(item)
                else:
                    # Full serialization
                    data_dict = obj.to_dict()
                    if version == 'published':
                        pub_version = obj.get_current_published_version()
                        if pub_version:
                            data_dict['data'] = pub_version.data
                            data_dict['widgets'] = pub_version.widgets
                    output.append(data_dict)
            return output

        elif model_name == 'WebPage':
            queryset = WebPage.objects.filter(**filters)
            if version == 'published':
                queryset = queryset.filter(is_currently_published=True)
            
            if order_by:
                queryset = queryset.order_by(order_by)
            
            results = queryset[:limit]
            output = []
            for obj in results:
                v = obj.current_published_version if version == 'published' else obj.latest_version
                
                if fields:
                    item = {}
                    for f in fields:
                        if f == 'content': # Map content to version data
                            item[f] = v.page_data if v else {}
                        elif hasattr(obj, f):
                            val = getattr(obj, f)
                            item[f] = val.to_dict() if hasattr(val, 'to_dict') else val
                        else:
                            item[f] = None
                    if 'id' not in item:
                        item['id'] = obj.id
                    output.append(item)
                else:
                    # Default serialization
                    item = {
                        'id': obj.id,
                        'title': obj.title,
                        'slug': obj.slug,
                        'path': obj.cached_path,
                        'content': v.page_data if v else {},
                        'is_published': obj.is_currently_published,
                        'created_at': obj.created_at,
                        'updated_at': obj.updated_at
                    }
                    output.append(item)
            return output

        elif model_name == 'Tag':
            queryset = Tag.objects.filter(**filters)
        elif model_name == 'MediaFile':
            queryset = MediaFile.objects.filter(**filters)
        elif model_name == 'ObjectTypeDefinition':
            queryset = ObjectTypeDefinition.objects.filter(**filters)
        else:
            return []

        if order_by:
            queryset = queryset.order_by(order_by)
        
        # Standard field selection for other models
        if fields:
            if 'id' not in fields:
                fields.append('id')
            return list(queryset.values(*fields)[:limit])
        
        results = queryset[:limit]
        output = []
        for obj in results:
            if hasattr(obj, 'to_dict'):
                output.append(obj.to_dict())
            else:
                item = {}
                for field in obj._meta.fields:
                    item[field.name] = getattr(obj, field.name)
                output.append(item)
        return output

class ExternalRestEngine(BaseQueryEngine):
    """
    Query engine for external REST APIs with paging support and authentication.
    """
    def execute(self, query_dsl: str, config: Dict[str, Any]) -> List[Dict[str, Any]]:
        base_url = config.get('base_url') or config.get('baseUrl', '')
        endpoint = query_dsl
        headers = (config.get('headers') or {}).copy()
        params = (config.get('params') or {}).copy()
        
        # Handle Authentication
        auth_type = config.get('authType', 'none')
        auth = None
        
        if auth_type == 'basic':
            from requests.auth import HTTPBasicAuth
            auth = HTTPBasicAuth(config.get('username', ''), config.get('password', ''))
        elif auth_type == 'bearer':
            token = config.get('token', '')
            headers['Authorization'] = f"Bearer {token}"
        elif auth_type == 'apiKey':
            header_name = config.get('apiKeyHeader', 'X-API-KEY')
            headers[header_name] = config.get('apiKeyValue', '')
        
        paging_config = config.get('paging', {})
        paging_type = paging_config.get('type')
        
        all_results = []
        max_pages = paging_config.get('maxPages', paging_config.get('max_pages', 1))
        
        current_page = 1
        while current_page <= max_pages:
            if paging_type == 'page':
                params[paging_config.get('pageParam', 'page')] = current_page
            elif paging_type == 'limit_offset':
                page_size = paging_config.get('pageSize', 20)
                params[paging_config.get('limitParam', 'limit')] = page_size
                params[paging_config.get('offsetParam', 'offset')] = (current_page - 1) * page_size
            
            url = f"{base_url.rstrip('/')}/{endpoint.lstrip('/')}"
            
            try:
                response = requests.get(url, headers=headers, params=params, auth=auth, timeout=10)
                response.raise_for_status()
                data = response.json()
                
                page_results = []
                if isinstance(data, list):
                    page_results = data
                elif isinstance(data, dict):
                    found = False
                    for key in ['results', 'items', 'data']:
                        if key in data and isinstance(data[key], list):
                            page_results = data[key]
                            found = True
                            break
                    if not found:
                        page_results = [data]
                
                if not page_results:
                    break
                    
                all_results.extend(page_results)
                
                # Check if we have more pages
                if paging_type == 'page' and isinstance(data, dict):
                    if 'next' in data and not data['next']:
                        break
                
                current_page += 1
            except Exception as e:
                # Log error
                break
                
        return all_results

class ExternalDatabaseEngine(BaseQueryEngine):
    """
    Query engine for external databases.
    Placeholder for database specific execution.
    """
    def execute(self, query_dsl: str, config: Dict[str, Any]) -> List[Dict[str, Any]]:
        # This would use sqlalchemy or direct drivers based on config.get('dbType')
        # Using config.get('host'), config.get('port'), config.get('username'), config.get('password'), config.get('databaseName')
        return []

def get_engine(connection_type: str) -> BaseQueryEngine:
    if connection_type == 'INTERNAL':
        return InternalQueryEngine()
    if connection_type == 'EXTERNAL_REST':
        return ExternalRestEngine()
    if connection_type == 'EXTERNAL_DB':
        return ExternalDatabaseEngine()
    raise ValueError(f"Unknown connection type: {connection_type}")

