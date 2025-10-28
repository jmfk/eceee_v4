# AI Prompt Tracking Configuration System - Implementation Summary

## Overview

Successfully implemented a granular control system for AI cost logging on a per-prompt-type basis. Each unique prompt type (e.g., "extract_page_metadata", "generate_image_metadata") now has its own configuration object that controls logging behavior.

## What Was Implemented

### 1. New Model: AIPromptConfig

**Location**: `backend/ai_tracking/models.py`

A new Django model that provides:
- **Unique prompt type identification** via `prompt_type` field (stable identifier)
- **Toggle controls**:
  - `track_full_data`: Controls whether full prompt/response data is stored in AIUsageLog
  - `is_active`: Controls whether AIUsageLog entries are created at all
- **Latest call data storage** (always updated regardless of tracking settings):
  - `last_prompt`, `last_response`
  - `last_input_tokens`, `last_output_tokens`, `last_cost`
  - `last_user`, `last_metadata`, `last_called_at`, `last_duration_ms`
- **Statistics tracking**:
  - `total_calls`: Total number of calls made
  - `total_cost`: Cumulative cost of all calls
  - Computed property: `avg_cost_per_call`

### 2. Updated AIClient Service

**Location**: `backend/ai_tracking/services/ai_client.py`

Enhanced the AI client to:
- Accept optional `prompt_type` parameter in `__init__()`
- Auto-create `AIPromptConfig` on first use via `get_or_create()`
- Update config's latest call data on every call (success or failure)
- Respect config's `track_full_data` setting for AIUsageLog storage
- Skip AIUsageLog creation when `is_active=False` (but still track in config)
- Increment statistics (`total_calls`, `total_cost`) on every call
- Support both sync (`call()`) and async (`acall()`) methods

### 3. Updated OpenAIService

**Location**: `backend/content_import/services/openai_service.py`

Modified to pass explicit `prompt_type` for all AI calls:
- `analyze_image_layout` → `prompt_type="analyze_image_layout"`
- `extract_page_metadata` → `prompt_type="extract_page_metadata"`
- `generate_image_metadata` → `prompt_type="generate_image_metadata"`
- `generate_file_metadata` → `prompt_type="generate_file_metadata"`
- `select_best_tags` → `prompt_type="select_best_tags"`

### 4. Django Admin Interface

**Location**: `backend/ai_tracking/admin.py`

Created comprehensive admin interface with:
- **List view** showing:
  - `prompt_type`, `track_full_data`, `is_active`
  - `total_calls`, `total_cost`, `avg_cost`
  - `last_called_at`
- **Detail view** with fieldsets:
  - Configuration (prompt_type, description, toggles)
  - Latest Call Data (collapsible, shows all last_* fields)
  - Statistics (total calls, costs, averages)
- **Filters**: track_full_data, is_active, created_at
- **Search**: prompt_type, description

### 5. Database Migration

**Location**: `backend/ai_tracking/migrations/0003_aipromptconfig.py`

Created and applied migration to add the new model to the database.

## How It Works

### Auto-Creation Flow

