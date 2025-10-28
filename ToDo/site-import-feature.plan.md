<!-- ee3aa1ac-5b30-457e-9123-f648ad328de3 479fdca4-3e25-434c-b3c3-b06ea04aeb14 -->
# Site Import Feature

## Overview

Add comprehensive site import capability that recursively crawls websites, creates page hierarchies, and imports content with automatic selector detection and session persistence.

## Backend Implementation

### 1. Database Models (`backend/content_import/models.py`)

Create three new models:

**ImportSession**

- Tracks overall import session state
- Fields: id, start_url, target_page (FK to WebPage, nullable), layout_id (FK to Layout), slot_name, status (pending/running/paused/completed/failed), debug_mode, created_at, updated_at, created_by
- Relationships: has many SiteImportQuery and SiteImportPage

**SiteImportQuery**

- Stores CSS selector queries tried during session
- Fields: id, session (FK), query_string, query_type (css_selector/xpath), success_count, fail_count, is_active, created_at
- Used to try selectors on new pages in order of success rate

**SiteImportPage**

- Tracks individual page import progress
- Fields: id, session (FK), source_url, webpage (FK to WebPage, nullable), parent_url, status (pending/processing/completed/failed), error_message, discovered_at, processed_at
- Stores URL-to-WebPage mapping for hierarchy building

### 2. Selector Generator Service (`backend/content_import/services/selector_generator.py`)

Create intelligent CSS selector from clicked element:

- Build path: tag + class + position relative to parent
- Generate multiple fallback selectors (specific → general)
- Return ranked list of selectors to try
- Example: `div.main-content article.post` or `article:nth-of-type(2)`

### 3. Metadata Extractor Service (`backend/content_import/services/metadata_extractor.py`)

Extract page metadata from HTML:

- Title: `<title>` tag or `<h1>` content
- Description: `<meta name="description">` or first `<p>` text (truncated)
- Keywords/Tags: `<meta name="keywords">` → split into tags array
- Use OpenAI to enhance/clean if available, fallback to HTML parsing

### 4. URL Extractor Service (`backend/content_import/services/url_extractor.py`)

Find all subpage URLs from HTML:

- Parse all `<a href>` links
- Filter to same domain and subdirectories of start URL
- Remove duplicates, anchors, query params (optional)
- Return list of absolute URLs

### 5. API Endpoints (`backend/content_import/views/site_import.py`)

**POST `/api/content-import/site-import/start/`**

- Input: start_url, target_page_id (nullable), layout_id, slot_name, debug_mode
- Creates ImportSession, returns session_id

**POST `/api/content-import/site-import/select-content/`**

- Input: session_id, selected_element_path (from iframe click)
- Generates CSS selectors, saves as SiteImportQuery entries
- Returns query list

**POST `/api/content-import/site-import/process-page/`**

- Input: session_id, page_url
- Tries queries to find content
- If found: imports content, creates WebPage, extracts subpage URLs
- If not found: returns error for user intervention
- Returns: created_page_id, discovered_urls, success status

**GET `/api/content-import/site-import/session/{id}/`**

- Returns session status, progress stats, page list

**POST `/api/content-import/site-import/session/{id}/resume/`**

- Resumes paused/failed session

**DELETE `/api/content-import/site-import/session/{id}/`**

- Cancels session (doesn't delete created pages)

## Frontend Implementation

### 6. Site Import Dialog (`frontend/src/components/SiteImportDialog.jsx`)

Multi-step wizard similar to ImportDialog:

**Step 1: Configuration**

- Start URL input
- Target page selector (dropdown: "Create new root page" or select existing page)
- Layout selector (dropdown of available layouts)
- Slot selector (populated based on selected layout)
- Debug mode checkbox (unchecked by default)

**Step 2: Content Selection**

- Display proxied page in iframe (reuse existing proxy logic)
- User clicks on content block to import
- Show selected element indicator
- On Next: generate selectors, display query list for review

**Step 3: Processing**

- Display progress dashboard:
- Session stats (pages processed/total, success/fail counts)
- Current page being processed
- Queue of pending URLs
- List of completed pages (with links to edit)
- If query fails and debug mode OFF: auto-pause and prompt user
- If debug mode ON: require confirmation at each step
- Pause/Resume/Cancel buttons

**Step 4: Complete**

- Summary of imported pages
- Link to view imported page tree
- Option to start another import

### 7. Integration with TreePageManager (`frontend/src/components/TreePageManager.jsx`)

Add "Site Import" button in header next to "Add root page":

- Icon: Download with arrow or Globe icon from lucide-react
- Tooltip: "Import entire site"
- Opens SiteImportDialog

### 8. Site Import API Client (`frontend/src/api/siteImport.js`)

Add API functions:

- `startSiteImport(config)`
- `selectContent(sessionId, elementData)`
- `processPage(sessionId, url)`
- `getSessionStatus(sessionId)`
- `resumeSession(sessionId)`
- `cancelSession(sessionId)`

## Key Implementation Details

### URL-based Hierarchy

- `/about/team` → find or create `/about`, then create `team` as child
- Split URL path, build hierarchy progressively
- Use slug from URL segment for page creation

### Query Execution Order

- Try queries ordered by success_count DESC
- On success: increment success_count for that query
- On failure: increment fail_count, try next query
- If all fail: pause and alert user

### Metadata Import

- Create PageVersion with imported title/description
- Tags array saved in PageVersion.tags field
- Set meta_title, meta_description from extracted data

### Session Persistence  

- All state in database (ImportSession, queries, pages)
- Can close browser and resume later
- Frontend polls session status during processing

### Debug Mode Behavior

- **OFF (default)**: Fully automatic, only stops on errors
- **ON**: Requires user confirmation before processing each page
- Useful for testing/verification

## Files to Create/Modify

**Backend:**

- Create: `backend/content_import/models.py` (add 3 models)
- Create: `backend/content_import/services/selector_generator.py`
- Create: `backend/content_import/services/metadata_extractor.py`
- Create: `backend/content_import/services/url_extractor.py`
- Create: `backend/content_import/views/site_import.py`
- Modify: `backend/content_import/urls.py` (add site import routes)
- Create: `backend/content_import/serializers.py` (add site import serializers)

**Frontend:**

- Create: `frontend/src/components/SiteImportDialog.jsx`
- Create: `frontend/src/api/siteImport.js`
- Modify: `frontend/src/components/TreePageManager.jsx` (add button)
- Modify: `frontend/src/api/endpoints.js` (add site import endpoints)

**Database:**

- Migration for ImportSession, SiteImportQuery, SiteImportPage models

### To-dos

- [ ] Create ImportSession, SiteImportQuery, and SiteImportPage models with proper relationships and fields
- [ ] Build CSS selector generator service that creates robust selectors from element path
- [ ] Create metadata extractor service for title, description, and tags with AI enhancement
- [ ] Build URL extractor service to find all subpage links from HTML
- [ ] Create site import API endpoints (start, select-content, process-page, session status)
- [ ] Create site import API client functions in frontend
- [ ] Build SiteImportDialog component with 4-step wizard and progress tracking
- [ ] Add Site Import button to TreePageManager header
- [ ] Test complete site import flow with debug mode on/off and error handling