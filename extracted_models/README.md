# Extracted Django Models Catalog
This directory contains Django model files extracted from the ECEEE multi-tenant CMS project.
**Total Apps:** 21  **Total Models:** 102  
## Purpose
These models have been extracted for use in building migration scripts to migrate the ECEEE database to a new CMS.
## Model Files Overview

### Core Content Applications

#### eceeeaccounts
**File:** `eceeeaccounts_models.py`  
**Models:** 1  

| Model Name | Base Classes |
|------------|-------------|
| ProfileModel | models.Model |

#### eceeebase
**File:** `eceeebase_models.py`  
**Models:** 24  

| Model Name | Base Classes |
|------------|-------------|
| Affiliation | Slugged |
| eceeeKeyword | Slugged |
| AssignedeceeeKeyword | Orderable |
| Category | Slugged |
| AssignedCategory | Orderable |
| eceeeCategory | Slugged |
| AssignedeceeeCategory | Orderable |
| AccessLevelMixin | object |
| EceeeCategoryMixin | object |
| WebPageWidget | Orderable |
| WebPageImage | Orderable |
| WebPageManager | DisplayableManager |
| WebPage | AcquisitionMixin, EceeeCategoryMixin, Page, RichText |
| PlaceholderPage | AcquisitionMixin, EceeeCategoryMixin, Page |
| SubSitePage | AcquisitionMixin, EceeeCategoryMixin, Page, RichText |
| HomePage | AcquisitionMixin, EceeeCategoryMixin, Page, RichText |
| ThemePage | AcquisitionMixin, EceeeCategoryMixin, Page, RichText |
| ReportPage | AcquisitionMixin, EceeeCategoryMixin, Page, RichText |
| ProjectPage | AcquisitionMixin, EceeeCategoryMixin, Page, RichText |
| NewsSubscription | AccessLevelMixin, AcquisitionMixin, EceeeCategoryMixin, Page, RichText |
| EcoDesign | AccessLevelMixin, AcquisitionMixin, EceeeCategoryMixin, Page, RichText |
| CalenderEvent | AccessLevelMixin, EceeeCategoryMixin, Displayable, RichText |
| EmbedPage | AcquisitionMixin, EceeeCategoryMixin, Page |
| eceeeColor | Slugged |

#### eceeecalendar
**File:** `eceeecalendar_models.py`  
**Models:** 2  

| Model Name | Base Classes |
|------------|-------------|
| EceeeCalenderEventManager | DisplayableManager |
| EceeeCalenderEvent | AccessLevelMixin, EceeeCategoryMixin, Displayable, RichText |

#### eceeecolumnists
**File:** `eceeecolumnists_models.py`  
**Models:** 2  

| Model Name | Base Classes |
|------------|-------------|
| EceeeColumnistManager | DisplayableManager |
| EceeeColumnManager | DisplayableManager |

#### eceeegalleries
**File:** `eceeegalleries_models.py`  
**Models:** 2  

| Model Name | Base Classes |
|------------|-------------|
| eceeeGalleryImage | Orderable |
| eceeeGallery | Displayable |

#### eceeejobs
**File:** `eceeejobs_models.py`  
**Models:** 2  

| Model Name | Base Classes |
|------------|-------------|
| EceeeJobsItemManager | DisplayableManager |
| EceeeJobsItem | AcquisitionMixin, Displayable |

#### eceeelibrary
**File:** `eceeelibrary_models.py`  
**Models:** 5  

| Model Name | Base Classes |
|------------|-------------|
| eceeeLibraryCategory | SpecialOrderable, Slugged |
| AssignedeceeeLibraryCategory | Orderable |
| EceeeLibraryItemManager | DisplayableManager |
| EceeeLibraryItem | AcquisitionMixin, Displayable, RichText |
| EceeeLibraryFileItem | Orderable, Slugged |

#### eceeememberforum
**File:** `eceeememberforum_models.py`  
**Models:** 10  

