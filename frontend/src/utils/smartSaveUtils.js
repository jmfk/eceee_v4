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
    'parent_id',
    'sort_order',
    'hostnames',
    'enable_css_injection',
    'page_css_variables', 
    'page_custom_css'
]);

// Fields that belong to the PageVersion model (save via versions API)
const VERSION_FIELDS = new Set([
    'page_data',
    'widgets',
    'code_layout',
    'theme',
    'theme_id',
    'version_title',
    'change_summary',
    'effective_date',
    'expiry_date'
]);

// Fields that are metadata/computed (don't save)
const METADATA_FIELDS = new Set([
    'id',
    'version_id', 
    'version_number',
    'created_at',
    'updated_at',
    'created_by',
    'last_modified_by',
    'publication_status',
    'is_published',
    'is_current_published',
    'absolute_url',
    'breadcrumbs',
    'children_count'
]);

/**
 * Analyze what has changed between original and current data
 * @param {Object} originalData - Original page/version data
 * @param {Object} currentData - Current page/version data  
 * @param {Array} currentWidgets - Current widgets data
 * @returns {Object} Analysis of what changed
 */
export function analyzeChanges(originalData = {}, currentData = {}, currentWidgets = null) {
    const changes = {
        pageFields: {},
        versionFields: {},
        hasPageChanges: false,
        hasVersionChanges: false,
        changedFieldNames: []
    };

    // Check page field changes
    for (const field of PAGE_FIELDS) {
        if (originalData[field] !== currentData[field]) {
            // Handle special cases for deep comparison
            if (field === 'hostnames' || field === 'page_css_variables') {
                if (JSON.stringify(originalData[field]) !== JSON.stringify(currentData[field])) {
                    changes.pageFields[field] = currentData[field];
                    changes.hasPageChanges = true;
                    changes.changedFieldNames.push(field);
                }
            } else {
                changes.pageFields[field] = currentData[field];
                changes.hasPageChanges = true;
                changes.changedFieldNames.push(field);
            }
        }
    }

    // Check version field changes  
    for (const field of VERSION_FIELDS) {
        if (field === 'widgets') {
            // Special handling for widgets - compare with provided currentWidgets
            if (currentWidgets !== null) {
                const originalWidgets = originalData.widgets || {};
                if (JSON.stringify(originalWidgets) !== JSON.stringify(currentWidgets)) {
                    changes.versionFields.widgets = currentWidgets;
                    changes.hasVersionChanges = true;
                    changes.changedFieldNames.push('widgets');
                }
            }
        } else if (field === 'page_data') {
            // Build page_data from non-page fields in currentData
            const pageDataFields = {};
            Object.entries(currentData).forEach(([key, value]) => {
                if (!PAGE_FIELDS.has(key) && !VERSION_FIELDS.has(key) && !METADATA_FIELDS.has(key)) {
                    pageDataFields[key] = value;
                }
            });
            
            const originalPageData = originalData.page_data || {};
            if (JSON.stringify(originalPageData) !== JSON.stringify(pageDataFields)) {
                changes.versionFields.page_data = pageDataFields;
                changes.hasVersionChanges = true;
                changes.changedFieldNames.push('page_data');
            }
        } else {
            if (originalData[field] !== currentData[field]) {
                changes.versionFields[field] = currentData[field];
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
 * @param {Object} originalData - Original page/version data
 * @param {Object} currentData - Current page/version data
 * @param {Array} currentWidgets - Current widgets data
 * @param {Object} apis - API functions { pagesApi, versionsApi }
 * @param {Object} options - Save options
 * @returns {Promise<Object>} Save result
 */
export async function smartSave(originalData, currentData, currentWidgets, apis, options = {}) {
    const { pagesApi, versionsApi } = apis;
    const pageId = currentData.id || originalData.id;
    const versionId = currentData.version_id || originalData.version_id;

    // Analyze what changed
    const changes = analyzeChanges(originalData, currentData, currentWidgets);
    const strategy = determineSaveStrategy(changes);

    console.log('🔍 Smart Save Analysis:', {
        strategy: strategy.strategy,
        pageChanges: changes.pageFields,
        versionChanges: changes.versionFields,
        summary: generateChangeSummary(changes)
    });

    // Force strategy override if user explicitly requests new version
    if (options.forceNewVersion && strategy.needsVersionSave) {
        strategy.needsVersionSave = true;
        strategy.strategy = changes.hasPageChanges ? 'both' : 'version-only';
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
            console.log('💾 Saving page attributes only...');
            results.pageResult = await pagesApi.update(pageId, changes.pageFields);
            
        } else if (strategy.strategy === 'version-only') {
            console.log('📝 Creating new version only...');
            const versionData = {
                ...changes.versionFields,
                version_title: options.description || 'Content updated'
            };
            results.versionResult = await versionsApi.create(pageId, versionData);
            
        } else if (strategy.strategy === 'both') {
            console.log('💾📝 Saving page attributes and creating new version...');
            
            // Save page first
            results.pageResult = await pagesApi.update(pageId, changes.pageFields);
            
            // Then create new version  
            const versionData = {
                ...changes.versionFields,
                version_title: options.description || 'Page and content updated'
            };
            results.versionResult = await versionsApi.create(pageId, versionData);
            
        } else {
            console.log('⚡ No changes detected - skipping save');
        }

        return results;

    } catch (error) {
        console.error('❌ Smart save failed:', error);
        throw error;
    }
}
