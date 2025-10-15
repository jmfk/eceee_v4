# Schema Save Button Debug Instructions

## Changes Made

I've added comprehensive console logging to help identify why the Schema Save button is always enabled and not functioning. The changes include:

### Files Modified

1. **frontend/src/components/ObjectTypeForm.jsx**
   - Added logging to `handleSchemaChange` to track when schema changes are detected
   - Added logging to `handleSaveSchema` to track the save flow and identify where it fails
   - Added logging during initialization to track originalSchema setup

2. **frontend/src/components/schema-editor/SchemaEditor.jsx**
   - Added logging to `handlePropertiesChange` to track when onChange is called
   - Added logging to the schema prop change useEffect
   - Fixed missing dependencies in useEffect

## Testing Steps

### Step 1: Open Browser Console

1. Open your application in a browser (Chrome/Firefox recommended)
2. Open Developer Tools (F12 or Cmd+Option+I on Mac)
3. Go to the Console tab
4. Clear the console

### Step 2: Navigate to Object Type Editor

1. Navigate to an existing object type's editor page
2. Click on the "Schema Fields" tab
3. Watch the console output

### Step 3: Check Initial State

Look for these log messages in the console:

```
[ObjectTypeForm] Setting originalSchema on mount
[ObjectTypeForm] Initialized with hasUnsavedSchemaChanges = false
[SchemaEditor] Schema prop changed, updating properties
```

**Question 1:** Does `hasUnsavedSchemaChanges` start as false?

**Question 2:** Does the SchemaEditor log show it's receiving the schema?

### Step 4: Wait a Few Seconds

After the page loads, watch for any additional logs that appear automatically (without you making any changes).

**Question 3:** Do you see any `[ObjectTypeForm] handleSchemaChange called` logs appearing automatically?

**Question 4:** If yes, what do the schemas look like? Copy the log output.

### Step 5: Check Save Button State

Look at the Save Schema button:

**Question 5:** Is the button enabled (not grayed out)?

**Question 6:** If you hover over it, does it show any tooltip?

### Step 6: Click Save Button

Click the "Save Schema" button and watch the console.

**Question 7:** Do you see `[ObjectTypeForm] handleSaveSchema called`?

**Question 8:** What logs appear after clicking? Look for:
- "Cannot save schema: objectType is null/undefined"
- "No unsaved changes detected"
- "Already saving"
- "Schema validation failed"
- "Calling API to update schema"
- "Schema saved successfully"
- "Failed to save schema"

### Step 7: Make an Actual Change

Now try making a real change to the schema:
1. Add a new property or edit an existing one
2. Watch for `[ObjectTypeForm] handleSchemaChange called` in console
3. Click Save again
4. Watch for the save flow logs

## What to Look For

### Root Cause #1: False Change Detection

If you see `handleSchemaChange` being called immediately on page load:
- Check the logged schemas (newSchema vs originalSchema)
- They should be identical on load
- If they differ, note the differences

**Likely cause:** Schema transformation in SchemaEditor is changing the structure

### Root Cause #2: Silent Early Return

If you see `handleSaveSchema called` but then:
- "Cannot save schema: objectType is null/undefined" → Object type not loaded properly
- "No unsaved changes detected" → hasUnsavedSchemaChanges is false (shouldn't happen if button is enabled)
- "Already saving" → Race condition
- "Schema validation failed" → Check what validation error is shown

### Root Cause #3: API Error

If you see "Calling API to update schema" followed by "Failed to save schema":
- Look at the error details in the console
- Check the network tab for the API call
- Note the HTTP status code and error message

### Root Cause #4: Missing objectType

If you see "Cannot save schema: objectType is null/undefined":
- The object type didn't load properly
- Check if the page URL is correct
- Check if there are any errors in the network tab

## Expected Behavior

After identifying the root cause:

1. **If schemas differ on load:** We need to fix schema transformation
2. **If validation fails silently:** We need to display validation errors better
3. **If API fails:** We need to check backend and network
4. **If objectType is null:** We need to fix data loading

## Success Criteria

After fixes:
- Console shows `hasUnsavedSchemaChanges = false` on initial load
- Save button is disabled (grayed out) when no changes are made
- Save button becomes enabled only after making actual changes
- Clicking save shows either success alert or clear error message
- Console logs show the complete flow without unexpected calls

## Next Steps

After you complete the testing and collect the console logs:

1. Copy all relevant console output
2. Note which Question numbers had issues
3. Share the findings so we can implement the appropriate fix

The comprehensive logging will help us pinpoint the exact issue and implement a targeted fix.

