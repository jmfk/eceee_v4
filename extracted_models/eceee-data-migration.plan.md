# ECEEE Database Migration - Product Design Review (PDR)

### Object Storage Migration

These content types should be migrated to **ObjectTypeDefinition** instances with appropriate schemas.

**Content Widget Pattern**: All rich text content (descriptions, abstracts, body text, etc.) will be stored in **Content Widgets** rather than in the ObjectInstance schema. The schema should only contain structured metadata fields (dates, numbers, titles, etc.). This provides:
- Consistent content editing experience across all object types
- Widget-based rendering system
- Separation of structured data (schema) from unstructured content (widgets)

#### 1.1 News & Articles (HIGH PRIORITY)

**Source**: `eceeenews.eceeeNews`

- **Migrate To**: ObjectTypeDefinition named "news"
- **Schema Fields**: title, slug, featured_image, external_url, source_date
- **Content Storage**: Content migrated to Content Widget (not in schema)
- **Tag Migration**: 
  - NewsType → tags (default namespace)
  - NewsCategory → tags (default namespace)
  - NewsSource → tags (default namespace)
  - Keywords → tags (default namespace)
  - RelatedNews → related objects via metadata
- **Special Handling**: 
  - presentational_publishing_date → ObjectVersion.effective_date
  - publish_on_front_page → is_featured 
  - eceee_sites → drop
  - content (RichText) → Content Widget in ObjectVersion.widgets

#### 1.2 Calendar Events (HIGH PRIORITY)

**Source**: `eceeecalendar.EceeeCalenderEvent`

- **Migrate To**: ObjectTypeDefinition named "event"
- **Schema Fields**: title, event_type, venue, organiser, event_start_date, event_end_date, priority, quote
- **Content Storage**: Content migrated to Content Widget (not in schema)
- **Tag Migration**:
  - event_type → tags (default namespace)
  - event_categories → tags (default namespace)
  - eceeeCategory → tags (default namespace)

#### 1.3 Jobs (MEDIUM PRIORITY)

**Source**: `eceeejobs.EceeeJobsItem`

- **Migrate To**: ObjectTypeDefinition named "job"
- **Schema Fields**: title, location, deadline, external_url
- **Content Storage**: Description migrated to Content Widget (not in schema)
- **Tag Migration**: Generic categories → tags (default namespace)

#### 1.4 Library Items (HIGH PRIORITY)

**Source**: `eceeelibrary.EceeeLibraryItem`

- **Migrate To**: ObjectTypeDefinition named "library_item"
- **Schema Fields**: title, derivable_number, derivable_title
- **Content Storage**: Content migrated to Content Widget (not in schema)
- **Related Objects**: EceeeLibraryFileItem → as media attachments
- **Tag Migration**: LibraryCategory → tags (default namespace)

#### 1.5 Proceedings & Papers (HIGH PRIORITY - Special Case)

**Source**: `eceeeproceedings.ProceedingPage`, `PanelPage`, `ConferencePage`

- **ConferencePage**: ObjectTypeDefinition named "conference"
- **PanelPage**: ObjectTypeDefinition named "conference_panel" (with parent FK to conference)
- **ProceedingPage**: ObjectTypeDefinition named "paper" (with parent FK to panel)
- **Schema Fields**: 
  - Conference: title, year, venue, isbn, issn, date
  - Panel: title, panel_prefix, panel_leaders
  - Paper: title, authors, doc_nummer, peer_review
- **Content Storage**: 
  - Conference description → Content Widget
  - Panel additional_information → Content Widget
  - Paper abstract → Content Widget
- **Tag Migration**: ProceedingsKeyword → tags (default namespace)
- **Files**: paper/presentation PDFs → media attachments

#### 1.6 Columnists & Columns (MEDIUM PRIORITY)

**Source**: `eceeecolumnists.EceeeColumnist`, `eceeecolumnists.EceeeColumn`

