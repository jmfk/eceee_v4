/**
 * Smart saving utilities for pages and versions
 * 
 * Intelligently determines whether to save page attributes, version content, 
 * or both based on what has actually changed.
 */

// Fields that belong to the WebPage model (save via pages API)
const PAGE_FIELDS = new Set([
    'title',
    'description',
    'slug',
    'parent',
    'parentId',
    'sortOrder',
    'pathPatternKey',
    'hostnames',
    'enableCssInjection',
    'pageCssVariables',
    'pageCustomCss'
]);

// Fields that belong to the PageVersion model (save via versions API)
const VERSION_FIELDS = new Set([
    'pageData',
    'widgets',
    'codeLayout',
    'theme',
    'themeId',
    'versionTitle',
    'changeSummary',
    'effectiveDate',
    'expiryDate',
    'metaTitle',
    'metaDescription',
    'tags'
]);

// Fields that are metadata/computed (don't save)
const METADATA_FIELDS = new Set([
    'id',
    'versionId',
    'versionNumber',
    'createdAt',
    'updatedAt',
    'createdBy',
    'lastModifiedBy',
    'publicationStatus',
    'isPublished',
    'isCurrentPublished',
    'absoluteUrl',
    'breadcrumbs',
    'childrenCount'
]);

/**
 * Prepare version data for saving by converting frontend camelCase to backend snake_case
 * @param {Object} versionData - Version data to prepare
 * @returns {Object} Prepared version data with proper field names for backend
 */
function prepareVersionDataForSave(versionData) {
    const prepared = { ...versionData };

    // Convert camelCase meta fields to snake_case for backend
    if (prepared.metaTitle !== undefined) {
        prepared.meta_title = prepared.metaTitle;
        delete prepared.metaTitle;
    }
    if (prepared.metaDescription !== undefined) {
        prepared.meta_description = prepared.metaDescription;
        delete prepared.metaDescription;
    }

    return prepared;
}

/**
 * Process loaded version data by converting backend snake_case to frontend camelCase
 * @param {Object} versionData - Raw version data from API
 * @returns {Object} Processed version data with camelCase field names for frontend
 */
export function processLoadedVersionData(versionData) {
    if (!versionData) return versionData;

    const processed = { ...versionData };

    // Convert snake_case meta fields from backend to camelCase for frontend
    if (processed.meta_title !== undefined) {
        processed.metaTitle = processed.meta_title;
        delete processed.meta_title;
    }
    if (processed.meta_description !== undefined) {
        processed.metaDescription = processed.meta_description;
        delete processed.meta_description;
    }

    // Preserve effectiveTheme from API response for UDC state
    // This includes inherited theme information that components need
    // effectiveTheme is already in camelCase from API, just preserve it

    return processed;
}

const VERSIONED_PAGE_ATTRIBUTE_FIELDS = [
    'title',
    'description',
    'slug',
    'pathPatternKey',
    'hostnames',
]

/** Store public page attributes inside the working version until publish. */
export function buildVersionedPageData(pageData = {}, webpageData = {}) {
    const {
        pageAttributes: camelCaseAttributes,
        page_attributes: snakeCaseAttributes,
        ...contentData
    } = pageData
    const pageAttributes = { ...(camelCaseAttributes || snakeCaseAttributes || {}) }
    for (const field of VERSIONED_PAGE_ATTRIBUTE_FIELDS) {
        if (webpageData[field] !== undefined) {
            pageAttributes[field] = webpageData[field]
        }
    }
    return {
        ...contentData,
        pageAttributes,
    }
}

/** Show saved working-copy attributes in the editor without mutating WebPage. */
export function mergeVersionedPageAttributes(webpageData = {}, versionData = {}) {
    const pageData = versionData?.pageData || versionData?.page_data || {}
    const pageAttributes = pageData.pageAttributes || pageData.page_attributes
    return pageAttributes ? { ...webpageData, ...pageAttributes } : webpageData
}

