<!-- 50e5ef54-dc73-41b4-bfc3-d7e97f2c0a5b bad80692-39f1-48f2-bad4-a5d227856f3b -->
# ECEEE Database Migration - Product Design Review (PDR)

## Executive Summary

This PDR outlines the migration strategy for 102 Django models (21 apps) from a legacy Mezzanine-based multi-tenant CMS to a modern architecture with:

- **Object Storage System**: Schema-based content types (news, events, etc.)
- **WebPage System**: Hierarchical page management
- **Simple Tag System**: Namespace-based tagging replacing complex category systems

## Current State Analysis

### Legacy System Architecture

- **Framework**: Django + Mezzanine CMS
- **Total Models**: 102 models across 21 apps
- **Category System**: Complex GenericCategoriesField with ContentType/GenericForeignKey pattern
- **Multi-tenancy**: MultiSelectField for site assignment
- **Publishing**: Basic Mezzanine Displayable/Page patterns
- **Tagging**: Multiple domain-specific category types per content type

### New System Architecture

- **Object Storage**: ObjectTypeDefinition with JSON schemas for flexible content
- **Web Pages**: Hierarchical WebPage with PageVersion for version control
- **Tags**: Simple Tag model with Namespace support and usage tracking
- **Media**: MediaTag for file management
- **Publishing**: Date-based publishing with effective_date/expiry_date

## Migration Strategy Overview

### Three-Tier Classification

#### Tier 1: Migrate as ObjectTypeDefinition (Priority Content)

These models represent non-hierarchical content that fits the object storage pattern.

#### Tier 2: Migrate as WebPage (Hierarchical Content)

Page-like content that requires parent/child relationships.

#### Tier 3: Skip/Archive (Deprecated or System Models)

Models that are deprecated, system-internal, or no longer needed.

---

## Detailed Migration Plan

### TIER 1: Object Storage Migration

These content types should be migrated to **ObjectTypeDefinition** instances with appropriate schemas:

#### 1.1 News & Articles (HIGH PRIORITY)

**Source**: `eceeenews.eceeeNews`

- **Migrate To**: ObjectTypeDefinition named "news"
- **Schema Fields**: title, slug, content (RichText), featured_image, external_url, source_date
- **Tag Migration**: 
                                                                                                                                - NewsType → tags (namespace: "news_type")
                                                                                                                                - NewsCategory → tags (namespace: "news_category")
                                                                                                                                - NewsSource → tags (namespace: "news_source")
                                                                                                                                - Keywords → tags (default namespace)
                                                                                                                                - RelatedNews → related objects via metadata
- **Special Handling**: 
                                                                                                                                - presentational_publishing_date → ObjectVersion.effective_date
                                                                                                                                - publish_on_front_page → metadata field
                                                                                                                                - eceee_sites → namespace mapping

#### 1.2 Calendar Events (HIGH PRIORITY)

**Source**: `eceeecalendar.EceeeCalenderEvent`

- **Migrate To**: ObjectTypeDefinition named "event"
- **Schema Fields**: title, content, event_type, venue, organiser, event_start_date, event_end_date, priority, quote
- **Tag Migration**:
                                                                                                                                - event_type → tags (namespace: "event_type")
                                                                                                                                - event_categories → tags (namespace: "event_category")
                                                                                                                                - eceeeCategory → tags (namespace: "eceee_category")

#### 1.3 Jobs (MEDIUM PRIORITY)

**Source**: `eceeejobs.EceeeJobsItem`

- **Migrate To**: ObjectTypeDefinition named "job"
- **Schema Fields**: title, description, location, deadline, external_url
- **Tag Migration**: Generic categories → tags (default namespace)

#### 1.4 Library Items (HIGH PRIORITY)

**Source**: `eceeelibrary.EceeeLibraryItem`

- **Migrate To**: ObjectTypeDefinition named "library_item"
- **Schema Fields**: title, content, derivable_number, derivable_title
- **Related Objects**: EceeeLibraryFileItem → as media attachments
- **Tag Migration**: LibraryCategory → tags (namespace: "library_category")

#### 1.5 Proceedings & Papers (HIGH PRIORITY - Special Case)

**Source**: `eceeeproceedings.ProceedingPage`, `PanelPage`, `ConferencePage`

- **ConferencePage**: ObjectTypeDefinition named "conference"
- **PanelPage**: ObjectTypeDefinition named "conference_panel" (with parent FK to conference)
- **ProceedingPage**: ObjectTypeDefinition named "paper" (with parent FK to panel)
- **Schema Fields**: 
                                                                                                                                - Conference: title, year, venue, isbn, issn, date, description
                                                                                                                                - Panel: title, panel_prefix, panel_leaders, additional_information
                                                                                                                                - Paper: title, authors, abstract, doc_nummer, peer_review