- **EceeeColumnist**: ObjectTypeDefinition named "columnist"
  - **Schema Fields**: 
    - first_name, last_name, prefix
    - affiliation
    - home_page
    - horizontal_photo, vertical_photo, square_photo (choose best available)
    - last_column_date (date of most recent column)
  - **Content Storage**: RichText bio migrated to Content Widget (not in schema)
  - **Tag Migration**: 
    - categories → tags (default namespace)
    - eceee_categories → tags (default namespace)
  
- **EceeeColumn**: ObjectTypeDefinition named "column"
  - **Schema Fields**: 
    - title, slug
    - presentational_publishing_date
    - priority (Boolean)
    - columnist_ids (array of columnist references)
  - **Content Storage**: RichText content migrated to Content Widget (not in schema)
  - **Relationships**: 
    - columnists (M2M) → store columnist IDs in metadata or use parent relationship
    - related_newsitems → store in metadata['related_news']
  - **Tag Migration**: 
    - categories → tags (default namespace)
    - eceee_categories → tags (default namespace)
    - keywords_sub → tags (default namespace)
  - **Special Handling**: 
    - presentational_publishing_date → ObjectVersion.effective_date
    - priority → is_featured or metadata
    - eceee_sites → drop




---

### TIER 2/3: Skip/Archive/System Models

#### 2.1 Core Page Types (SKIP)

**Source**: `eceeebase.WebPage`, `HomePage`, `SubSitePage`, `PlaceholderPage`

#### 2.2 Theme/Project Pages (SKIP)

**Source**: `eceeebase.ThemePage`, `ReportPage`, `ProjectPage`

#### 2.3 Embed Pages (SKIP)

**Source**: `eceeebase.EmbedPage`

#### 3.1 Widget System Models (SKIP - Different Architecture)

- `easywidget.EasyWidget`
- `widget.Widget`
- `orderable.Orderable`
- **Reason**: New system uses code-based widgets

#### 3.2 Category/Tag Infrastructure (SKIP - Migrate Data Only)

- `eceeeKeyword`, `AssignedeceeeKeyword`
- `Category`, `AssignedCategory`
- `eceeeCategory`, `AssignedeceeeCategory`
- All Assigned* models (GenericForeignKey pattern)
- **Reason**: Replaced by simple Tag model with namespaces

#### 3.3 Mixin/Abstract Classes (SKIP - Not Data)

- `AccessLevelMixin`
- `EceeeCategoryMixin`
- `AcquisitionMixin`
- `PagePropertyMixin`
- **Reason**: Not database tables, just Python classes

#### 3.4 Supporting/Infrastructure (SKIP)

- `attachments.AttachmentBase`
- `easyfields.InfoText`
- `pageproperties.PageProperty`
- **Reason**: System models, not content

#### 3.5 Deprecated Content Types (SKIP)

- `eceeebase.NewsSubscription`
- `eceeebase.EcoDesign` (replaced by ecodesign app)
- `eceeebase.CalenderEvent` (replaced by eceeecalendar app)
- **Action**: Export data for reference, don't migrate

#### 3.6 Not Important Content Types (SKIP)

**Sources**: 
- `ecodesign.EcoDesignProduct`
- `eceeeviews.EceeeViews`
- `eceeequotes.eceeeQuotes`, `eceeeQuotesCollection`
- `eceeememberforum.EceeeMemberOrganization`, `EceeeMemberActivity`
- `eceeegalleries.eceeeGallery`, `eceeeGalleryImage`

**Reason**: Not important for migration, can be archived or excluded

#### 3.8 Theme-Specific Models (EVALUATE PER THEME)

- `themes/briskee_models.py` - Briskee project
- `themes/eceee_models.py` - Main ECEEE
- `themes/mbenefits_models.py` - M-Benefits
- `themes/energysufficiency_models.py` - Energy Sufficiency
- **Action**: Evaluate which themes are still active, migrate content accordingly

#### 3.9 Utility Models (SKIP)

- `flexibledatefield` models
- `retinajs` models
- `monkey` models
- `multi_tenent` models
- `catalog` models
- **Reason**: Django app infrastructure, not content

#### 3.10 User Profiles (SKIP)

**Source**: `eceeeaccounts.ProfileModel`

- **Migrate To**: Extend Django User model or create new profile model
- **Priority**: HIGH (but separate from content migration)

