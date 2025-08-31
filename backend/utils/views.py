"""
General utility API views for the schema system
"""

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from .schema_system import field_registry, register_custom_field_type


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_field_types(request):
    """Get all available field types"""
    field_types = field_registry.get_all_field_types()

    # Convert to API-friendly format
    result = []
    for key, field_info in field_types.items():
        result.append(
            {
                "key": key,
                "label": field_info["label"],
                "jsonSchemaType": field_info["json_schema_type"],
                "uiComponent": field_info["ui_component"],
                "description": field_info["description"],
                "validationRules": field_info["validation_rules"],
            }
        )

    return Response({"fieldTypes": result, "count": len(result)})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def register_field_type(request):
    """Register a new custom field type"""
    try:
        data = request.data

        # Validate required fields
        required_fields = ["key", "label", "jsonSchemaType", "uiComponent"]
        for field in required_fields:
            if field not in data:
                return Response(
                    {"error": f"Missing required field: {field}"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        # Register the field type
        register_custom_field_type(
            key=data["key"],
            label=data["label"],
            json_schema_type=data["jsonSchemaType"],
            ui_component=data["uiComponent"],
            description=data.get("description", ""),
            validation_rules=data.get("validationRules", {}),
        )

        return Response(
            {
                "message": f"Field type '{data['key']}' registered successfully",
                "fieldType": {
                    "key": data["key"],
                    "label": data["label"],
                    "jsonSchemaType": data["jsonSchemaType"],
                    "uiComponent": data["uiComponent"],
                    "description": data.get("description", ""),
                },
            },
            status=status.HTTP_201_CREATED,
        )

    except Exception as e:
        return Response(
            {"error": f"Failed to register field type: {str(e)}"},
            status=status.HTTP_400_BAD_REQUEST,
        )
