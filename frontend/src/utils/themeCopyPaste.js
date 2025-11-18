/**
 * Theme Copy/Paste Utilities
 * 
 * Handles copying and pasting theme settings at multiple levels:
 * - Full theme (all settings)
 * - Section (e.g., fonts, colors, gallery styles)
 * - Individual item (e.g., one font, one color)
 */

const COPY_VERSION = '1.0';
const COPY_TYPE = 'theme-settings';

/**
 * Creates a standardized payload for copying theme data
 */
export function createCopyPayload(data, level, section = null, itemKey = null) {
    return {
        type: COPY_TYPE,
        version: COPY_VERSION,
        level, // 'full', 'section', or 'item'
        section, // 'fonts', 'colors', 'typography', etc.
        itemKey, // For individual items
        timestamp: new Date().toISOString(),
        data,
    };
}

/**
 * Copies data to clipboard as JSON
 */
export async function copyToClipboard(data, level, section = null, itemKey = null) {
    try {
        const payload = createCopyPayload(data, level, section, itemKey);
        console.log('[themeCopyPaste] copyToClipboard payload:', {
            level,
            section,
            itemKey,
            payloadKeys: Object.keys(payload),
            dataKeys: Object.keys(payload.data || {}),
            payload,
        });
        const jsonString = JSON.stringify(payload, null, 2);
        console.log('[themeCopyPaste] JSON string length:', jsonString.length);
        await navigator.clipboard.writeText(jsonString);
        return { success: true };
    } catch (error) {
        console.error('[themeCopyPaste] Failed to copy to clipboard:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Validates clipboard data structure
 */
export function validateCopyData(jsonString) {
    try {
        console.log('[themeCopyPaste] validateCopyData - parsing JSON...');
        const data = JSON.parse(jsonString);
        console.log('[themeCopyPaste] validateCopyData - parsed data:', {
            type: data.type,
            version: data.version,
            level: data.level,
            section: data.section,
            hasData: !!data.data,
            dataKeys: data.data ? Object.keys(data.data) : [],
        });

        if (data.type !== COPY_TYPE) {
            console.error('[themeCopyPaste] validateCopyData - wrong type:', data.type);
            return { valid: false, error: 'Invalid data type. Expected theme-settings data.' };
        }

        if (!data.version) {
            console.error('[themeCopyPaste] validateCopyData - missing version');
            return { valid: false, error: 'Missing version information.' };
        }

        if (!['full', 'section', 'item'].includes(data.level)) {
            console.error('[themeCopyPaste] validateCopyData - invalid level:', data.level);
            return { valid: false, error: 'Invalid level. Must be "full", "section", or "item".' };
        }

        if (data.level !== 'full' && !data.section) {
            console.error('[themeCopyPaste] validateCopyData - missing section for non-full level');
            return { valid: false, error: 'Section is required for section or item level data.' };
        }

        if (!data.data) {
            console.error('[themeCopyPaste] validateCopyData - missing data');
            return { valid: false, error: 'Missing data payload.' };
        }

        console.log('[themeCopyPaste] validateCopyData - validation passed');
        return { valid: true, data };
    } catch (error) {
        console.error('[themeCopyPaste] validateCopyData - JSON parse error:', error);
        return { valid: false, error: `Invalid JSON: ${error.message}` };
    }
}

/**
 * Parses clipboard data
 */
export function parseClipboardData(jsonString) {
    console.log('[themeCopyPaste] parseClipboardData called');
    const result = validateCopyData(jsonString);
    console.log('[themeCopyPaste] parseClipboardData result:', result);
    return result;
}

/**
 * Detects conflicts when merging data
 * Returns array of conflicts with metadata
 */
export function detectConflicts(existingData, newData, section, level) {
    const conflicts = [];

    if (level === 'full') {
        // Check each section for conflicts
        const sections = ['fonts', 'colors', 'designGroups', 'componentStyles', 'imageStyles', 'galleryStyles', 'carouselStyles', 'tableTemplates'];

        sections.forEach(sectionName => {
            const sectionConflicts = detectSectionConflicts(
                existingData[sectionName],
                newData[sectionName],
                sectionName
            );
            conflicts.push(...sectionConflicts);
        });
    } else if (level === 'section') {
        const sectionConflicts = detectSectionConflicts(existingData, newData, section);
        conflicts.push(...sectionConflicts);
    } else if (level === 'item') {
        // For individual items, check if key already exists
        const itemConflicts = detectItemConflicts(existingData, newData, section);
        conflicts.push(...itemConflicts);
    }

    return conflicts;
}

/**
 * Detects conflicts within a section
 */
function detectSectionConflicts(existing, incoming, sectionName) {
    const conflicts = [];

    if (!existing || !incoming) return conflicts;

    // Special handling for different section types
    if (sectionName === 'fonts') {
        // Fonts are stored as { googleFonts: [...] }
        const existingFonts = existing.googleFonts || [];
        const incomingFonts = incoming.googleFonts || [];

        incomingFonts.forEach((newFont, index) => {
            const existingIndex = existingFonts.findIndex(f => f.family === newFont.family);
            if (existingIndex !== -1) {
                conflicts.push({
                    section: sectionName,
                    key: newFont.family,
                    type: 'font',
                    existing: existingFonts[existingIndex],
                    incoming: newFont,
                    path: `googleFonts[${existingIndex}]`,
                });
            }
        });
    } else if (sectionName === 'designGroups') {
        // Design Groups has groups array
        // For now, we'll treat the whole designGroups as a single unit
        // Could be enhanced to detect group-level conflicts
        if (existing.groups && existing.groups.length > 0) {
            conflicts.push({
                section: sectionName,
                key: 'designGroups',
                type: 'designGroups',
                existing,
                incoming,
                path: 'designGroups',
            });
        }
    } else {
        // Object-based sections (colors, componentStyles, galleryStyles, etc.)
        Object.keys(incoming).forEach(key => {
            if (existing[key] !== undefined) {
                conflicts.push({
                    section: sectionName,
                    key,
                    type: 'object',
                    existing: existing[key],
                    incoming: incoming[key],
                    path: key,
                });
            }
        });
    }

    return conflicts;
}

/**
 * Detects conflicts for individual item
 */
function detectItemConflicts(existing, incoming, sectionName) {
    const conflicts = [];

    if (sectionName === 'fonts') {
        const existingFonts = existing.googleFonts || [];
        const incomingFont = incoming;

        const existingIndex = existingFonts.findIndex(f => f.family === incomingFont.family);
        if (existingIndex !== -1) {
            conflicts.push({
                section: sectionName,
                key: incomingFont.family,
                type: 'font',
                existing: existingFonts[existingIndex],
                incoming: incomingFont,
                path: `googleFonts[${existingIndex}]`,
            });
        }
    } else if (sectionName === 'designGroups') {
        // Design Groups doesn't support item-level copy
        // Would need group-level support
    } else {
        // For object-based sections
        Object.keys(incoming).forEach(key => {
            if (existing[key] !== undefined) {
                conflicts.push({
                    section: sectionName,
                    key,
                    type: 'object',
                    existing: existing[key],
                    incoming: incoming[key],
                    path: key,
                });
            }
        });
    }

    return conflicts;
}

/**
 * Merges theme data based on conflict resolutions
 * 
 * @param {Object} existing - Existing theme data
 * @param {Object} incoming - Incoming data to merge
 * @param {String} level - 'full', 'section', or 'item'
 * @param {String} section - Section name for section/item level
 * @param {Object} resolutions - Conflict resolutions { conflictKey: 'keep'|'overwrite'|'rename', newName }
 */
export function mergeThemeData(existing, incoming, level, section, resolutions = {}) {
    const result = { ...existing };

    if (level === 'full') {
        // Merge all sections
        const sections = ['fonts', 'colors', 'designGroups', 'componentStyles', 'imageStyles', 'galleryStyles', 'carouselStyles', 'tableTemplates'];

        sections.forEach(sectionName => {
            if (incoming[sectionName]) {
                result[sectionName] = mergeSectionData(
                    existing[sectionName] || {},
                    incoming[sectionName],
                    sectionName,
                    resolutions
                );
            }
        });

        // Also include image if present (metadata, not a section)
        if (incoming.image) {
            result.image = incoming.image;
        }
    } else if (level === 'section') {
        // Merge specific section
        result[section] = mergeSectionData(
            existing[section] || {},
            incoming,
            section,
            resolutions
        );
    } else if (level === 'item') {
        // Merge individual item
        result[section] = mergeItemData(
            existing[section] || {},
            incoming,
            section,
            resolutions
        );
    }

    return result;
}

/**
 * Merges data within a section
 */
function mergeSectionData(existing, incoming, sectionName, resolutions) {
    if (sectionName === 'fonts') {
        const existingFonts = existing.googleFonts || [];
        const incomingFonts = incoming.googleFonts || [];
        const mergedFonts = [...existingFonts];

        incomingFonts.forEach(newFont => {
            const conflictKey = newFont.family;
            const resolution = resolutions[`${sectionName}.${conflictKey}`];

            const existingIndex = mergedFonts.findIndex(f => f.family === newFont.family);

            if (existingIndex === -1) {
                // No conflict, add it
                mergedFonts.push(newFont);
            } else if (resolution === 'overwrite') {
                // Replace existing
                mergedFonts[existingIndex] = newFont;
            } else if (resolution === 'rename') {
                // Add with new name
                mergedFonts.push({ ...newFont, family: resolutions[`${sectionName}.${conflictKey}.newName`] });
            }
            // If 'keep', do nothing
        });

        return { ...existing, googleFonts: mergedFonts };
    } else if (sectionName === 'designGroups') {
        const conflictKey = 'designGroups';
        const resolution = resolutions[`${sectionName}.${conflictKey}`];

        if (resolution === 'overwrite') {
            return incoming;
        } else {
            // Keep existing
            return existing;
        }
    } else {
        // Object-based sections
        const merged = { ...existing };

        Object.entries(incoming).forEach(([key, value]) => {
            const conflictKey = key;
            const resolution = resolutions[`${sectionName}.${conflictKey}`];

            if (!merged[key]) {
                // No conflict, add it
                merged[key] = value;
            } else if (resolution === 'overwrite') {
                // Replace existing
                merged[key] = value;
            } else if (resolution === 'rename') {
                // Add with new name
                const newKey = resolutions[`${sectionName}.${conflictKey}.newName`];
                merged[newKey] = value;
            }
            // If 'keep', do nothing
        });

        return merged;
    }
}

/**
 * Merges individual item
 */
function mergeItemData(existing, incoming, sectionName, resolutions) {
    return mergeSectionData(existing, incoming, sectionName, resolutions);
}

/**
 * Generates a summary of merge operation
 */
export function generateMergeSummary(conflicts, resolutions) {
    const total = conflicts.length;
    const overwritten = Object.values(resolutions).filter(r => r === 'overwrite').length;
    const kept = Object.values(resolutions).filter(r => r === 'keep').length;
    const renamed = Object.values(resolutions).filter(r => r === 'rename').length;

    return {
        total,
        overwritten,
        kept,
        renamed,
        message: `${total} conflict${total !== 1 ? 's' : ''} resolved: ${overwritten} overwritten, ${kept} kept, ${renamed} renamed`,
    };
}

/**
 * Download JSON data as file
 */
export function downloadAsJSON(data, filename = 'theme-settings.json') {
    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