/** Return the current editable version, creating a working copy when needed. */
export async function getCanonicalSaveVersion(pageId, currentVersion, editableVersion, versionsApi) {
    if (editableVersion?.id && String(editableVersion.id) === String(currentVersion?.id)) {
        return currentVersion
    }

    const workingCopy = await versionsApi.getOrCreateWorkingCopy(pageId)
    if (
        workingCopy.created === false
        && String(workingCopy.version?.id) !== String(currentVersion?.id)
    ) {
        const error = new Error('A newer working version already exists. Reload it before saving.')
        error.code = 'working_copy_changed'
        error.serverVersion = workingCopy.version
        throw error
    }
    return workingCopy.version
}

/**
 * Analyze what has changed between original and current data
 * @param {Object} originalWebpageData - Original webpage data
 * @param {Object} currentWebpageData - Current webpage data
 * @param {Object} originalPageVersionData - Original page version data
 * @param {Object} currentPageVersionData - Current page version data
 * @returns {Object} Analysis of what changed
 */
export function analyzeChanges(originalWebpageData = {}, currentWebpageData = {}, originalPageVersionData = {}, currentPageVersionData = {}) {
    // Ensure all parameters are objects (handle null values)
    originalWebpageData = originalWebpageData || {};
    currentWebpageData = currentWebpageData || {};
    originalPageVersionData = originalPageVersionData || {};
    currentPageVersionData = currentPageVersionData || {};

    const changes = {
        pageFields: {},
        versionFields: {},
        hasPageChanges: false,
        hasVersionChanges: false,
        changedFieldNames: []
    };



    // Check webpage field changes
    for (const field of PAGE_FIELDS) {
        if (originalWebpageData[field] !== currentWebpageData[field]) {
            // Handle special cases for deep comparison
            if (field === 'hostnames' || field === 'pageCssVariables') {
                if (JSON.stringify(originalWebpageData[field]) !== JSON.stringify(currentWebpageData[field])) {
                    changes.pageFields[field] = currentWebpageData[field];
                    changes.hasPageChanges = true;
                    changes.changedFieldNames.push(field);
                }
            } else {
                changes.pageFields[field] = currentWebpageData[field];
                changes.hasPageChanges = true;
                changes.changedFieldNames.push(field);
            }
        }
    }

    // Check page version field changes  
    for (const field of VERSION_FIELDS) {
        if (field === 'widgets') {
            // Special handling for widgets - compare widgets from version data
            const originalWidgets = originalPageVersionData.widgets || {};
            const currentWidgets = currentPageVersionData.widgets || {};
            if (JSON.stringify(originalWidgets) !== JSON.stringify(currentWidgets)) {
                changes.versionFields.widgets = currentWidgets;
                changes.hasVersionChanges = true;
                changes.changedFieldNames.push('widgets');
            }
        } else if (field === 'pageData') {
            // pageData is a specific field in PageVersion model containing form data
            const originalFormData = originalPageVersionData.pageData || {};
            const currentFormData = currentPageVersionData.pageData || {};
            if (JSON.stringify(originalFormData) !== JSON.stringify(currentFormData)) {
                changes.versionFields.pageData = currentFormData;
                changes.hasVersionChanges = true;
                changes.changedFieldNames.push('pageData');
            }
        } else if (field === 'metaTitle') {
            // Special handling for metaTitle - it affects both page title and version meta_title
            if (originalPageVersionData[field] !== currentPageVersionData[field]) {
                changes.versionFields[field] = currentPageVersionData[field];
                changes.hasVersionChanges = true;
                changes.changedFieldNames.push(field);

                // Also mark as page change since it updates webpage.title
                changes.pageFields.title = currentPageVersionData[field];
                changes.hasPageChanges = true;
                if (!changes.changedFieldNames.includes('title')) {
                    changes.changedFieldNames.push('title');
                }
            }
        } else if (field === 'tags') {
            if (JSON.stringify(originalPageVersionData[field] || []) !== JSON.stringify(currentPageVersionData[field] || [])) {
                changes.versionFields[field] = currentPageVersionData[field];
                changes.hasVersionChanges = true;
                changes.changedFieldNames.push(field);
            }
        } else {
            // Compare other version fields directly
            if (originalPageVersionData[field] !== currentPageVersionData[field]) {
                changes.versionFields[field] = currentPageVersionData[field];
                changes.hasVersionChanges = true;
                changes.changedFieldNames.push(field);
            }
        }
    }

    return changes;
}

