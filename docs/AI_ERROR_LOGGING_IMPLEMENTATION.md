# AI Error Logging Implementation

## Overview

Enhanced the AI tracking system to capture comprehensive error information including error codes, full tracebacks, and failure statistics for debugging AI API call failures.

## What Was Implemented

### 1. Database Schema Changes

#### AIUsageLog Model
Added fields to capture detailed error information:
- `error_code` - Exception class name (e.g., "NotFoundError", "RateLimitError", "OpenAIError")
- `error_traceback` - Full Python traceback for debugging

The existing `error_message` field stores the error message string.

#### AIPromptConfig Model
Added comprehensive failure tracking:
- `total_failed_calls` - Counter for failed attempts
- `last_error_message` - Most recent error message
- `last_error_code` - Most recent exception type
- `last_error_traceback` - Most recent full traceback
- `last_failed_at` - Timestamp of last failure
- `consecutive_failures` - Track consecutive failures (resets on success)
- `failure_rate` - Property that calculates percentage of failed calls

### 2. Backend Error Capture

#### AIClient Service Updates
Enhanced both `call()` and `acall()` methods to:
- Import and use Python's `traceback` module
- Capture error codes using `type(e).__name__`
- Capture full tracebacks using `traceback.format_exc()`
- Update AIPromptConfig with failure details
- Reset `consecutive_failures` to 0 on successful calls
- Store all error information in both AIUsageLog and AIPromptConfig

### 3. Admin Interface Updates

#### AIUsageLogAdmin
- Added `error_code_display` to list view with red highlighting for failed calls
- Added `error_code` and `error_traceback` to readonly fields
- Made "Error Information" fieldset visible (not collapsed) for easy debugging
- Color-coded error display: Red for failed calls

#### AIPromptConfigAdmin
- Added failure statistics to list view:
  - `total_failed_calls`
  - `failure_rate_display` - Color-coded (red >50%, orange >20%, normal otherwise)
  - `consecutive_failures_display` - Alert icon (⚠️) for 3+ consecutive failures
- Added new "Failure Tracking" fieldset with all error details
- Made all failure fields readonly

## How to Use

### Viewing Failed AI Calls

#### In Django Admin - AIUsageLog
1. Navigate to Django Admin → AI Tracking → AI Usage Logs
2. Filter by `was_successful = False` to see only failed calls
3. Click on any failed call to see:
   - Error code (exception type)
   - Error message
   - **Full traceback** for debugging

#### In Django Admin - AIPromptConfig
1. Navigate to Django Admin → AI Tracking → AI Prompt Configurations
2. View columns:
   - **Total Failed Calls** - Number of failures
   - **Failure Rate** - Percentage with color coding
   - **Consecutive Fails** - Shows ⚠️ if 3+ failures in a row
3. Click on any prompt type to see:
   - Last error details (code, message, traceback)
   - Last failure timestamp
   - All statistics in "Failure Tracking" section

### API Usage

The error logging is automatic - no code changes needed in calling code. Just use AIClient as normal:

```python
from ai_tracking.services import AIClient

client = AIClient(
    provider="openai",
    model="gpt-4o-mini",
    user=request.user,
    prompt_type="my_prompt_type"
)

try:
    result = client.call(
        prompt="Your prompt here",
        task_description="What this AI call does",
        store_full_data=True
    )
except Exception as e:
    # Error is automatically logged with:
    # - Error code (exception class name)
    # - Full traceback
    # - Updated failure statistics
    pass
```

### Understanding Failure Statistics

#### Failure Rate
- **Red (>50%)**: High failure rate - investigate immediately
- **Orange (>20%)**: Moderate failures - monitor closely
- **Normal (0-20%)**: Acceptable failure rate

#### Consecutive Failures
- **⚠️ 3+ failures**: Prompt type is consistently failing - urgent attention needed
- **1-2 failures**: Isolated failures - monitor
- **0**: Last call succeeded - consecutive failures reset

## Database Migration

Migration file created: `ai_tracking/migrations/0004_aipromptconfig_consecutive_failures_and_more.py`

Applied with:
```bash
docker-compose exec backend python manage.py migrate ai_tracking
```

## Files Modified

1. `backend/ai_tracking/models.py` - Added error tracking fields to both models
2. `backend/ai_tracking/services/ai_client.py` - Enhanced exception handlers
3. `backend/ai_tracking/admin.py` - Added failure displays with color coding
4. Migration file created automatically

## Testing

Verified with test script that:
- ✅ Error codes (exception class names) are captured
- ✅ Full tracebacks are stored for debugging
- ✅ Failure statistics are tracked in AIPromptConfig
- ✅ Both AIUsageLog and AIPromptConfig updated on failure
- ✅ Consecutive failures reset on success

## Example Output

When a call fails with an invalid model:

**AIUsageLog Entry:**
```
was_successful: False
error_code: NotFoundError
error_message: Error code: 404 - {'error': {'message': 'The model `non-existent-model-xyz` does not exist...'}}
error_traceback: [Full Python traceback - 1366 chars]
```

**AIPromptConfig Entry:**
```
total_calls: 5
total_failed_calls: 2
failure_rate: 40.0%
consecutive_failures: 1
last_error_code: NotFoundError
last_error_message: Error code: 404 - {'error': {'message': 'The model `non-existent-model-xyz`...'}}
last_error_traceback: [Full Python traceback]
last_failed_at: 2025-10-28 09:43:33
```

## Benefits

1. **Debugging**: Full tracebacks make it easy to identify root causes
2. **Monitoring**: Failure rates and consecutive failures highlight problematic prompt types
3. **Visibility**: Color-coded admin interface makes issues immediately obvious
4. **Tracking**: Historical failure data helps identify patterns
5. **Automation**: No code changes needed - works automatically for all AI calls

## Notes

- Tracebacks are stored as full text for complete debugging information
- Consecutive failures are reset to 0 on any successful call
- Failure rate is calculated as a property, not a stored field
- Both sync and async AI calls are supported
- Admin interface uses color coding (red/orange) to highlight issues