---

## Tag/Category Migration Strategy

### Challenge: Complex to Simple

**Old System**:

- Multiple category types per content type
- GenericCategoriesField with Orderable pattern
- ContentType + GenericForeignKey for polymorphic relationships
- Mezzanine's Keyword system

**New System**:

- Single Tag model with default namespace only
- Simple M2M relationships
- Usage tracking

### Migration Approach - Simplified (No Namespaces)

All tags will be migrated to the **default namespace**. Focus on three critical tag types:

1. **Normal Tags** (eceee_category, keywords, etc.)
2. **News Tags** (news_type, news_category, news_source)
3. **Related News** (relationships between news items)

#### Phase 1: Tag Migration Script Structure

```python
def migrate_tags():
    """
    Universal tag migration - all categories become simple tags
    
    1. Get all category instances from all old models
    2. Create Tag for each in default namespace (no namespace prefix)
    3. For each Assigned* instance:
       - Find the new object (ObjectInstance or WebPage)
       - Create tag relationship
    4. Track usage_count
    5. Merge duplicate tag names
    """
    
def migrate_news_tags():
    """
    Migrate news-specific tags
    
    1. NewsType → tags
    2. NewsCategory → tags
    3. NewsSource → tags
    4. Keywords → tags
    """
    
def migrate_related_news():
    """
    Migrate RelatedNews relationships
    
    1. Get all RelatedNews relationships
    2. Store in ObjectInstance metadata or as special tag
    3. Maintain bidirectional relationships
    """
```

#### Phase 2: Data Consolidation

- **Merge duplicate tags**: Consolidate similar names from different sources
- **Clean up**: Remove unused/orphaned tags
- **Validation**: Ensure all content has appropriate tags

---

## Migration Script Architecture

### Script Organization

```
backend/scripts/migration/
├── __init__.py
├── base_migrator.py          # Base class with common functions
├── migrate_tags.py            # Tag/category migration (✅ DONE)
├── migrate_news.py            # News migration with Content Widget
├── migrate_events.py          # Calendar events
├── migrate_library.py         # Library items
├── migrate_proceedings.py     # Papers & conferences
├── migrate_columnists.py      # Columnists & columns
├── migrate_media.py           # Images & files
└── run_full_migration.py      # Orchestrator
```

### Dependencies & Order

1. **Users & Profiles** (separate, run first)
2. **Tags** (migrate all category/tag data to default namespace)
3. **Object Type Definitions** (create schemas - metadata only, no content fields)
4. **Media Files** (images, PDFs)
5. **Object Instances** (content objects with structured data)
6. **Content Widgets** (migrate rich text content to widgets)
7. **Web Pages** (hierarchical pages)
8. **Relationships** (related objects, parent/child)

**Note on Content Migration**: Rich text content should be migrated to Content Widgets attached to ObjectVersions, not stored in the schema's data fields. This ensures consistency with the widget-based rendering system.

### Key Decisions Required

1. **Multi-site Strategy**: 
  - Store site information in metadata field
  - All tags in default namespace

2. **URL Preservation**:
  - Maintain old URL patterns?
  - Create redirects?

3. **Theme Migration**:
  - Which themes are actively used?
  - Consolidate to main ECEEE theme?

4. **Historical Data**:
  - Migrate all historical content?
  - Set cutoff date?

5. **Widget Migration**:
  - Map old widget types to new widgets?
  - Manual review of complex widgets?

---

## Risk Assessment

### High Risk

- **Tag consolidation**: May lose some specificity in categorization
- **Widget migration**: Old widgets may not map cleanly to new system
- **URL preservation**: Need comprehensive redirect mapping
- **Data volume**: 102 models could mean tens of thousands of records

### Medium Risk

- **Multi-tenancy**: Namespace mapping may not perfectly match old site logic
- **Version history**: May lose some historical version data
- **Related content**: Complex relationships need careful mapping

### Low Risk

- **User migration**: Straightforward Django User model
- **Media files**: Direct file copy with metadata
- **Simple content**: News, events straightforward

---

## Success Criteria

