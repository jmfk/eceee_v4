# Backend Debug Logging Implementation

## Problem

The backend is rejecting the schema with the error:
```
Required property 'presentationalPublishingDate' not found in properties
```

This suggests that either:
1. The property keys in the `properties` object are being converted (e.g., to snake_case)
2. The `required` array items are not being converted
3. Something else is transforming the data between frontend and validation

## Solution: Comprehensive Debug Logging

Added extensive print statements to track exactly what the backend receives and how it validates it.

### Files Modified

#### 1. `backend/object_storage/serializers.py`

Added logging in the `validate_schema` method (lines 207-228):

```python
def validate_schema(self, value):
    """Validate schema structure using the general schema system"""
    # DEBUG: Print what we received
    print("\n" + "="*80)
    print("[SCHEMA DEBUG - SERIALIZER] Received schema for validation")
    print("="*80)
    print(f"Schema type: {value.get('type')}")
    print(f"Properties keys: {list(value.get('properties', {}).keys())}")
    print(f"Required array: {value.get('required', [])}")
    print(f"PropertyOrder array: {value.get('propertyOrder', [])}")
    print("\nFull properties object:")
    for key, prop in value.get('properties', {}).items():
        print(f"  {key}: type={prop.get('type')}, field_type={prop.get('field_type')}, title={prop.get('title')}")
    print("="*80 + "\n")
```

This shows:
- What schema type was received
- All property keys in the properties object
- The required array
- The propertyOrder array
- Details of each property (type, field_type, title)

#### 2. `backend/utils/schema_system.py`

Added logging in the `_validate_references` method (lines 739-766):

```python
@staticmethod
def _validate_references(schema: Dict[str, Any]) -> None:
    """Validate that required and propertyOrder reference existing properties"""
    property_names = set(schema["properties"].keys())
    
    print("\n" + "-"*80)
    print("[VALIDATION DEBUG] Checking required/propertyOrder references")
    print("-"*80)
    print(f"Property names in schema: {sorted(property_names)}")
    print(f"Required array: {schema.get('required', [])}")
    print(f"PropertyOrder array: {schema.get('propertyOrder', [])}")

    # Validate required array
    for req_prop in schema.get("required", []):
        print(f"[VALIDATION DEBUG] Checking if required property '{req_prop}' exists...")
        if req_prop not in property_names:
            print(f"[VALIDATION DEBUG] ❌ NOT FOUND! '{req_prop}' not in {sorted(property_names)}")
            raise ValidationError(...)
        print(f"[VALIDATION DEBUG] ✓ Found '{req_prop}'")
```

This shows:
- All property names available in the schema
- Each required property being checked
- Whether each property is found or not
- Sorted lists for easy comparison

## Expected Output

When you save the schema now, check your backend console/logs. You'll see output like:

```
================================================================================
[SCHEMA DEBUG - SERIALIZER] Received schema for validation
================================================================================
Schema type: object
Properties keys: ['presentationalPublishingDate', 'authors', 'priority']
Required array: ['presentationalPublishingDate']
PropertyOrder array: ['presentationalPublishingDate', 'authors', 'priority']

Full properties object:
  presentationalPublishingDate: type=string, field_type=datetime, title=Publishing Date
  authors: type=array, field_type=object_reference, title=Authors
  priority: type=boolean, field_type=boolean, title=Priority Column
================================================================================

--------------------------------------------------------------------------------
[VALIDATION DEBUG] Checking required/propertyOrder references
--------------------------------------------------------------------------------
Property names in schema: ['authors', 'presentationalPublishingDate', 'priority']
Required array: ['presentationalPublishingDate']
PropertyOrder array: ['presentationalPublishingDate', 'authors', 'priority']
[VALIDATION DEBUG] Checking if required property 'presentationalPublishingDate' exists...
[VALIDATION DEBUG] ✓ Found 'presentationalPublishingDate'
[VALIDATION DEBUG] Checking if propertyOrder property 'presentationalPublishingDate' exists...
[VALIDATION DEBUG] ✓ Found 'presentationalPublishingDate'
[VALIDATION DEBUG] Checking if propertyOrder property 'authors' exists...
[VALIDATION DEBUG] ✓ Found 'authors'
[VALIDATION DEBUG] Checking if propertyOrder property 'priority' exists...
[VALIDATION DEBUG] ✓ Found 'priority'
--------------------------------------------------------------------------------

[SCHEMA DEBUG - SERIALIZER] Validation passed!
```

OR if there's a mismatch:

```
Property names in schema: ['presentational_publishing_date', 'authors', 'priority']
Required array: ['presentationalPublishingDate']
[VALIDATION DEBUG] ❌ NOT FOUND! 'presentationalPublishingDate' not in ['authors', 'presentational_publishing_date', 'priority']
```

## What to Look For

### Case 1: Keys Match
If the keys match exactly, the validation should pass. If it still fails, there's something else wrong.

### Case 2: Keys Don't Match (Most Likely)
If you see:
- `properties` has `presentational_publishing_date` (snake_case)
- `required` has `presentationalPublishingDate` (camelCase)

Then we've confirmed the hypothesis! Something is converting property keys but not the required array.

### Case 3: Keys Missing Entirely
If a property key is completely missing from the properties object, that's a different bug in the schema conversion.

## Next Steps After Checking Logs

1. **Save the schema** in the UI
2. **Check the backend console** for the debug output
3. **Copy the full output** and share it
4. Based on what we see, we'll know if we need to:
   - Fix case conversion in the backend
   - Fix the frontend to send everything in snake_case
   - Fix the validation to be case-insensitive
   - Something else entirely

## How to View Backend Logs

If running with Docker:
```bash
docker-compose logs -f backend
```

Or if running Django directly:
```bash
# The logs will appear in the terminal where you ran manage.py runserver
```

The debug output will be printed to stdout/stderr and should be visible in your backend logs.