- **Tag Migration**: ProceedingsKeyword → tags (namespace: "proceedings_keyword")
- **Files**: paper/presentation PDFs → media attachments

#### 1.6 Ecodesign Products (MEDIUM PRIORITY)

**Source**: `ecodesign.EcoDesignProduct`

- **Migrate To**: ObjectTypeDefinition named "ecodesign_product"
- **Schema Fields**: title, content, product_type, regulation_info
- **Tag Migration**:
                                                                                                                                - EcodesignCategory → tags (namespace: "ecodesign_category")
                                                                                                                                - LotCategory → tags (namespace: "lot_category")
                                                                                                                                - RegulationCategory → tags (namespace: "regulation_category")

#### 1.7 Views/Opinion Pieces (LOW PRIORITY)

**Source**: `eceeeviews.EceeeViews`

- **Migrate To**: ObjectTypeDefinition named "opinion"
- **Schema Fields**: title, content, author_info
- **Tag Migration**: Generic categories → tags

#### 1.8 Quotes (LOW PRIORITY)

**Source**: `eceeequotes.eceeeQuotes`, `eceeeQuotesCollection`

- **Migrate To**: ObjectTypeDefinition named "quote"
- **Schema Fields**: quote_text, attribution, collection_name
- **Collections**: Map to tags or categories

#### 1.9 Member Forum Content (MEDIUM PRIORITY)

**Source**: `eceeememberforum.EceeeMemberOrganization`, `EceeeMemberActivity`

- **MemberOrganization**: ObjectTypeDefinition named "member_org"
- **MemberActivity**: ObjectTypeDefinition named "member_activity"
- **Tag Migration**:
                                                                                                                                - MemberAffiliation → tags (namespace: "member_affiliation")
                                                                                                                                - MemberCategory → tags (namespace: "member_category")
                                                                                                                                - ProjectCategory → tags (namespace: "project_category")
                                                                                                                                - ReportCategory → tags (namespace: "report_category")

#### 1.10 Galleries (LOW PRIORITY)

**Source**: `eceeegalleries.eceeeGallery`, `eceeeGalleryImage`

- **Migrate To**: MediaCollection in file_manager system
- **Images**: Migrate to MediaFile with appropriate tags

---

### TIER 2: WebPage Migration

These models should be migrated to the **WebPage** hierarchical system:

#### 2.1 Core Page Types (HIGH PRIORITY)

**Source**: `eceeebase.WebPage`, `HomePage`, `SubSitePage`, `PlaceholderPage`

- **Migrate To**: WebPage instances with appropriate layouts
- **Schema**: Use WebPage's built-in fields + custom metadata
- **Hierarchy**: Preserve parent/child relationships via WebPage.parent
- **Tag Migration**:
                                                                                                                                - Categories → tags (namespace: "category")
                                                                                                                                - eceeeKeywords → tags (namespace: "keyword")
                                                                                                                                - eceeeCategory → tags (default namespace)
- **Widgets**: WebPageWidget → PageWidget instances
- **Images**: WebPageImage → media attachments

#### 2.2 Theme/Project Pages (MEDIUM PRIORITY)

**Source**: `eceeebase.ThemePage`, `ReportPage`, `ProjectPage`

- **Migrate To**: WebPage with specific page types or layouts
- **Note**: These are marked as deprecated in source, consider consolidating

#### 2.3 Embed Pages (LOW PRIORITY)

**Source**: `eceeebase.EmbedPage`

- **Migrate To**: WebPage with iframe widget
- **embed_url** → widget configuration

---

### TIER 3: Skip/Archive/System Models

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

#### 3.5 Deprecated Content Types (ARCHIVE)

- `eceeebase.NewsSubscription`
- `eceeebase.EcoDesign` (replaced by ecodesign app)
- `eceeebase.CalenderEvent` (replaced by eceeecalendar app)
- **Action**: Export data for reference, don't migrate

#### 3.6 Columnists (LOW PRIORITY - Evaluate)

**Source**: `eceeecolumnists` models

- **Decision**: May not be needed, check with stakeholders
- If needed: Migrate as ObjectTypeDefinition "columnist"

#### 3.7 Theme-Specific Models (EVALUATE PER THEME)

- `themes/briskee_models.py` - Briskee project
- `themes/eceee_models.py` - Main ECEEE
- `themes/mbenefits_models.py` - M-Benefits
- `themes/energysufficiency_models.py` - Energy Sufficiency
- **Action**: Evaluate which themes are still active, migrate content accordingly