1. **Content Integrity**: 100% of priority content migrated
2. **Tag Coverage**: All tagged content maintains categorization
3. **URL Preservation**: All public URLs have redirects
4. **Media Availability**: All images/files accessible
5. **Relationships**: Parent/child and related content preserved
6. **Performance**: New system performs better than old

---

## Timeline Estimate

1. **Phase 1 - Preparation** (1 week)
  - Create object type definitions
  - Set up migration infrastructure
  - Create tag migration script

2. **Phase 2 - Tag Migration** (2 days)
  - Migrate all category/tag data to default namespace
  - Merge duplicate tags
  - Validate tag relationships

3. **Phase 3 - Content Migration** (2 weeks)
  - News, Events, Library (Week 1)
  - Proceedings, Columnists, Jobs (Week 2)

4. **Phase 4 - Media Migration** (3 days)
  - Images and file attachments
  - Update references

5. **Phase 5 - Validation** (1 week)
  - Content review
  - URL testing
  - Performance testing

6. **Phase 6 - Cutover** (2 days)
  - Final sync
  - DNS/routing updates
  - Monitor

**Total**: ~4 weeks for full migration

---

## Next Steps

1. **Review & Approve** this PDR
2. **Answer key decisions** (themes, URLs, etc.)
3. **Create detailed schemas** for each ObjectTypeDefinition
4. **Build migration scripts** starting with tag migration
5. **Test on sample data** before full migration
6. **Plan rollback strategy** in case of issues

### To-dos

- [ ] Review PDR with stakeholders and answer key decisions about theme migration and URL preservation
- [x] Create detailed JSON schemas for each ObjectTypeDefinition (✅ `backend/scripts/migration/schemas/`)
- [x] Create base migration infrastructure with common utilities (✅ `backend/scripts/migration/base_migrator.py`)
- [x] Build tag/category migration scripts (✅ `backend/scripts/migration/migrate_tags.py`)
- [x] Create script to generate ObjectTypeDefinitions (✅ `backend/scripts/migration/create_object_types.py`)
- [ ] Run create_object_types.py to create ObjectTypeDefinitions in database
- [ ] Customize tag migration for legacy schema and run migration
- [ ] Migrate high-priority content: News, Events, Library, Proceedings, Columnists (structured data only)
- [ ] Migrate rich text content to Content Widgets for all objects
- [ ] Migrate all media files (images, PDFs) with proper tagging
- [ ] Validate all migrated content for integrity and completeness
- [ ] Generate URL redirect mapping for old URLs

### Migration Scripts Created

**Location**: `backend/scripts/migration/`

1. **`base_migrator.py`** - Base class with common utilities:
   - Namespace management
   - Tag creation with normalization
   - Duplicate tag merging
   - Migration user management
   - Statistics tracking
   - Dry-run transaction support

2. **`migrate_tags.py`** - Tag migration template:
   - Migrates normal tags (categories, keywords)
   - Migrates news-specific tags
   - Handles related news relationships
   - Outputs tag mapping file for content migration
   - Needs customization for your legacy schema

3. **`migrate_tags_example.py`** - Fully worked examples:
   - Shows how to connect to legacy models
   - Examples for all major tag types
   - Copy patterns into main migration script

4. **`create_object_types.py`** - Create ObjectTypeDefinitions:
   - Loads JSON schemas from schemas/ directory
   - Creates ObjectTypeDefinitions in database
   - Sets up parent-child relationships
   - Dry-run support for testing

5. **`schemas/`** - JSON schemas for all object types:
   - 9 schema files (news, event, job, library_item, conference, conference_panel, paper, columnist, column)
   - README with complete documentation
   - SCHEMAS_INDEX with quick reference
   - All follow Content Widget pattern (no content in schemas)

6. **Documentation**:
   - `README.md` - Tag migration guide
   - `CONTENT_WIDGET_STRATEGY.md` - Content migration pattern
   - `COLUMNISTS_MIGRATION_PLAN.md` - Columnists migration guide
   - `schemas/README.md` - Schema documentation
   - `QUICKSTART.md` - Getting started guide
   - `INDEX.md` - Navigation hub 