from rest_framework import serializers
from .models import DataConnection, DataStream, DataTransformer
from object_storage.models import ObjectTypeDefinition

class DataTransformerSerializer(serializers.ModelSerializer):
    class Meta:
        model = DataTransformer
        fields = '__all__'

class DataStreamSerializer(serializers.ModelSerializer):
    workflow = serializers.JSONField(required=False, default=list, allow_null=True)

    class Meta:
        model = DataStream
        fields = '__all__'

class DataConnectionSerializer(serializers.ModelSerializer):
    streams = DataStreamSerializer(many=True, read_only=True)
    
    class Meta:
        model = DataConnection
        fields = '__all__'

class DataConnectionListSerializer(serializers.ModelSerializer):
    stream_count = serializers.IntegerField(source='streams.count', read_only=True)
    
    class Meta:
        model = DataConnection
        fields = ['id', 'name', 'connection_type', 'is_active', 'stream_count', 'updated_at']