| Model Name | Base Classes |
|------------|-------------|
| MemberAffiliation | Slugged |
| AssignedMemberAffiliation | Orderable |
| MemberCategory | Slugged |
| AssignedMemberCategory | Orderable |
| EceeeMemberOrganization | Displayable |
| ProjectCategory | Slugged |
| AssignedProjectCategory | Orderable |
| ReportCategory | Slugged |
| AssignedReportCategory | Orderable |
| EceeeMemberActivity | Displayable |

#### eceeenews
**File:** `eceeenews_models.py`  
**Models:** 10  

| Model Name | Base Classes |
|------------|-------------|
| eceeeNewsType | Slugged |
| AssignedeceeeNewsType | Orderable |
| eceeeNewsCategory | Slugged |
| AssignedeceeeNewsCategory | Orderable |
| eceeeNewsSource | Slugged |
| AssignedeceeeNewsSource | Orderable |
| AssignedKeywordSub | Orderable |
| RelatedNews | Slugged |
| AssignedRelatedNews | Orderable |
| eceeeNewsManager | DisplayableManager |

#### eceeeproceedings
**File:** `eceeeproceedings_models.py`  
**Models:** 9  

| Model Name | Base Classes |
|------------|-------------|
| eceeeProceedingsKeyword | Slugged |
| AssignedeceeeProceedingsKeyword | Orderable |
| ConferencePageManager | PageManager |
| ConferencePage | AcquisitionMixin, EceeeCategoryMixin, Page, RichText |
| ConferenceLogo | Orderable |
| ConferencePageProxy | AcquisitionMixin, EceeeCategoryMixin, Page |
| ConferenceYearPageProxy | AcquisitionMixin, EceeeCategoryMixin, Page |
| ProceedingPageManager | DisplayableManager |
| ProceedingFile | AccessLevelMixin, AcquisitionMixin, Displayable |

#### eceeequotes
**File:** `eceeequotes_models.py`  
**Models:** 2  

| Model Name | Base Classes |
|------------|-------------|
| eceeeQuotes | Orderable |
| eceeeQuotesCollection | models.Model |

#### eceeeviews
**File:** `eceeeviews_models.py`  
**Models:** 2  

| Model Name | Base Classes |
|------------|-------------|
| EceeeViewsItemManager | DisplayableManager |
| EceeeViews | AcquisitionMixin, Displayable, RichText |

### Widget System

#### easywidget
**File:** `easywidget_models.py`  
**Models:** 3  

| Model Name | Base Classes |
|------------|-------------|
| EasyWidgetViewBase | object |
| EasyWidget | Orderable, SiteRelated |
| EasyWidgetModelBase | models.Model |

#### orderable
**File:** `orderable_models.py`  
**Models:** 1  

| Model Name | Base Classes |
|------------|-------------|
| Orderable | models.Model |

#### widget
**File:** `widget_models.py`  
**Models:** 3  

| Model Name | Base Classes |
|------------|-------------|
| WidgetOption | object |
| WidgetClassBase | object |
| Widget | Orderable, Ownable, SiteRelated |

### Supporting Applications

#### attachments
**File:** `attachments_models.py`  
**Models:** 1  

| Model Name | Base Classes |
|------------|-------------|
| AttachmentBase | models.Model |

#### easyfields
**File:** `easyfields_models.py`  
**Models:** 1  

| Model Name | Base Classes |
|------------|-------------|
| InfoText | Slugged |

#### easypublisher
**File:** `easypublisher_models.py`  
**Models:** 1  

| Model Name | Base Classes |
|------------|-------------|
| AcquisitionMixin | object |

#### ecodesign
**File:** `ecodesign_models.py`  
**Models:** 10  

| Model Name | Base Classes |
|------------|-------------|
| EcodesignCategory | Slugged |
| AssignedEcodesignCategory | Orderable |
| LotCategory | Slugged |
| AssignedLotCategory | Orderable |
| RegulationCategory | Slugged |
| AssignedRegulationCategory | Orderable |
| EcoDesignProductManager | DisplayableManager |
| EcoDesignProduct | AccessLevelMixin, EceeeCategoryMixin, Displayable, RichText |
| EcoDesignChangeEvent | Orderable |
| EcoDesignProductWidget | Orderable |

