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
    'metaDescription'
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

    return processed;
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
    const { changedFieldNames, hasPageChanges, hasVersionChanges } = changes;

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
 * @param {Object} options - Save options
 * @returns {Promise<Object>} Save result
 */
export async function smartSave(originalWebpageData, currentWebpageData, originalPageVersionData, currentPageVersionData, apis, options = {}) {
    const { pagesApi, versionsApi } = apis;
    const pageId = currentWebpageData.id || originalWebpageData.id;
    const versionId = currentPageVersionData.id || originalPageVersionData.id;

    // Analyze what changed
    const changes = analyzeChanges(originalWebpageData, currentWebpageData, originalPageVersionData, currentPageVersionData);
    const strategy = determineSaveStrategy(changes);



    // Force strategy override if user explicitly requests new version
    if (options.forceNewVersion) {
        if (changes.hasPageChanges) {
            strategy.strategy = 'both';
            strategy.needsPageSave = true;
            strategy.needsVersionSave = true;
        } else {
            strategy.strategy = 'version-only';
            strategy.needsPageSave = false;
            strategy.needsVersionSave = true;
        }
    }

    const results = {
        strategy: strategy.strategy,
        summary: generateChangeSummary(changes),
        pageResult: null,
        versionResult: null
    };

    try {
        // Execute saves based on strategy
        if (strategy.strategy === 'page-only') {

            results.pageResult = await pagesApi.update(pageId, currentWebpageData);

        } else if (strategy.strategy === 'version-only') {
            // Prepare version data with meta fields properly nested in pageData
            const versionDataForSave = prepareVersionDataForSave(currentPageVersionData);

            if (options.forceNewVersion) {
                results.versionResult = await versionsApi.create(pageId, versionDataForSave);
            } else {
                results.versionResult = await versionsApi.update(versionId, versionDataForSave);
            }

        } else if (strategy.strategy === 'both') {

            // Save page first
            results.pageResult = await pagesApi.update(pageId, currentWebpageData);

            // Prepare version data with meta fields properly nested in pageData
            const versionDataForSave = prepareVersionDataForSave(currentPageVersionData);

            if (options.forceNewVersion) {
                results.versionResult = await versionsApi.create(pageId, versionDataForSave);
            } else {
                results.versionResult = await versionsApi.update(versionId, versionDataForSave);
            }

        } else {

        }

        return results;

    } catch (error) {
        console.error('❌ Smart save failed:', error);
        throw error;
    }
}
