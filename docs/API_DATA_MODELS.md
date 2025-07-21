# API Data Models & Validation System

This document describes the comprehensive data model system implemented to ensure consistency between frontend and backend API responses.

## 🎯 Problem Solved

The issue was that `hostnames` field was defined in the Django model but not included in any of the DRF serializers, causing it to be missing from API responses.

## ✅ Solution Implemented

### 1. Backend Improvements

#### Added `hostnames` to all page serializers:
- `WebPageTreeSerializer` - for tree views
- `WebPageDetailSerializer` - for detailed views  
- `WebPageListSerializer` - for list views
- `PageHierarchySerializer` - for hierarchy views

#### Created Pydantic models in `backend/webpages/json_models.py`:
```python
class WebPageTreeResponse(BaseModel):
    id: int
    title: str
    slug: str
    hostnames: List[str] = Field(default_factory=list)
    # ... other fields
```

### 2. Frontend Improvements

#### TypeScript interfaces in `frontend/src/types/api.ts`:
```typescript
export interface WebPageTreeResponse {
  id: number;
  title: string;
  slug: string;
  hostnames: string[];
  // ... other fields
}
```

#### Validation utilities in `frontend/src/utils/apiValidation.js`:
- `isValidPageResponse()` - validates page objects
- `sanitizePageData()` - ensures consistent data structure
- `getPageDisplayUrl()` - handles hostname/slug display logic
- `isRootPage()` - checks if page is root level

### 3. Component Updates

Updated `PageTreeNode.jsx` to:
- Use validation utilities for consistent data handling
- Simplified hostname display logic
- Proper type checking for root pages

## 🔧 API Response Structure

### Root Pages
```json
{
  "id": 1,
  "title": "Home Page",
  "slug": "home", 
  "hostnames": ["example.com", "www.example.com"],
  "children_count": 3
}
```

### Child Pages  
```json
{
  "id": 2,
  "title": "About",
  "slug": "about",
  "hostnames": [],
  "parent": 1,
  "children_count": 0
}
```

## 🎯 UI Display Logic

- **Root pages with hostnames**: Shows first hostname (e.g., "example.com")
- **Root pages without hostnames**: Shows "(hostname missing)" 
- **Child pages**: Shows URL path (e.g., "/about")

## ✅ Benefits

1. **Type Safety**: TypeScript interfaces ensure compile-time type checking
2. **Data Validation**: Runtime validation catches API inconsistencies
3. **Consistent Structure**: All components receive sanitized, consistent data
4. **Error Prevention**: Missing fields are detected and handled gracefully
5. **Maintainability**: Clear contracts between frontend and backend

## 🚀 Usage

### In Components:
```javascript
import { sanitizePageData, getPageDisplayUrl } from '../utils/apiValidation.js';

const page = sanitizePageData(rawPageData);
const displayUrl = getPageDisplayUrl(page);
```

### For API Calls:
```javascript
import { isValidPaginatedResponse } from '../utils/apiValidation.js';

const response = await api.get('/api/pages/');
if (isValidPaginatedResponse(response.data)) {
  // Process valid response
} else {
  // Handle invalid response
}
```

## 🔍 Validation Features

- **Required field checking**: Ensures all required fields are present
- **Type validation**: Verifies field types match expectations  
- **Array sanitization**: Ensures `hostnames` is always an array
- **Null handling**: Properly handles null/undefined values
- **Console warnings**: Logs validation failures for debugging

This system ensures robust, type-safe communication between frontend and backend! 