#### pageproperties
**File:** `pageproperties_models.py`  
**Models:** 2  

| Model Name | Base Classes |
|------------|-------------|
| PagePropertyMixin | object |
| PageProperty | Orderable |

### Theme-Specific Models

#### themes/briskee
**File:** `themes/briskee_models.py`  
**Models:** 9  

| Model Name | Base Classes |
|------------|-------------|
| BriskeeWebPageImage | Orderable |
| BriskeeWebPage | AcquisitionMixin, Page, RichText |
| BriskeeHomePage | AcquisitionMixin, Page, RichText |
| BriskeeLibraryCategory | SpecialOrderable, Slugged |
| AssignedBriskeeLibraryCategory | Orderable |
| BriskeeLibraryRelated | SpecialOrderable, Slugged |
| AssignedBriskeeLibraryRelated | Orderable |
| BriskeeLibraryItemManager | DisplayableManager |
| BriskeeLibraryItem | AcquisitionMixin, Displayable, RichText |

## Summary by Model Count

| App | Model Count | File |
|-----|-------------|------|
| eceeebase | 24 | `eceeebase_models.py` |
| eceeememberforum | 10 | `eceeememberforum_models.py` |
| eceeenews | 10 | `eceeenews_models.py` |
| ecodesign | 10 | `ecodesign_models.py` |
| eceeeproceedings | 9 | `eceeeproceedings_models.py` |
| themes/briskee | 9 | `themes/briskee_models.py` |
| eceeelibrary | 5 | `eceeelibrary_models.py` |
| easywidget | 3 | `easywidget_models.py` |
| widget | 3 | `widget_models.py` |
| eceeecalendar | 2 | `eceeecalendar_models.py` |
| eceeecolumnists | 2 | `eceeecolumnists_models.py` |
| eceeegalleries | 2 | `eceeegalleries_models.py` |
| eceeejobs | 2 | `eceeejobs_models.py` |
| eceeequotes | 2 | `eceeequotes_models.py` |
| eceeeviews | 2 | `eceeeviews_models.py` |
| pageproperties | 2 | `pageproperties_models.py` |
| attachments | 1 | `attachments_models.py` |
| easyfields | 1 | `easyfields_models.py` |
| easypublisher | 1 | `easypublisher_models.py` |
| eceeeaccounts | 1 | `eceeeaccounts_models.py` |
| orderable | 1 | `orderable_models.py` |

## Key Model Categories

### Content Models
- **eceeebase**: Core page types (WebPage, HomePage, SubSitePage, etc.)
- **eceeenews**: News articles with types, categories, and sources
- **eceeecalendar**: Calendar events
- **eceeelibrary**: Library/document management
- **eceeeproceedings**: Conference papers and proceedings
- **eceeecolumnists**: Columnist content
- **eceeegalleries**: Image galleries
- **eceeejobs**: Job listings

### System Models
- **widget/easywidget**: Widget system for content blocks
- **orderable**: Ordering functionality
- **attachments**: File attachments
- **easypublisher**: Publishing workflow
- **pageproperties**: Page property management

### Theme Models
- **themes/eceee**: Main ECEEE theme
- **themes/briskee**: Briskee project
- **themes/mbenefits**: M-Benefits project
- **themes/energysufficiency**: Energy Sufficiency theme

## Notes for Migration

1. **Model Inheritance**: Most content models inherit from Mezzanine's `Displayable`, `Page`, or `RichText` base classes
2. **Multi-tenancy**: Models use `eceee_sites` field for multi-site support
3. **Categories**: Custom category system through `GenericCategoriesField` and related models
4. **Widget System**: Sophisticated widget system for page customization
5. **Orderable**: Many models use `Orderable` for manual sorting
6. **Timestamps**: Models inherit publish_date, created, updated from Mezzanine
