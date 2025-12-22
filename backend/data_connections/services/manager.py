from typing import Any, Dict, List, Optional
from .engine import get_engine
from .transformers import DataTransformerService, ConnectionCacheService
from .workflow import WorkflowEngine
from ..models import DataStream

class DataConnectionManager:
    """
    Orchestrates the data retrieval, workflow execution, and transformation process.
    """
    def __init__(self):
        self.transformer_service = DataTransformerService()
        self.workflow_engine = WorkflowEngine()

    def execute_stream(self, stream_id: int, bypass_cache: bool = False, query_params: Dict[str, Any] = None) -> List[Dict[str, Any]]:
        try:
            stream = DataStream.objects.select_related('connection', 'transformer').get(id=stream_id)
        except DataStream.DoesNotExist:
            return []
        
        return self._run_engine_workflow_transformer(
            stream.connection,
            stream.query_dsl,
            stream.workflow,
            stream.transformer,
            stream.cache_ttl,
            stream_id,
            bypass_cache,
            query_params
        )

    def preview_stream(self, connection_id: int, stream_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Execute a stream with provided data, bypassing cache."""
        from ..models import DataConnection, DataTransformer
        try:
            connection = DataConnection.objects.get(id=connection_id)
        except DataConnection.DoesNotExist:
            return []

        query_dsl = stream_data.get('query_dsl') or stream_data.get('queryDsl', '')
        workflow = stream_data.get('workflow', [])
        transformer_id = stream_data.get('transformer')
        transformer = None
        if transformer_id:
            try:
                transformer = DataTransformer.objects.get(id=transformer_id)
            except DataTransformer.DoesNotExist:
                pass

        return self._run_engine_workflow_transformer(
            connection,
            query_dsl,
            workflow,
            transformer,
            cache_ttl=0,
            stream_id=None,
            bypass_cache=True
        )

    def _run_engine_workflow_transformer(
        self, 
        connection, 
        query_dsl, 
        workflow, 
        transformer, 
        cache_ttl, 
        stream_id=None, 
        bypass_cache=False, 
        query_params=None
    ) -> List[Dict[str, Any]]:
        # 1. Check Cache
        if not bypass_cache and stream_id:
            cached_data = ConnectionCacheService.get(stream_id, query_params)
            if cached_data is not None:
                return cached_data

        # 2. Execute Query
        engine = get_engine(connection.connection_type)
        raw_data = engine.execute(query_dsl, connection.config)

        # 3. Execute Workflow Actions
        if workflow:
            processed_data = self.workflow_engine.execute(raw_data, workflow)
        else:
            processed_data = raw_data if isinstance(raw_data, list) else [raw_data]

        # 4. Transform Data
        if transformer:
            transformed_data = self.transformer_service.transform(processed_data, transformer.config)
        else:
            transformed_data = processed_data

        # 5. Set Cache
        if not bypass_cache and stream_id and cache_ttl > 0:
            ConnectionCacheService.set(stream_id, transformed_data, cache_ttl, query_params)

        return transformed_data

