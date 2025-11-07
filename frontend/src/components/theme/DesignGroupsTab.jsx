/**
 * Design Groups Tab Component - Polished Editor
 * 
 * Features:
 * - Expandable design groups (all can be open simultaneously)
 * - Form with theme-based selectors (colors, fonts)
 * - Numeric inputs with steppers and unit selectors
 * - Smart copy/paste (full set → all tags, single tag → selected tag)
 * - Tags grouped with pseudo-classes
 */

import React, { useState, useRef } from 'react';
import { Plus, Trash2, ChevronDown, ChevronRight, Copy, Check, Clipboard, Code, FileText, Upload, FileUp } from 'lucide-react';
import { createDesignGroup, generateClassName } from '../../utils/themeUtils';
import { parseCSSRules, cssToGroupElements, cssToElementProperties, groupElementsToCSS, isValidClassName } from '../../utils/cssParser';
import DesignGroupsPreview from './DesignGroupsPreview';
import ColorSelector from './form-fields/ColorSelector';
import FontSelector from './form-fields/FontSelector';
import NumericInput from './form-fields/NumericInput';
import CopyButton from './CopyButton';
import { useGlobalNotifications } from '../../contexts/GlobalNotificationContext';

// Convert camelCase CSS properties to kebab-case
const cssPropertyToKebab = (prop) => {
  return prop.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`);
};

// Convert element styles object to CSS string
const stylesToCSS = (styles) => {
  if (!styles || Object.keys(styles).length === 0) return '';
  return Object.entries(styles)
    .map(([prop, value]) => `  ${cssPropertyToKebab(prop)}: ${value};`)
    .join('\n');
};

// Parse CSS back to object (basic parser)
const parseCSS = (cssText) => {
  const styles = {};
  const rules = cssText.match(/([a-z-]+)\s*:\s*([^;]+)/gi) || [];
  rules.forEach(rule => {
    const [prop, value] = rule.split(':').map(s => s.trim());
    // Convert kebab-case to camelCase
    const camelProp = prop.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
    styles[camelProp] = value.replace(/;$/, '');
  });
  return styles;
};

// Tag groups - only links have multiple variants (pseudo-classes)
const TAG_GROUPS = [
  { base: 'p', variants: ['p'], label: 'Paragraph' },
  { base: 'h1', variants: ['h1'], label: 'Heading 1' },
  { base: 'h2', variants: ['h2'], label: 'Heading 2' },
  { base: 'h3', variants: ['h3'], label: 'Heading 3' },
  { base: 'h4', variants: ['h4'], label: 'Heading 4' },
  { base: 'h5', variants: ['h5'], label: 'Heading 5' },
  { base: 'h6', variants: ['h6'], label: 'Heading 6' },
  { base: 'a', variants: ['a', 'a:hover', 'a:active', 'a:visited'], label: 'Link', hasGroup: true },
  { base: 'ul', variants: ['ul'], label: 'Unordered List' },
  { base: 'ol', variants: ['ol'], label: 'Ordered List' },
  { base: 'li', variants: ['li'], label: 'List Item' },
  { base: 'blockquote', variants: ['blockquote'], label: 'Blockquote' },
  { base: 'code', variants: ['code'], label: 'Code (inline)' },
  { base: 'pre', variants: ['pre'], label: 'Code Block' },
  { base: 'strong', variants: ['strong'], label: 'Bold' },
  { base: 'em', variants: ['em'], label: 'Italic' },
];

// Common CSS properties - required for text blocks
const CSS_PROPERTIES = {
  fontFamily: { type: 'font', label: 'Font + Weight', required: true },
  fontSize: { type: 'numeric', label: 'Font Size', required: true },
  fontStyle: { type: 'select', label: 'Italic', options: ['normal', 'italic'], required: true },
  marginTop: { type: 'numeric', label: 'Margin Top', required: true },
  marginBottom: { type: 'numeric', label: 'Margin Bottom', required: true },
  lineHeight: { type: 'numeric', label: 'Line Height', required: true },
  letterSpacing: { type: 'numeric', label: 'Letter Spacing', required: true },
  color: { type: 'color', label: 'Color' },
  backgroundColor: { type: 'color', label: 'Background Color' },
  textDecoration: { type: 'select', label: 'Text Decoration', options: ['none', 'underline', 'overline', 'line-through'] },
  textTransform: { type: 'select', label: 'Text Transform', options: ['none', 'uppercase', 'lowercase', 'capitalize'] },
};

const DesignGroupsTab = ({ designGroups, colors, fonts, onChange, onDirty }) => {
  const groups = designGroups?.groups || [];
  const [expandedGroups, setExpandedGroups] = useState({});
  const [expandedTags, setExpandedTags] = useState({});
  const [clipboard, setClipboard] = useState(null); // { type: 'tag' | 'group', data: {...} }
  const [copiedIndicator, setCopiedIndicator] = useState(null);
  const [editMode, setEditMode] = useState({}); // { groupIndex-tagBase-variant: 'form' | 'css' }
  const [importModal, setImportModal] = useState(null); // { type: 'global' | 'group' | 'element', groupIndex?: number, elementKey?: string }
  const [importCSSText, setImportCSSText] = useState('');
  const { addNotification } = useGlobalNotifications();

  // Refs for CSS textarea to prevent re-rendering
  const cssTextareaRefs = useRef({});
  const fileInputRef = useRef(null);

  const handleAddGroup = () => {
    const baseFont = fonts?.googleFonts?.[0]?.family || 'Inter';
    const newGroup = createDesignGroup(`Group ${groups.length + 1}`, `${baseFont}, sans-serif`);
    const updatedDesignGroups = {
      ...(designGroups || {}),
      groups: [...groups, newGroup],
    };
    onChange(updatedDesignGroups);
    setExpandedGroups({ ...expandedGroups, [groups.length]: true });
  };

  const handleRemoveGroup = (index) => {
    const updatedGroups = groups.filter((_, i) => i !== index);
    onChange({ ...(designGroups || {}), groups: updatedGroups });
  };

  const toggleGroup = (index) => {
    setExpandedGroups({
      ...expandedGroups,
      [index]: !expandedGroups[index],
    });
  };

  const toggleTag = (groupIndex, tagBase) => {
    const key = `${groupIndex}-${tagBase}`;
    setExpandedTags({
      ...expandedTags,
      [key]: !expandedTags[key],
    });
  };

  const handleUpdateGroupName = (index, newName) => {
    const updatedGroups = [...groups];
    updatedGroups[index] = {
      ...updatedGroups[index],
      name: newName,
    };
    onChange({ ...(designGroups || {}), groups: updatedGroups });
  };

  const handleUpdateGroupClassName = (index, className) => {
    const updatedGroups = [...groups];
    updatedGroups[index] = {
      ...updatedGroups[index],
      className: className,
    };
    onChange({ ...(designGroups || {}), groups: updatedGroups });
  };

  // CSS Import Handlers
  const openImportModal = (type, groupIndex = null, elementKey = null) => {
    setImportModal({ type, groupIndex, elementKey });
    setImportCSSText('');
  };

  const closeImportModal = () => {
    setImportModal(null);
    setImportCSSText('');
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      setImportCSSText(e.target.result);
    };
    reader.readAsText(file);
    event.target.value = ''; // Reset file input
  };

  const handleImportCSS = () => {
    if (!importCSSText.trim()) {
      addNotification({ type: 'error', message: 'Please enter or upload CSS' });
      return;
    }

    try {
      if (importModal.type === 'global') {
        // Create new group from CSS
        const rules = parseCSSRules(importCSSText);
        const { elements, warnings } = cssToGroupElements(rules);

        if (Object.keys(elements).length === 0) {
          addNotification({ type: 'error', message: 'No valid CSS rules found' });
          return;
        }

        const name = `Imported Group ${groups.length + 1}`;
        const newGroup = {
          name,
          className: generateClassName(name),
          widget_type: null,
          slot: null,
          elements,
        };

        onChange({ ...(designGroups || {}), groups: [...groups, newGroup] });
        setExpandedGroups({ ...expandedGroups, [groups.length]: true });

        let message = `Created new group with ${Object.keys(elements).length} elements`;
        if (warnings.length > 0) {
          message += ` (${warnings.length} selectors skipped)`;
        }
        addNotification({ type: 'success', message });

      } else if (importModal.type === 'group') {
        // Update entire group
        const rules = parseCSSRules(importCSSText);
        const { elements, warnings } = cssToGroupElements(rules);

        if (Object.keys(elements).length === 0) {
          addNotification({ type: 'error', message: 'No valid CSS rules found' });
          return;
        }

        const updatedGroups = [...groups];
        updatedGroups[importModal.groupIndex] = {
          ...updatedGroups[importModal.groupIndex],
          elements,
        };
        onChange({ ...(designGroups || {}), groups: updatedGroups });

        let message = `Updated group with ${Object.keys(elements).length} elements`;
        if (warnings.length > 0) {
          message += ` (${warnings.length} selectors skipped)`;
        }
        addNotification({ type: 'success', message });

      } else if (importModal.type === 'element') {
        // Update single element
        const properties = cssToElementProperties(importCSSText);

        if (Object.keys(properties).length === 0) {
          addNotification({ type: 'error', message: 'No valid CSS properties found' });
          return;
        }

        const updatedGroups = [...groups];
        const currentStyles = updatedGroups[importModal.groupIndex].elements[importModal.elementKey] || {};

        updatedGroups[importModal.groupIndex] = {
          ...updatedGroups[importModal.groupIndex],
          elements: {
            ...updatedGroups[importModal.groupIndex].elements,
            [importModal.elementKey]: { ...currentStyles, ...properties },
          },
        };
        onChange({ ...(designGroups || {}), groups: updatedGroups });

        addNotification({
          type: 'success',
          message: `Updated ${importModal.elementKey} with ${Object.keys(properties).length} properties`
        });
      }

      closeImportModal();
    } catch (error) {
      addNotification({ type: 'error', message: `Failed to parse CSS: ${error.message}` });
    }
  };

  const handleUpdateElement = (groupIndex, element, property, value) => {
    const updatedGroups = [...groups];
    const currentStyles = updatedGroups[groupIndex].elements[element] || {};

    updatedGroups[groupIndex] = {
      ...updatedGroups[groupIndex],
      elements: {
        ...updatedGroups[groupIndex].elements,
        [element]: {
          ...currentStyles,
          [property]: value,
        },
      },
    };
    onChange({ ...(designGroups || {}), groups: updatedGroups });
  };

  const handleRemoveProperty = (groupIndex, element, property) => {
    const updatedGroups = [...groups];
    const newStyles = { ...updatedGroups[groupIndex].elements[element] };
    delete newStyles[property];

    updatedGroups[groupIndex] = {
      ...updatedGroups[groupIndex],
      elements: {
        ...updatedGroups[groupIndex].elements,
        [element]: newStyles,
      },
    };
    onChange({ ...(designGroups || {}), groups: updatedGroups });
  };

  const toggleEditMode = (groupIndex, tagBase, variant) => {
    const key = `${groupIndex}-${tagBase}-${variant}`;
    const currentMode = editMode[key] || 'form';

    // If switching from CSS to form, save the CSS first
    if (currentMode === 'css') {
      const ref = cssTextareaRefs.current[key];
      if (ref) {
        const cssText = ref.value;
        const styles = parseCSS(cssText);
        handleUpdateElement(groupIndex, variant, null, null);

        // Update all properties at once
        const updatedGroups = [...groups];
        updatedGroups[groupIndex] = {
          ...updatedGroups[groupIndex],
          elements: {
            ...updatedGroups[groupIndex].elements,
            [variant]: styles,
          },
        };
        onChange({ ...(designGroups || {}), groups: updatedGroups });
      }
    }

    setEditMode({
      ...editMode,
      [key]: currentMode === 'css' ? 'form' : 'css',
    });
  };

  const handleCSSBlur = (groupIndex, variant) => {
    const key = Object.keys(cssTextareaRefs.current).find(k => k.endsWith(`-${variant}`));
    if (!key) return;

    const ref = cssTextareaRefs.current[key];
    if (ref) {
      const cssText = ref.value;
      const styles = parseCSS(cssText);

      const updatedGroups = [...groups];
      updatedGroups[groupIndex] = {
        ...updatedGroups[groupIndex],
        elements: {
          ...updatedGroups[groupIndex].elements,
          [variant]: styles,
        },
      };
      onChange({ ...(designGroups || {}), groups: updatedGroups });
    }
  };

  const handleAddTagGroup = (groupIndex, tagGroup) => {
    const updatedGroups = [...groups];
    // Add the base tag with empty styles
    updatedGroups[groupIndex] = {
      ...updatedGroups[groupIndex],
      elements: {
        ...updatedGroups[groupIndex].elements,
        [tagGroup.base]: updatedGroups[groupIndex].elements[tagGroup.base] || {},
      },
    };
    onChange({ ...(designGroups || {}), groups: updatedGroups });

    // Auto-expand the new tag
    setExpandedTags({ ...expandedTags, [`${groupIndex}-${tagGroup.base}`]: true });
  };

  const handleRemoveTagGroup = (groupIndex, tagGroup) => {
    const updatedGroups = [...groups];
    const newElements = { ...updatedGroups[groupIndex].elements };

    // Remove all variants
    tagGroup.variants.forEach(variant => {
      delete newElements[variant];
    });

    updatedGroups[groupIndex] = {
      ...updatedGroups[groupIndex],
      elements: newElements,
    };
    onChange({ ...(designGroups || {}), groups: updatedGroups });
  };

  const handleCopyTag = (element, styles) => {
    setClipboard({ type: 'tag', element, data: styles });
    setCopiedIndicator(`tag-${element}`);
    setTimeout(() => setCopiedIndicator(null), 2000);
  };

  const handleCopyGroup = (group) => {
    setClipboard({ type: 'group', data: group.elements });
    setCopiedIndicator('group');
    setTimeout(() => setCopiedIndicator(null), 2000);
  };

  const handlePaste = (groupIndex, targetElement = null) => {
    if (!clipboard) return;

    const updatedGroups = [...groups];
    const currentElements = { ...updatedGroups[groupIndex].elements };

    if (clipboard.type === 'group') {
      // Paste full set - create tags if they don't exist, or merge if they do
      Object.entries(clipboard.data).forEach(([element, styles]) => {
        currentElements[element] = { ...currentElements[element], ...styles };
      });
    } else if (clipboard.type === 'tag' && targetElement) {
      // Paste single tag to selected tag
      currentElements[targetElement] = { ...currentElements[targetElement], ...clipboard.data };
    }

    updatedGroups[groupIndex] = {
      ...updatedGroups[groupIndex],
      elements: currentElements,
    };
    onChange({ ...(designGroups || {}), groups: updatedGroups });
  };

  const handleCloneGroup = (groupIndex) => {
    const groupToClone = groups[groupIndex];
    const newGroup = {
      ...groupToClone,
      name: `${groupToClone.name} (Copy)`,
      elements: JSON.parse(JSON.stringify(groupToClone.elements)), // Deep clone
    };

    const updatedTypography = {
      ...designGroups,
      groups: [...groups, newGroup],
    };
    onChange(updatedTypography);

    // Auto-expand the new group
    setExpandedGroups({ ...expandedGroups, [groups.length]: true });
  };

  const getTagGroupsInGroup = (group) => {
    const existingTags = new Set(Object.keys(group.elements || {}));
    const tagGroupsInGroup = [];

    TAG_GROUPS.forEach(tagGroup => {
      const hasAnyVariant = tagGroup.variants.some(v => existingTags.has(v));
      if (hasAnyVariant) {
        tagGroupsInGroup.push(tagGroup);
      }
    });

    return tagGroupsInGroup;
  };

  const getAvailableTagGroups = (group) => {
    const existingTags = new Set(Object.keys(group.elements || {}));
    return TAG_GROUPS.filter(tagGroup => !tagGroup.variants.some(v => existingTags.has(v)));
  };

  const renderPropertyField = (groupIndex, element, property, value) => {
    const propConfig = CSS_PROPERTIES[property];
    if (!propConfig) {
      return (
        <input
          type="text"
          value={value || ''}
          onChange={(e) => handleUpdateElement(groupIndex, element, property, e.target.value)}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md"
        />
      );
    }

    switch (propConfig.type) {
      case 'color':
        return (
          <ColorSelector
            value={value}
            onChange={(newValue) => handleUpdateElement(groupIndex, element, property, newValue)}
            colors={colors}
            className="w-full"
          />
        );

      case 'font':
        const currentStyles = groups[groupIndex].elements[element] || {};
        return (
          <FontSelector
            fontFamily={value}
            fontWeight={currentStyles.fontWeight}
            onFontFamilyChange={(newValue) => handleUpdateElement(groupIndex, element, property, newValue)}
            onFontWeightChange={(newWeight) => handleUpdateElement(groupIndex, element, 'fontWeight', newWeight)}
            fonts={fonts}
            className="w-full"
          />
        );

      case 'numeric':
        return (
          <NumericInput
            value={value}
            onChange={(newValue) => handleUpdateElement(groupIndex, element, property, newValue)}
            property={property}
            className="w-full"
          />
        );

      case 'select':
        return (
          <select
            value={value || ''}
            onChange={(e) => handleUpdateElement(groupIndex, element, property, e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">None</option>
            {propConfig.options.map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        );

      case 'text':
      default:
        return (
          <input
            type="text"
            value={value || ''}
            onChange={(e) => handleUpdateElement(groupIndex, element, property, e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Design Groups</h3>
        <div className="flex gap-2">
          <CopyButton
            data={designGroups}
            level="section"
            section="designGroups"
            label="Copy Design Groups"
            onSuccess={() => addNotification({ type: 'success', message: 'Design groups copied to clipboard' })}
            onError={(error) => addNotification({ type: 'error', message: `Failed to copy: ${error}` })}
          />
          <button
            type="button"
            onClick={() => openImportModal('global')}
            className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
            title="Import CSS to create new group"
          >
            <FileUp className="w-4 h-4 mr-2" />
            Import CSS
          </button>
          <button
            type="button"
            onClick={handleAddGroup}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Group
          </button>
        </div>
      </div>

      {/* Split layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Groups Editor - takes 2 columns */}
        <div className="lg:col-span-2 space-y-4">
          {groups.length > 0 ? (
            groups.map((group, groupIndex) => {
              const isExpanded = expandedGroups[groupIndex];
              const tagGroupsInGroup = getTagGroupsInGroup(group);
              const availableTagGroups = getAvailableTagGroups(group);

              return (
                <div
                  key={groupIndex}
                  className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm"
                >
                  {/* Group Header */}
                  <div className="p-4 bg-gradient-to-r from-gray-50 to-white border-b border-gray-200">
                    <div className="flex items-center gap-3 mb-2">
                      <button
                        type="button"
                        onClick={() => toggleGroup(groupIndex)}
                        className="text-gray-600 hover:text-gray-900 transition-colors"
                      >
                        {isExpanded ? (
                          <ChevronDown className="w-5 h-5" />
                        ) : (
                          <ChevronRight className="w-5 h-5" />
                        )}
                      </button>

                      <input
                        type="text"
                        value={group.name}
                        onChange={(e) => handleUpdateGroupName(groupIndex, e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Group name"
                      />

                      <div className="text-xs text-gray-500 font-medium">
                        {tagGroupsInGroup.length} tags
                      </div>

                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => openImportModal('group', groupIndex)}
                          className="p-2 text-green-600 hover:text-green-700 hover:bg-green-50 rounded transition-colors"
                          title="Import CSS to this group"
                        >
                          <FileUp className="w-4 h-4" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleCopyGroup(group)}
                          className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
                          title="Copy entire group"
                        >
                          {copiedIndicator === 'group' ? (
                            <Check className="w-4 h-4 text-green-600" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => handlePaste(groupIndex)}
                          disabled={!clipboard || clipboard.type !== 'group'}
                          className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Paste styles to all tags (creates tags if needed)"
                        >
                          <Clipboard className="w-4 h-4" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleCloneGroup(groupIndex)}
                          className="p-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors"
                          title="Clone this group"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveGroup(groupIndex)}
                        className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* ClassName Input */}
                    <div className="flex items-center gap-2 ml-11">
                      <label className="text-xs text-gray-600 font-medium">CSS Class:</label>
                      <input
                        type="text"
                        value={group.className || ''}
                        onChange={(e) => handleUpdateGroupClassName(groupIndex, e.target.value)}
                        className={`px-2 py-1 border rounded text-xs font-mono focus:outline-none focus:ring-2 ${group.className && !isValidClassName(group.className)
                            ? 'border-red-300 focus:ring-red-500 text-red-600'
                            : 'border-gray-300 focus:ring-blue-500'
                          }`}
                        placeholder="auto-generated"
                      />
                      <span className="text-xs text-gray-500">
                        {group.className ? `.${group.className}` : '(global scope)'}
                      </span>
                    </div>
                  </div>

                  {/* Group Content */}
                  {isExpanded && (
                    <div className="p-4 space-y-4">
                      {/* Add Tag Buttons */}
                      {availableTagGroups.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {availableTagGroups.map(tagGroup => (
                            <button
                              key={tagGroup.base}
                              type="button"
                              onClick={() => handleAddTagGroup(groupIndex, tagGroup)}
                              className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                              title={`Add ${tagGroup.label}`}
                            >
                              + {tagGroup.label}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Tag Groups */}
                      {tagGroupsInGroup.map((tagGroup) => {
                        const isTagExpanded = expandedTags[`${groupIndex}-${tagGroup.base}`] ?? !tagGroup.hasGroup;
                        const baseStyles = group.elements[tagGroup.base] || {};

                        return (
                          <div key={tagGroup.base} className="border border-gray-200 rounded-lg overflow-hidden">
                            {/* Tag Header */}
                            <div className="flex items-center gap-3 p-3 bg-gray-50 border-b border-gray-200">
                              {/* Only show toggle for links */}
                              {tagGroup.hasGroup && (
                                <button
                                  type="button"
                                  onClick={() => toggleTag(groupIndex, tagGroup.base)}
                                  className="text-gray-600 hover:text-gray-900"
                                >
                                  {isTagExpanded ? (
                                    <ChevronDown className="w-4 h-4" />
                                  ) : (
                                    <ChevronRight className="w-4 h-4" />
                                  )}
                                </button>
                              )}

                              <div className="flex-1">
                                <div className="font-mono text-sm font-semibold text-gray-900">{tagGroup.label}</div>
                                {tagGroup.hasGroup && (
                                  <div className="text-xs text-gray-500 font-mono">{tagGroup.variants.join(', ')}</div>
                                )}
                              </div>

                              <div className="flex gap-1">
                                <button
                                  type="button"
                                  onClick={() => openImportModal('element', groupIndex, tagGroup.base)}
                                  className="p-1.5 text-green-600 hover:text-green-700 hover:bg-green-50 rounded transition-colors"
                                  title="Import CSS for this element"
                                >
                                  <FileUp className="w-4 h-4" />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleCopyTag(tagGroup.base, baseStyles)}
                                  className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
                                  title="Copy tag styles"
                                >
                                  {copiedIndicator === `tag-${tagGroup.base}` ? (
                                    <Check className="w-4 h-4 text-green-600" />
                                  ) : (
                                    <Copy className="w-4 h-4" />
                                  )}
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handlePaste(groupIndex, tagGroup.base)}
                                  disabled={!clipboard || clipboard.type !== 'tag'}
                                  className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                  title="Paste tag styles"
                                >
                                  <Clipboard className="w-4 h-4" />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleRemoveTagGroup(groupIndex, tagGroup)}
                                  className="p-1.5 text-red-600 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>

                            {/* Tag Content */}
                            {isTagExpanded && (
                              <div className="p-4 space-y-4">
                                {/* Render each variant */}
                                {tagGroup.variants.map(variant => {
                                  const styles = group.elements[variant] || {};
                                  const styleEntries = Object.entries(styles);
                                  const editModeKey = `${groupIndex}-${tagGroup.base}-${variant}`;
                                  const currentEditMode = editMode[editModeKey] || 'form';

                                  return (
                                    <div key={variant} className="space-y-3 border-t border-gray-100 pt-3 first:border-t-0 first:pt-0">
                                      <div className="flex items-center justify-between">
                                        {variant !== tagGroup.base && (
                                          <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                                            {variant}
                                          </div>
                                        )}

                                        {/* Form/CSS Toggle */}
                                        <div className="flex gap-1 ml-auto">
                                          <button
                                            type="button"
                                            onClick={() => toggleEditMode(groupIndex, tagGroup.base, variant)}
                                            className={`inline-flex items-center px-2 py-1 text-xs rounded transition-colors ${currentEditMode === 'form'
                                              ? 'bg-blue-100 text-blue-700'
                                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                              }`}
                                          >
                                            <FileText className="w-3 h-3 mr-1" />
                                            Form
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => toggleEditMode(groupIndex, tagGroup.base, variant)}
                                            className={`inline-flex items-center px-2 py-1 text-xs rounded transition-colors ${currentEditMode === 'css'
                                              ? 'bg-blue-100 text-blue-700'
                                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                              }`}
                                          >
                                            <Code className="w-3 h-3 mr-1" />
                                            CSS
                                          </button>
                                        </div>
                                      </div>

                                      {currentEditMode === 'form' ? (
                                        /* Form View */
                                        <>
                                          {/* Existing Properties */}
                                          {styleEntries.map(([property, value]) => (
                                            <div key={property} className="flex gap-2 items-start">
                                              <div className="flex-1">
                                                <label className="block text-xs font-medium text-gray-600 mb-1">
                                                  {CSS_PROPERTIES[property]?.label || property}
                                                </label>
                                                {renderPropertyField(groupIndex, variant, property, value)}
                                              </div>
                                              <button
                                                type="button"
                                                onClick={() => handleRemoveProperty(groupIndex, variant, property)}
                                                className="mt-6 p-1 text-red-600 hover:text-red-700"
                                                title="Remove property"
                                              >
                                                <Trash2 className="w-4 h-4" />
                                              </button>
                                            </div>
                                          ))}

                                          {/* Add Property */}
                                          <div className="flex flex-wrap gap-2">
                                            {Object.entries(CSS_PROPERTIES)
                                              .filter(([prop]) => !styles[prop])
                                              .map(([prop, config]) => (
                                                <button
                                                  key={prop}
                                                  type="button"
                                                  onClick={() => handleUpdateElement(groupIndex, variant, prop, '')}
                                                  className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                                                  title={`Add ${config.label}`}
                                                >
                                                  + {config.label}
                                                </button>
                                              ))}
                                          </div>
                                        </>
                                      ) : (
                                        /* CSS View - uncontrolled with ref to prevent re-rendering */
                                        <textarea
                                          ref={(el) => {
                                            if (el) cssTextareaRefs.current[editModeKey] = el;
                                          }}
                                          defaultValue={stylesToCSS(styles)}
                                          onChange={() => {
                                            if (onDirty) onDirty();
                                          }}
                                          onBlur={() => handleCSSBlur(groupIndex, variant)}
                                          className="w-full px-3 py-2 text-sm font-mono border border-gray-300 rounded-md bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                          rows={Math.max(5, Object.keys(styles).length + 2)}
                                          placeholder="property: value;"
                                        />
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="text-center py-12 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50">
              <p className="text-gray-500">No typography groups yet. Click "Add Group" to get started.</p>
            </div>
          )}
        </div>

        {/* Preview - takes 1 column */}
        <div className="lg:sticky lg:top-6 lg:self-start">
          <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
            <h4 className="text-sm font-semibold text-gray-900 mb-3">Live Preview</h4>
            <DesignGroupsPreview designGroups={designGroups} colors={colors} />
          </div>
        </div>
      </div>

      {/* CSS Import Modal */}
      {importModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                Import CSS {
                  importModal.type === 'global' ? 'to Create New Group' :
                    importModal.type === 'group' ? 'to Update Group' :
                      `for ${importModal.elementKey}`
                }
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                {importModal.type === 'global' && 'Paste CSS rules with selectors (e.g., h1 { font-size: 2.5rem; })'}
                {importModal.type === 'group' && 'Paste CSS rules with selectors to update all elements in this group'}
                {importModal.type === 'element' && 'Paste CSS properties without selector (e.g., font-size: 2.5rem; color: blue;)'}
              </p>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* File Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Upload CSS File</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".css"
                  onChange={handleFileUpload}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
              </div>

              {/* Or Divider */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">or paste CSS</span>
                </div>
              </div>

              {/* CSS Textarea */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">CSS Code</label>
                <textarea
                  value={importCSSText}
                  onChange={(e) => setImportCSSText(e.target.value)}
                  placeholder={
                    importModal.type === 'element'
                      ? 'font-size: 2.5rem;\nfont-weight: 700;\ncolor: #333;'
                      : 'h1 {\n  font-size: 2.5rem;\n  font-weight: 700;\n}\n\np {\n  font-size: 1rem;\n  line-height: 1.6;\n}'
                  }
                  className="w-full h-64 px-3 py-2 border border-gray-300 rounded-md font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Preview Info */}
              {importCSSText.trim() && (
                <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                  <p className="text-sm text-blue-800">
                    {(() => {
                      try {
                        if (importModal.type === 'element') {
                          const props = cssToElementProperties(importCSSText);
                          const count = Object.keys(props).length;
                          return count > 0
                            ? `✓ ${count} CSS ${count === 1 ? 'property' : 'properties'} detected`
                            : '⚠ No valid CSS properties found';
                        } else {
                          const rules = parseCSSRules(importCSSText);
                          const { elements } = cssToGroupElements(rules);
                          const count = Object.keys(elements).length;
                          return count > 0
                            ? `✓ ${count} ${count === 1 ? 'element' : 'elements'} detected: ${Object.keys(elements).join(', ')}`
                            : '⚠ No valid CSS rules found';
                        }
                      } catch (error) {
                        return `⚠ Parse error: ${error.message}`;
                      }
                    })()}
                  </p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeImportModal}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleImportCSS}
                disabled={!importCSSText.trim()}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Import
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DesignGroupsTab;