1. Developer creates `AIClient` with `prompt_type="my_prompt_type"`
2. On first call, `AIPromptConfig.objects.get_or_create()` runs
3. New config object is created with defaults:
   - `track_full_data=False` (don't store full data by default)
   - `is_active=True` (create logs by default)
   - `description` set from `task_description`

### Call Tracking Flow

Every AI call follows this flow:

1. **Get/Create Config**: Load or create `AIPromptConfig` for the `prompt_type`
2. **Determine Storage**: Use config's `track_full_data` setting (unless explicitly overridden)
3. **Make API Call**: Execute the actual AI API request
4. **Update Config**: Always update latest call data in config object
5. **Update Statistics**: Increment `total_calls` and `total_cost`
6. **Create Log** (conditional): Only create `AIUsageLog` if `is_active=True`

### Latest Data Always Stored

Even when `track_full_data=False` or `is_active=False`, the config object always stores:
- The most recent prompt and response
- Token counts and cost
- User, timestamp, duration, metadata

This provides a debugging reference without bloating the database.

## Usage Examples

### In Code

```python
from ai_tracking.services import AIClient

# Create client with prompt type
ai_client = AIClient(
    provider="openai",
    model="gpt-4o-mini",
    user=request.user,
    prompt_type="my_custom_prompt"  # Stable identifier
)

# Make tracked call
result = ai_client.call(
    prompt="Your prompt here",
    task_description="What this prompt does",
    # store_full_data can be overridden here if needed
)
```

### In Django Admin

1. Navigate to **AI Tracking → AI Prompt Configurations**
2. See all auto-created prompt types
3. Click on any prompt type to:
   - Toggle `track_full_data` to control full prompt/response storage
   - Toggle `is_active` to disable logging entirely
   - View latest call data (most recent prompt/response)
   - See statistics (total calls, total cost, average cost)

## Key Features

### 1. Stable Prompt Type Identification
- Explicit `prompt_type` parameter prevents duplicate configs
- Consistent naming across code ensures single config per prompt type
- No mutation issues from description changes

### 2. Granular Control
- Each prompt type independently controls full data storage
- Can disable logging entirely per prompt type
- Overrides available at call-time if needed

### 3. Always Track Latest
- Config object always stores most recent call data
- Useful for debugging even when logging is off
- Prevents total data loss while controlling storage

### 4. Auto-Creation
- New prompt types automatically create config objects
- No manual setup required
- Immediate visibility in Django admin

### 5. Statistics Tracking
- Total calls and cumulative costs per prompt type
- Average cost per call computed automatically
- Helps identify expensive prompt types

### 6. Backward Compatible
- Existing code without `prompt_type` continues working
- Falls back to global settings
- No breaking changes

## Testing Results

All tests passed successfully:

✅ **Auto-creation**: AIPromptConfig created on first use  
✅ **Latest data storage**: Always stores most recent call data  
✅ **Toggle control (is_active)**: No AIUsageLog when disabled  
✅ **Statistics tracking**: Counts and costs tracked correctly  
✅ **Config updates**: Statistics updated even when logging disabled  

## Files Changed

1. `backend/ai_tracking/models.py` - Added AIPromptConfig model
2. `backend/ai_tracking/services/ai_client.py` - Integrated prompt config
3. `backend/ai_tracking/admin.py` - Added admin interface
4. `backend/content_import/services/openai_service.py` - Added prompt types
5. `backend/ai_tracking/migrations/0003_aipromptconfig.py` - Database migration

## Next Steps (Optional Enhancements)

### 1. Link AIUsageLog to Config
Add a foreign key in `AIUsageLog` to `AIPromptConfig`:
```python
prompt_config = models.ForeignKey(
    'AIPromptConfig',
    on_delete=models.SET_NULL,
    null=True,
    blank=True,
    related_name='usage_logs'
)
```
This would allow viewing all logs for a specific prompt type in the admin.

### 2. Cost Analysis Dashboard
Create views to:
- Compare costs across different prompt types
- Identify most expensive operations
- Track cost trends over time

### 3. Bulk Configuration
Add admin actions to:
- Enable/disable tracking for multiple prompt types
- Bulk update track_full_data settings
- Export prompt configurations

### 4. Alerts Per Prompt Type
Extend `AIBudgetAlert` to support per-prompt-type budgets:
- Alert when a specific prompt type exceeds budget
- Automatically disable expensive prompt types

## Benefits

1. **Cost Control**: Identify and manage expensive AI operations
2. **Debugging**: Always have latest call data for troubleshooting
3. **Flexibility**: Granular control without code changes
4. **Visibility**: Clear view of all prompt types in use
5. **Scalability**: Minimal database growth with selective logging
6. **Stability**: No duplicate configs from code changes

## Conclusion

The AI Prompt Tracking Configuration system provides fine-grained control over AI cost logging while maintaining complete visibility into AI usage. The implementation is backward compatible, easy to use, and provides powerful management capabilities through the Django admin interface.