/**
 * Determine save strategy based on changes
 * @param {Object} changes - Output from analyzeChanges()
 * @returns {Object} Save strategy
 */
export function determineSaveStrategy(changes) {
    const { hasPageChanges, hasVersionChanges } = changes;

    if (hasPageChanges && hasVersionChanges) {
        return {
            strategy: 'both',
            description: 'Save page attributes and create new version',
            needsPageSave: true,
            needsVersionSave: true
        };
    } else if (hasPageChanges && !hasVersionChanges) {
        return {
            strategy: 'page-only',
            description: 'Save page attributes only (no new version)',
            needsPageSave: true,
            needsVersionSave: false
        };
    } else if (!hasPageChanges && hasVersionChanges) {
        return {
            strategy: 'version-only',
            description: 'Create new version (page attributes unchanged)',
            needsPageSave: false,
            needsVersionSave: true
        };
    } else {
        return {
            strategy: 'none',
            description: 'No changes detected',
            needsPageSave: false,
            needsVersionSave: false
        };
    }
}

/**
 * Generate user-friendly change summary
 * @param {Object} changes - Output from analyzeChanges()
 * @returns {String} Human-readable summary
 */
export function generateChangeSummary(changes) {
    const { changedFieldNames } = changes;

    if (changedFieldNames.length === 0) {
        return 'No changes detected';
    }

    const pageChanges = changedFieldNames.filter(field => PAGE_FIELDS.has(field));
    const versionChanges = changedFieldNames.filter(field =>
        VERSION_FIELDS.has(field) || (!PAGE_FIELDS.has(field) && !METADATA_FIELDS.has(field))
    );

    const parts = [];

    if (pageChanges.length > 0) {
        parts.push(`Page: ${pageChanges.join(', ')}`);
    }

    if (versionChanges.length > 0) {
        parts.push(`Content: ${versionChanges.join(', ')}`);
    }

    return parts.join(' | ');
}

/**
 * Smart save function that uses the appropriate API based on what changed
 * @param {Object} originalWebpageData - Original webpage data
 * @param {Object} currentWebpageData - Current webpage data
 * @param {Object} originalPageVersionData - Original page version data
 * @param {Object} currentPageVersionData - Current page version data
 * @param {Object} apis - API functions { pagesApi, versionsApi }
 * @param {Object} options - Save options (clientUpdatedAt, etc.)
 * @returns {Promise<Object>} Save result
 */
export async function smartSave(originalWebpageData, currentWebpageData, originalPageVersionData, currentPageVersionData, apis, options = {}) {
    const { versionsApi } = apis;
    const versionId = currentPageVersionData.id || originalPageVersionData.id;

    // Analyze what changed
    const changes = analyzeChanges(originalWebpageData, currentWebpageData, originalPageVersionData, currentPageVersionData);
    const strategy = determineSaveStrategy(changes);



    const results = {
        strategy: strategy.strategy,
        summary: generateChangeSummary(changes),
        pageResult: null,
        versionResult: null,
        conflict: null
    };

    try {
        // Prepare update options with timestamp if available
        const updateOptions = {};
        if (options.clientUpdatedAt) {
            updateOptions.clientUpdatedAt = options.clientUpdatedAt;
        }

        // Public page attributes are versioned too. Every editor save therefore goes
        // through the one optimistic-locking working-copy endpoint; WebPage itself is
        // only changed by the publish workflow.
        if (strategy.strategy !== 'none') {
            const versionDataForSave = prepareVersionDataForSave({
                ...currentPageVersionData,
                pageData: buildVersionedPageData(
                    currentPageVersionData.pageData || currentPageVersionData.page_data,
                    currentWebpageData,
                ),
            });
            results.versionResult = await versionsApi.saveWorkingCopy(
                versionId,
                versionDataForSave,
                updateOptions.clientUpdatedAt,
            );
        }

        return results;

    } catch (error) {
        // Check if this is a conflict error
        const responseData = error.response?.data || error.originalError?.response?.data;
        if (error.response?.status === 409 || error.originalError?.response?.status === 409) {
            console.log('🔀 Conflict detected:', responseData);
            results.conflict = {
                ...responseData,
                ...responseData?.details,
            };
            return results;
        }

        console.error('❌ Smart save failed:', error);
        throw error;
    }
}
