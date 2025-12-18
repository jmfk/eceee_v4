from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from .models import Form, FormSubmission, FormFieldType
from .serializers import FormSerializer, FormSubmissionSerializer, FormFieldTypeSerializer
from .actions import registry
from .logic import evaluate_logic_group

class FormFieldTypeViewSet(viewsets.ModelViewSet):
    """
    API endpoint for managing form field types.
    """
    queryset = FormFieldType.objects.all()
    serializer_class = FormFieldTypeSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        tenant = getattr(self.request, "tenant", None)
        # Return system-wide types AND tenant-specific types
        from django.db.models import Q
        return self.queryset.filter(Q(tenant=tenant) | Q(tenant__isnull=True))

    def perform_create(self, serializer):
        serializer.save(tenant=getattr(self.request, "tenant", None))

class FormViewSet(viewsets.ModelViewSet):
    """
    API endpoint for managing forms.
    """
    queryset = Form.objects.all()
    serializer_class = FormSerializer
    permission_classes = [permissions.IsAuthenticated]
    lookup_field = "name"

    @action(detail=False, methods=["get"], url_path="data-sources")
    def data_sources(self, request):
        """
        Returns available data sources for form fields.
        """
        from utils.models import ValueList
        from object_storage.models import ObjectTypeDefinition
        
        tenant = getattr(request, "tenant", None)
        
        value_lists = ValueList.objects.all()
        if tenant:
            value_lists = value_lists.filter(tenant=tenant)
            
        object_types = ObjectTypeDefinition.objects.filter(is_active=True)
        # Object types don't have tenant yet in the model I saw earlier, 
        # but let's check if it was added.
        
        return Response({
            "valueLists": [{"id": vl.id, "name": vl.name, "label": vl.label} for vl in value_lists],
            "objectTypes": [{"id": ot.id, "name": ot.name, "label": ot.label} for ot in object_types]
        })

    def get_queryset(self):
        # Filter by tenant if available
        tenant = getattr(self.request, "tenant", None)
        if tenant:
            return self.queryset.filter(tenant=tenant)
        return self.queryset

    def perform_create(self, serializer):
        serializer.save(
            created_by=self.request.user,
            tenant=getattr(self.request, "tenant", None)
        )

class FormSubmissionViewSet(viewsets.ModelViewSet):
    """
    API endpoint for form submissions.
    """
    queryset = FormSubmission.objects.all()
    serializer_class = FormSubmissionSerializer
    permission_classes = [permissions.AllowAny] # Public submissions allowed

    def get_queryset(self):
        tenant = getattr(self.request, "tenant", None)
        if tenant:
            return self.queryset.filter(tenant=tenant)
        return self.queryset

    def create(self, request, *args, **kwargs):
        # Public submission logic
        form_name = request.data.get("form_name")
        if not form_name:
            return Response({"error": "form_name is required"}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            form = Form.objects.get(name=form_name, is_active=True)
        except Form.DoesNotExist:
            return Response({"error": "Form not found or inactive"}, status=status.HTTP_404_NOT_FOUND)
        
        data = request.data.get("data", {})
        
        # Validate data against form.fields
        errors = self.validate_submission(form, data)
        if errors:
            return Response({"errors": errors}, status=status.HTTP_400_BAD_REQUEST)
        
        submission = FormSubmission.objects.create(
            form=form,
            data=data,
            metadata={
                "ip": request.META.get("REMOTE_ADDR"),
                "user_agent": request.META.get("HTTP_USER_AGENT"),
            },
            tenant=form.tenant
        )
        
        # Trigger actions
        self.trigger_actions(submission)
        
        return Response(FormSubmissionSerializer(submission).data, status=status.HTTP_201_CREATED)

    def validate_submission(self, form, data):
        """
        Validates the submitted data against form field definitions.
        """
        errors = {}
        for field in form.fields:
            name = field.get("name")
            if not name:
                continue
                
            label = field.get("label", name)
            validation = field.get("validation", {})
            required = validation.get("required", False)
            
            val = data.get(name)
            
            if required and (val is None or val == "" or (isinstance(val, list) and not val)):
                errors[name] = f"{label} is required."
                continue
            
            if val is not None and val != "":
                field_type = field.get("type")
                
                if field_type == "number":
                    try:
                        num_val = float(val)
                        min_val = validation.get("min")
                        max_val = validation.get("max")
                        if min_val is not None and num_val < float(min_val):
                            errors[name] = f"{label} must be at least {min_val}."
                        if max_val is not None and num_val > float(max_val):
                            errors[name] = f"{label} must be at most {max_val}."
                    except (ValueError, TypeError):
                        errors[name] = f"{label} must be a number."
                elif field_type == "email":
                    import re
                    if not re.match(r"[^@]+@[^@]+\.[^@]+", str(val)):
                        errors[name] = f"{label} must be a valid email address."
                elif field_type in ["select", "radio"]:
                    options = field.get("options", [])
                    if options and val not in options:
                        errors[name] = f"{label} has an invalid selection."
                elif field_type == "multiselect":
                    if not isinstance(val, list):
                        errors[name] = f"{label} must be a list of values."
                    else:
                        options = field.get("options", [])
                        if options:
                            invalid = [v for v in val if v not in options]
                            if invalid:
                                errors[name] = f"{label} contains invalid selections."
                
                # Regex validation
                pattern = validation.get("pattern")
                if pattern:
                    import re
                    try:
                        if not re.match(pattern, str(val)):
                            errors[name] = validation.get("pattern_message", f"{label} has an invalid format.")
                    except re.error:
                        # If regex is invalid, skip or log?
                        pass
        
        return errors

    def trigger_actions(self, submission):
        """
        Triggers actions configured for the form, respecting conditional logic.
        """
        form = submission.form
        actions = form.actions
        log = []
        has_error = False

        for action_config in actions:
            action_type = action_config.get("type")
            config = action_config.get("config", {})
            conditions = action_config.get("conditions") # Logic group
            
            # Check conditions if any
            if conditions:
                should_run = evaluate_logic_group(conditions, submission.data)
                if not should_run:
                    log.append({
                        "type": action_type,
                        "success": True,
                        "message": "Action skipped due to conditions.",
                        "timestamp": timezone.now().isoformat()
                    })
                    continue
            
            success, message = registry.execute(action_type, submission, config)
            log.append({
                "type": action_type,
                "success": success,
                "message": message,
                "timestamp": timezone.now().isoformat()
            })
            
            if not success:
                has_error = True

        submission.processing_log = log
        submission.status = "error" if has_error else "processed"
        submission.save(update_fields=["processing_log", "status"])