#### 3.8 Utility Models (SKIP)

- `flexibledatefield` models
- `retinajs` models
- `monkey` models
- `multi_tenent` models
- `catalog` models
- **Reason**: Django app infrastructure, not content

#### 3.9 User Profiles (MIGRATE SEPARATELY)

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

- Single Tag model
- Namespace for organization
- Simple M2M relationships
- Usage tracking

### Migration Approach

#### Phase 1: Namespace Creation

Create namespaces for each category type:

```python
namespaces = [
    "news_type",
    "news_category", 
    "news_source",
    "event_type",
    "event_category",
    "library_category",
    "proceedings_keyword",
    "ecodesign_category",
    "lot_category",
    "regulation_category",
    "member_affiliation",
    "member_category",
    "project_category",
    "report_category",
    "eceee_category",  # default namespace
]
```

#### Phase 2: Tag Migration Script Structure

```python
def migrate_generic_categories(old_model, namespace_name):
    """
    Generic migration for any category type
    
    1. Get all old category instances (e.g., eceeeNewsType)
    2. Create Tag for each with appropriate namespace
    3. For each Assigned* instance:
       - Find the new object (ObjectInstance or WebPage)
       - Create tag relationship
    4. Track usage_count
    """
    
def migrate_mezzanine_keywords():
    """
    Migrate Mezzanine Keyword system
    
    1. Get all Keyword instances
    2. Create Tag with default namespace
    3. Update AssignedKeyword relationships
    """
```

#### Phase 3: Data Consolidation

- **Merge duplicate tags**: Check for similar names across namespaces
- **Clean up**: Remove unused/orphaned tags
- **Validation**: Ensure all content has appropriate tags

#### Phase 4: Multi-site to Namespace

Map `eceee_sites` field to namespace assignment:

- "eceee" → default namespace
- "eceee_ecodesign" → "ecodesign" namespace
- "energysufficiency" → "energysufficiency" namespace

---

## Migration Script Architecture

### Script Organization

```
backend/scripts/migration/
├── __init__.py
├── base_migrator.py          # Base class with common functions
├── migrate_news.py            # News migration
├── migrate_events.py          # Calendar events
├── migrate_library.py         # Library items
├── migrate_proceedings.py     # Papers & conferences
├── migrate_pages.py           # WebPage migration
├── migrate_tags.py            # Tag/category migration
├── migrate_media.py           # Images & files
└── run_full_migration.py      # Orchestrator
```

### Dependencies & Order

1. **Users & Profiles** (separate, run first)
2. **Namespaces** (create all namespaces)
3. **Tags** (migrate all category/tag data)
4. **Object Type Definitions** (create schemas)
5. **Media Files** (images, PDFs)
6. **Object Instances** (content objects)
7. **Web Pages** (hierarchical pages)
8. **Relationships** (related objects, parent/child)

### Key Decisions Required

1. **Multi-site Strategy**: 

                                                                                                                                                                                                - Create separate namespaces per site?
                                                                                                                                                                                                - Use single namespace with site metadata?

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

                                                                                                                                                                                                - Finalize namespace strategy
                                                                                                                                                                                                - Create object type definitions
                                                                                                                                                                                                - Set up migration infrastructure

2. **Phase 2 - Tag Migration** (3 days)

                                                                                                                                                                                                - Migrate all category/tag data
                                                                                                                                                                                                - Validate namespace assignments

3. **Phase 3 - Content Migration** (2 weeks)

                                                                                                                                                                                                - News, Events, Library (Week 1)
                                                                                                                                                                                                - Pages, Proceedings, Other (Week 2)

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

**Total**: ~4-5 weeks for full migration

---

## Next Steps

1. **Review & Approve** this PDR
2. **Answer key decisions** (multi-site, themes, etc.)
3. **Create detailed schemas** for each ObjectTypeDefinition
4. **Build migration scripts** starting with base infrastructure
5. **Test on sample data** before full migration
6. **Plan rollback strategy** in case of issues

### To-dos

- [ ] Review PDR with stakeholders and answer key decisions about multi-site strategy, theme migration, and URL preservation
- [ ] Create all required namespaces for tag organization
- [ ] Create detailed JSON schemas for each ObjectTypeDefinition (news, event, library_item, etc.)
- [ ] Create base migration infrastructure with common utilities
- [ ] Build and run tag/category migration scripts
- [ ] Migrate high-priority content: News, Events, Library, Proceedings
- [ ] Migrate WebPage hierarchy with widgets and images
- [ ] Migrate all media files (images, PDFs) with proper tagging
- [ ] Validate all migrated content for integrity and completeness
- [ ] Generate URL redirect mapping for old URLs