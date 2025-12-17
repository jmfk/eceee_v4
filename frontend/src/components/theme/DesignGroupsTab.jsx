/**
* Design Groups Tab Component - Polished Editor
* 
* Features:
* - Expandable design groups (all can be open simultaneously)
* - Form with theme-based selectors (colors, fonts)
* - Numeric inputs with steppers and unit selectors
* - Smart copy/paste (full set → all tags, single tag → selected tag)
* - Tags grouped with pseudo-classes
* - Group-level CSS editor (edit all CSS at once)
* - Clipboard paste support for CSS snippets (Ctrl+V/Cmd+V)
*/

import React, { useState, useRef, useEffect } from 'react';
import { Plus, Trash2, ChevronDown, ChevronRight, Copy, Check, Clipboard, Code, FileText, Upload, FileUp, Globe, Package, X, Search } from 'lucide-react';
import { createDesignGroup, generateClassName, getBreakpoints } from '../../utils/themeUtils';
import { parseCSSRules, cssToGroupElements, cssToElementProperties, groupElementsToCSS } from '../../utils/cssParser';
import { calculateSelectorsForGroup } from '../../utils/selectorCalculation';
import DesignGroupsPreview from './DesignGroupsPreview';
import ColorSelector from './form-fields/ColorSelector';
import FontSelector from './form-fields/FontSelector';
import NumericInput from './form-fields/NumericInput';
import CopyButton from './CopyButton';
import CalculatedSelectorsSection from './design-groups/CalculatedSelectorsSection';
import { useGlobalNotifications } from '../../contexts/GlobalNotificationContext';
import { useWidgets } from '../../hooks/useWidgets';
import ConfirmDialog from '../ConfirmDialog';
import { useQuery } from '@tanstack/react-query';
import layoutsApi from '../../api/layouts';
import ImagePropertyField from './design-groups/ImagePropertyField';
import LayoutPartEditor from './design-groups/layout-properties/LayoutPartEditor';

// Autocomplete Component for Widget Types
const WidgetTypeAutocomplete = ({ availableWidgets, onSelect, disabled }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);

  // Filter widgets based on search term
  const filteredWidgets = searchTerm
    ? availableWidgets.filter(w =>
      w.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      w.type.toLowerCase().includes(searchTerm.toLowerCase())
    )
    : availableWidgets;

  // Handle selection
  const handleSelect = (widget) => {
    onSelect(widget.type);
    setSearchTerm('');
    setIsOpen(false);
    setHighlightedIndex(0);
    inputRef.current?.blur();
  };

  // Handle keyboard navigation
  const handleKeyDown = (e) => {
    if (!isOpen && filteredWidgets.length > 0 && (e.key === 'ArrowDown' || e.key === 'Enter')) {
      setIsOpen(true);
      e.preventDefault();
      return;
    }

    if (!isOpen) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < filteredWidgets.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredWidgets[highlightedIndex]) {
          handleSelect(filteredWidgets[highlightedIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setSearchTerm('');
        inputRef.current?.blur();
        break;
      default:
        break;
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target) &&
        !inputRef.current?.contains(e.target)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Reset highlighted index when filtered list changes
  useEffect(() => {
    setHighlightedIndex(0);
  }, [searchTerm]);

  return (
    <div className="relative">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="+ Add widget type..."
          disabled={disabled}
          className="w-full pl-8 pr-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
        />
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
      </div>

      {isOpen && filteredWidgets.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded shadow-lg max-h-60 overflow-y-auto"
        >
          {filteredWidgets.map((widget, index) => (
            <button
              key={widget.type}
              type="button"
              onClick={() => handleSelect(widget)}
              className={`w-full px-3 py-2 text-left text-xs hover:bg-blue-50 transition-colors ${index === highlightedIndex ? 'bg-blue-50' : ''
                }`}
              onMouseEnter={() => setHighlightedIndex(index)}
            >
              <div className="font-medium text-gray-900">{widget.name}</div>
              <div className="text-gray-500 text-xs font-mono">{widget.type}</div>
            </button>
          ))}
        </div>
      )}

      {isOpen && searchTerm && filteredWidgets.length === 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded shadow-lg"
        >
          <div className="px-3 py-2 text-xs text-gray-500">
            No widgets found matching "{searchTerm}"
          </div>
        </div>
      )}
    </div>
  );
};

// Autocomplete Component for Slots
const SlotAutocomplete = ({ availableSlots, onSelect, disabled }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);

  // Filter slots based on search term
  const filteredSlots = searchTerm
    ? availableSlots.filter(slot =>
      slot.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (slot.layouts && slot.layouts.some(l => l.toLowerCase().includes(searchTerm.toLowerCase())))
    )
    : availableSlots;

  // Handle selection
  const handleSelect = (slot) => {
    onSelect(slot.name);
    setSearchTerm('');
    setIsOpen(false);
    setHighlightedIndex(0);
    inputRef.current?.blur();
  };

  // Handle keyboard navigation
  const handleKeyDown = (e) => {
    if (!isOpen && filteredSlots.length > 0 && (e.key === 'ArrowDown' || e.key === 'Enter')) {
      setIsOpen(true);
      e.preventDefault();
      return;
    }

    if (!isOpen) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < filteredSlots.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredSlots[highlightedIndex]) {
          handleSelect(filteredSlots[highlightedIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setSearchTerm('');
        inputRef.current?.blur();
        break;
      default:
        break;
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target) &&
        !inputRef.current?.contains(e.target)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Reset highlighted index when filtered list changes
  useEffect(() => {
    setHighlightedIndex(0);
  }, [searchTerm]);

  return (
    <div className="relative">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="+ Add slot..."
          disabled={disabled}
          className="w-full pl-8 pr-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
        />
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
      </div>

      {isOpen && filteredSlots.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded shadow-lg max-h-60 overflow-y-auto"
        >
          {filteredSlots.map((slot, index) => (
            <button
              key={slot.name}
              type="button"
              onClick={() => handleSelect(slot)}
              className={`w-full px-3 py-2 text-left text-xs hover:bg-blue-50 transition-colors ${index === highlightedIndex ? 'bg-blue-50' : ''
                }`}
              onMouseEnter={() => setHighlightedIndex(index)}
            >
              <div className="font-medium text-gray-900">{slot.name}</div>
              {slot.layouts && slot.layouts.length > 0 && (
                <div className="text-gray-500 text-xs">
                  {slot.layouts.length} layout{slot.layouts.length !== 1 ? 's' : ''}
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {isOpen && searchTerm && filteredSlots.length === 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded shadow-lg"
        >
          <div className="px-3 py-2 text-xs text-gray-500">
            No slots found matching "{searchTerm}"
          </div>
        </div>
      )}
    </div>
  );
};

// Convert camelCase CSS properties to kebab-case
const cssPropertyToKebab = (prop) => {
  return prop.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`);
};

// Layout property configuration
// Comprehensive CSS properties for widget layout parts
const LAYOUT_PROPERTIES = {
  // Layout & Sizing
  width: { type: 'text', label: 'Width', placeholder: 'auto, 100%, 400px' },
  height: { type: 'text', label: 'Height', placeholder: 'auto, 100%, 300px' },
  minWidth: { type: 'text', label: 'Min Width', placeholder: '0, 200px' },
  maxWidth: { type: 'text', label: 'Max Width', placeholder: 'none, 1200px' },
  minHeight: { type: 'text', label: 'Min Height', placeholder: '0, 100px' },
  maxHeight: { type: 'text', label: 'Max Height', placeholder: 'none, 500px' },
  padding: { type: 'text', label: 'Padding', placeholder: '1rem, 16px' },
  margin: { type: 'text', label: 'Margin', placeholder: '1rem, 0 auto' },
  gap: { type: 'text', label: 'Gap', placeholder: '1rem, 16px' },

  // Flexbox & Grid
  display: { type: 'select', label: 'Display', options: ['block', 'inline-block', 'flex', 'inline-flex', 'grid', 'inline-grid', 'none'] },
  flexDirection: { type: 'select', label: 'Flex Direction', options: ['row', 'row-reverse', 'column', 'column-reverse'] },
  justifyContent: { type: 'select', label: 'Justify Content', options: ['flex-start', 'flex-end', 'center', 'space-between', 'space-around', 'space-evenly'] },
  alignItems: { type: 'select', label: 'Align Items', options: ['flex-start', 'flex-end', 'center', 'baseline', 'stretch'] },
  alignSelf: { type: 'select', label: 'Align Self', options: ['auto', 'flex-start', 'flex-end', 'center', 'baseline', 'stretch'] },
  flexWrap: { type: 'select', label: 'Flex Wrap', options: ['nowrap', 'wrap', 'wrap-reverse'] },
  flexGrow: { type: 'text', label: 'Flex Grow', placeholder: '0, 1' },
  flexShrink: { type: 'text', label: 'Flex Shrink', placeholder: '0, 1' },
  gridTemplateColumns: { type: 'text', label: 'Grid Columns', placeholder: 'repeat(3, 1fr)' },
  gridTemplateRows: { type: 'text', label: 'Grid Rows', placeholder: 'auto, 1fr 2fr' },
  gridGap: { type: 'text', label: 'Grid Gap', placeholder: '1rem, 16px' },

  // Colors & Backgrounds
  backgroundColor: { type: 'color', label: 'Background Color', placeholder: '#ffffff' },
  backgroundImage: { type: 'image', label: 'Background Image' },
  color: { type: 'color', label: 'Text Color', placeholder: '#000000' },
  opacity: { type: 'text', label: 'Opacity', placeholder: '0.0 to 1.0' },

  // Borders
  border: { type: 'text', label: 'Border', placeholder: '1px solid #ccc' },
  borderTop: { type: 'text', label: 'Border Top', placeholder: '1px solid #ccc' },
  borderRight: { type: 'text', label: 'Border Right', placeholder: '1px solid #ccc' },
  borderBottom: { type: 'text', label: 'Border Bottom', placeholder: '1px solid #ccc' },
  borderLeft: { type: 'text', label: 'Border Left', placeholder: '1px solid #ccc' },
  borderColor: { type: 'color', label: 'Border Color', placeholder: '#cccccc' },
  borderWidth: { type: 'numeric', label: 'Border Width', placeholder: '1px' },
  borderStyle: { type: 'select', label: 'Border Style', options: ['none', 'solid', 'dashed', 'dotted', 'double'] },
  borderRadius: { type: 'numeric', label: 'Border Radius', placeholder: '4px' },
  borderTopWidth: { type: 'numeric', label: 'Border Top Width', placeholder: '1px' },
  borderRightWidth: { type: 'numeric', label: 'Border Right Width', placeholder: '1px' },
  borderBottomWidth: { type: 'numeric', label: 'Border Bottom Width', placeholder: '1px' },
  borderLeftWidth: { type: 'numeric', label: 'Border Left Width', placeholder: '1px' },
  borderTopLeftRadius: { type: 'numeric', label: 'Border Top Left Radius', placeholder: '4px' },
  borderTopRightRadius: { type: 'numeric', label: 'Border Top Right Radius', placeholder: '4px' },
  borderBottomLeftRadius: { type: 'numeric', label: 'Border Bottom Left Radius', placeholder: '4px' },
  borderBottomRightRadius: { type: 'numeric', label: 'Border Bottom Right Radius', placeholder: '4px' },

  // Typography
  fontFamily: { type: 'font', label: 'Font Family', placeholder: 'Arial, sans-serif' },
  fontSize: { type: 'numeric', label: 'Font Size', placeholder: '16px, 1rem' },
  fontWeight: { type: 'select', label: 'Font Weight', options: ['100', '200', '300', '400', '500', '600', '700', '800', '900', 'normal', 'bold', 'lighter', 'bolder'] },
  textAlign: { type: 'select', label: 'Text Align', options: ['left', 'center', 'right', 'justify'] },
  textDecoration: { type: 'select', label: 'Text Decoration', options: ['none', 'underline', 'overline', 'line-through'] },
  textTransform: { type: 'select', label: 'Text Transform', options: ['none', 'uppercase', 'lowercase', 'capitalize'] },
  lineHeight: { type: 'text', label: 'Line Height', placeholder: '1.5, 24px' },
  letterSpacing: { type: 'text', label: 'Letter Spacing', placeholder: 'normal, 0.05em' },

  // Images
  objectFit: { type: 'select', label: 'Object Fit', options: ['fill', 'contain', 'cover', 'none', 'scale-down'] },
  objectPosition: { type: 'text', label: 'Object Position', placeholder: 'center, 50% 50%' },

  // Positioning
  position: { type: 'select', label: 'Position', options: ['static', 'relative', 'absolute', 'fixed', 'sticky'] },
  top: { type: 'text', label: 'Top', placeholder: 'auto, 0, 10px' },
  right: { type: 'text', label: 'Right', placeholder: 'auto, 0, 10px' },
  bottom: { type: 'text', label: 'Bottom', placeholder: 'auto, 0, 10px' },
  left: { type: 'text', label: 'Left', placeholder: 'auto, 0, 10px' },
  zIndex: { type: 'text', label: 'Z-Index', placeholder: 'auto, 1, 10' },

  // Effects
  boxShadow: { type: 'text', label: 'Box Shadow', placeholder: '0 2px 4px rgba(0,0,0,0.1)' },
  transform: { type: 'text', label: 'Transform', placeholder: 'rotate(45deg), scale(1.2)' },
  transition: { type: 'text', label: 'Transition', placeholder: 'all 0.3s ease' },
};

// Breakpoint keys - mobile-first approach
// sm is the base (no media query), md/lg/xl use @media (min-width)
const getBreakpointKeys = () => {
  return ['sm', 'md', 'lg', 'xl'];
};

// Convert element styles object to CSS string
const stylesToCSS = (styles) => {
  if (!styles || Object.keys(styles).length === 0) return '';
  return Object.entries(styles)
    .map(([prop, value]) => {
      let sanitizedValue = value;

      // Sanitize font-family: remove all quotes, then re-quote fonts with spaces
      if (prop === 'fontFamily' && sanitizedValue) {
        const fonts = sanitizedValue.split(',');
        const quotedFonts = fonts.map(font => {
          // Remove ALL quotes (single, double, escaped)
          let cleaned = font.trim().replace(/['"\\]/g, '');

          // Generic font families that shouldn't be quoted
          const genericFamilies = ['serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui'];

          if (genericFamilies.includes(cleaned)) {
            return cleaned;
          } else if (cleaned.includes(' ')) {
            // Quote fonts with spaces
            return `"${cleaned}"`;
          } else {
            return cleaned;
          }
        });
        sanitizedValue = quotedFonts.join(', ');
      }

      // Sanitize duplicate units (e.g., "36pxpx" -> "36px")
      if (typeof sanitizedValue === 'string') {
        const duplicateUnitPattern = /^([-\d.]+)(px|rem|em|%|vh|vw|ch|ex)\2+$/;
        const match = sanitizedValue.match(duplicateUnitPattern);
        if (match) {
          sanitizedValue = `${match[1]}${match[2]}`;
        }
      }

      return `  ${cssPropertyToKebab(prop)}: ${sanitizedValue};`;
    })
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

/**
 * Normalize elements structure from imported data
 * Handles:
 * - Array to object conversion
 * - Null/undefined element values
 * - Snake_case to camelCase property key conversion
 * - Invalid data structures
 */
const normalizeElements = (elements) => {
  // Handle null, undefined, or non-object
  if (!elements || typeof elements !== 'object') {
    return {};
  }
  
  // Handle array (incorrect structure)
  if (Array.isArray(elements)) {
    console.warn('Design group elements is an array, converting to object');
    return {};
  }
  
  // Normalize each element
  const normalized = {};
  Object.entries(elements).forEach(([key, value]) => {
    // Skip null/undefined values
    if (value == null) {
      return;
    }
    
    // Ensure value is an object
    if (typeof value !== 'object' || Array.isArray(value)) {
      console.warn(`Element ${key} has invalid value type, skipping`);
      return;
    }
    
    // Convert property keys from snake_case to camelCase
    const normalizedValue = {};
    Object.entries(value).forEach(([propKey, propValue]) => {
      const camelKey = propKey.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
      normalizedValue[camelKey] = propValue;
    });
    
    normalized[key] = normalizedValue;
  });
  
  return normalized;
};

/**
 * Extract all unique filter options from design groups
 * @param {Array} groups - Array of design group objects
 * @param {Array} widgetTypes - Array of widget type objects with name and type
 * @returns {Array} Array of categorized filter options
 */
const extractFilterOptions = (groups, widgetTypes = []) => {
  const options = [];
  const seenWidgetTypes = new Set();
  const seenSlots = new Set();
  const seenSelectors = new Set();

  groups.forEach(group => {
    // Extract widget types
    const groupWidgetTypes = group.widgetTypes || (group.widgetType ? [group.widgetType] : []);
    groupWidgetTypes.forEach(wt => seenWidgetTypes.add(wt));

    // Extract slots
    const groupSlots = group.slots || (group.slot ? [group.slot] : []);
    groupSlots.forEach(slot => seenSlots.add(slot));

    // Extract selectors from calculatedSelectors
    if (group.calculatedSelectors) {
      // calculatedSelectors is an object with baseSelectors, elementSelectors, layoutPartSelectors
      if (group.calculatedSelectors.baseSelectors) {
        group.calculatedSelectors.baseSelectors.forEach(sel => seenSelectors.add(sel));
      }
    }

    // Extract selectors from targetCssClasses
    if (group.targetCssClasses) {
      const customSelectors = group.targetCssClasses.split(/[\n,]/).map(s => s.trim()).filter(Boolean);
      customSelectors.forEach(sel => seenSelectors.add(sel));
    }
  });

  // Add widget type options
  Array.from(seenWidgetTypes).sort().forEach(wtType => {
    const widgetMeta = widgetTypes.find(wt => wt.type === wtType);
    options.push({
      value: `widgetType:${wtType}`,
      label: widgetMeta?.name || wtType,
      category: 'Widget Types',
      filterType: 'widgetType',
      filterValue: wtType
    });
  });

  // Add slot options
  Array.from(seenSlots).sort().forEach(slot => {
    options.push({
      value: `slot:${slot}`,
      label: slot,
      category: 'Slots',
      filterType: 'slot',
      filterValue: slot
    });
  });

  // Add selector options (limit to reasonable number)
  Array.from(seenSelectors).sort().slice(0, 50).forEach(selector => {
    options.push({
      value: `selector:${selector}`,
      label: selector,
      category: 'Selectors',
      filterType: 'selector',
      filterValue: selector
    });
  });

  return options;
};

const DesignGroupsTab = ({ themeId, designGroups, colors, fonts, breakpoints, onChange, onDirty }) => {
  const groups = designGroups?.groups || [];

  const [expandedContent, setExpandedContent] = useState({});
  const [expandedTags, setExpandedTags] = useState({});
  const [expandedTargeting, setExpandedTargeting] = useState({});
  const [expandedLayoutProps, setExpandedLayoutProps] = useState({});
  const [expandedLayoutParts, setExpandedLayoutParts] = useState({}); // { groupIndex-part: boolean }
  const [expandedLayoutBreakpoints, setExpandedLayoutBreakpoints] = useState({}); // { groupIndex-part-breakpoint: boolean }
  const [clipboard, setClipboard] = useState(null); // { type: 'tag' | 'group', data: {...} }
  const [copiedIndicator, setCopiedIndicator] = useState(null);
  const [editMode, setEditMode] = useState({}); // { groupIndex-tagBase-variant: 'form' | 'css' }
  const [groupEditMode, setGroupEditMode] = useState({}); // { groupIndex: 'tags' | 'css' }
  const [layoutEditMode, setLayoutEditMode] = useState({}); // { groupIndex: 'form' | 'css' }
  const [importModal, setImportModal] = useState(null); // { type: 'global' | 'group' | 'element', groupIndex?: number, elementKey?: string }
  const [importMode, setImportMode] = useState('css'); // 'css' | 'json'
  const [importCSSText, setImportCSSText] = useState('');
  const [importJSONText, setImportJSONText] = useState('');
  const [layoutInputValues, setLayoutInputValues] = useState({}); // Local state for layout property inputs
  const layoutDebounceTimerRef = useRef({});
  const [elementInputValues, setElementInputValues] = useState({}); // Local state for element property inputs
  const elementDebounceTimerRef = useRef({});
  const [groupNameValues, setGroupNameValues] = useState({}); // Local state for group name inputs
  const groupNameDebounceTimerRef = useRef({});
  const { addNotification } = useGlobalNotifications();
  const selectorsCalculatedRef = useRef(new Set()); // Track which groups have had selectors calculated

  // Confirmation dialog state for widget type removal
  const [widgetTypeRemovalDialog, setWidgetTypeRemovalDialog] = useState(null); // { groupIndex, widgetType, hasProperties }

  // Filter state
  const [filterValue, setFilterValue] = useState(null); // { type: 'widgetType' | 'slot' | 'selector', value: string }

  // Fetch widget types from API
  const { widgetTypes = [], isLoadingTypes } = useWidgets();

  // Fetch all available slots from layouts
  const { data: slotsData, isLoading: isLoadingSlots } = useQuery({
    queryKey: ['allSlots'],
    queryFn: async () => {
      try {
        const response = await layoutsApi.codeLayouts.allSlots(true);
        return response || { slots: [], total: 0 };
      } catch (error) {
        console.error('Error fetching all slots:', error);
        return { slots: [], total: 0 };
      }
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  const availableSlots = slotsData?.slots || [];

  // Calculate selectors for all groups that are missing them
  useEffect(() => {
    if (!groups || groups.length === 0) return;

    // Check if any groups need their selectors calculated
    const groupsNeedingCalculation = groups.filter((group, index) => {
      const groupKey = `${index}-${group.name || ''}-${JSON.stringify(group.widgetTypes || [])}-${JSON.stringify(group.slots || [])}`;
      return !group.calculatedSelectors && !selectorsCalculatedRef.current.has(groupKey);
    });

    if (groupsNeedingCalculation.length > 0) {
      const updatedGroups = groups.map((group, index) => {
        const groupKey = `${index}-${group.name || ''}-${JSON.stringify(group.widgetTypes || [])}-${JSON.stringify(group.slots || [])}`;

        if (!group.calculatedSelectors && !selectorsCalculatedRef.current.has(groupKey)) {
          selectorsCalculatedRef.current.add(groupKey);
          return {
            ...group,
            calculatedSelectors: calculateSelectorsForGroup(group)
          };
        }
        return group;
      });

      // Update with calculated selectors
      onChange({ ...(designGroups || {}), groups: updatedGroups });
    }
  }, [groups, designGroups, onChange]); // Run when groups change


  // Cleanup debounce timers on unmount
  useEffect(() => {
    return () => {
      Object.values(layoutDebounceTimerRef.current).forEach(timer => {
        if (timer) clearTimeout(timer);
      });
      Object.values(elementDebounceTimerRef.current).forEach(timer => {
        if (timer) clearTimeout(timer);
      });
      Object.values(groupNameDebounceTimerRef.current).forEach(timer => {
        if (timer) clearTimeout(timer);
      });
    };
  }, []);

  // Get theme breakpoints with defaults
  const themeBreakpoints = getBreakpoints({ breakpoints });
  const BREAKPOINTS = getBreakpointKeys(); // ['sm', 'md', 'lg', 'xl']

  // Get breakpoint label for display
  const getBreakpointLabel = (bp) => {
    const labels = {
      sm: 'sm',
      md: `md (≥${themeBreakpoints.md}px)`,
      lg: `lg (≥${themeBreakpoints.lg}px)`,
      xl: `xl (≥${themeBreakpoints.xl}px)`,
    };
    return labels[bp] || bp;
  };

  // Get part label for display
  const getPartLabel = (part, selectedWidgetTypes) => {
    // Check widget metadata for label
    if (selectedWidgetTypes && selectedWidgetTypes.length > 0) {
      for (const wtType of selectedWidgetTypes) {
        const widgetMeta = widgetTypes.find(wt => wt.type === wtType);
        if (widgetMeta?.layoutParts?.[part]?.label) {
          return widgetMeta.layoutParts[part].label;
        }
      }
    }

    // Fallback: format the part name
    return part
      .replace(/[-_]/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  // Refs for CSS textarea to prevent re-rendering
  const cssTextareaRefs = useRef({});
  const fileInputRef = useRef(null);

  const handleAddGroup = () => {
    const baseFont = fonts?.googleFonts?.[0]?.family || 'Inter';
    // Name first group "Default", others sequentially
    const groupName = groups.length === 0 ? 'Default' : `Group ${groups.length + 1}`;
    // First group is default
    const isDefault = groups.length === 0;
    const newGroup = createDesignGroup(groupName, `${baseFont}, sans-serif`, isDefault);
    const updatedDesignGroups = {
      ...(designGroups || {}),
      groups: [...groups, newGroup],
    };
    onChange(updatedDesignGroups);
  };

  const handleRemoveGroup = (index) => {
    const updatedGroups = groups.filter((_, i) => i !== index);
    onChange({ ...(designGroups || {}), groups: updatedGroups });
  };

  const toggleContent = (index) => {
    setExpandedContent({
      ...expandedContent,
      [index]: !expandedContent[index],
    });
  };

  const toggleTag = (groupIndex, tagBase) => {
    const key = `${groupIndex}-${tagBase}`;
    setExpandedTags({
      ...expandedTags,
      [key]: !expandedTags[key],
    });
  };

  const toggleTargeting = (groupIndex) => {
    setExpandedTargeting({
      ...expandedTargeting,
      [groupIndex]: !expandedTargeting[groupIndex],
    });
  };

  const handleUpdateGroupName = (index, newName) => {
    // Store in local state immediately for responsive typing
    setGroupNameValues(prev => ({
      ...prev,
      [index]: newName,
    }));

    // Clear any existing timer
    if (groupNameDebounceTimerRef.current[index]) {
      clearTimeout(groupNameDebounceTimerRef.current[index]);
    }

    // Debounce the actual update
    groupNameDebounceTimerRef.current[index] = setTimeout(() => {
      const updatedGroups = [...groups];
      updatedGroups[index] = {
        ...updatedGroups[index],
        name: newName,
      };
      onChange({ ...(designGroups || {}), groups: updatedGroups });

      // Clear local state after successful update
      setGroupNameValues(prev => {
        const newState = { ...prev };
        delete newState[index];
        return newState;
      });
    }, 500);

    if (onDirty) onDirty();
  };

  const handleGroupNameBlur = (index) => {
    // Clear any pending debounce timer
    if (groupNameDebounceTimerRef.current[index]) {
      clearTimeout(groupNameDebounceTimerRef.current[index]);
    }

    // Trigger immediate update with current local value
    const value = groupNameValues[index];
    if (value !== undefined) {
      const updatedGroups = [...groups];
      updatedGroups[index] = {
        ...updatedGroups[index],
        name: value,
      };
      onChange({ ...(designGroups || {}), groups: updatedGroups });

      // Clear local state
      setGroupNameValues(prev => {
        const newState = { ...prev };
        delete newState[index];
        return newState;
      });
    }
  };

  const handleUpdateWidgetTypes = (index, selectedTypes) => {
    const updatedGroups = [...groups];
    updatedGroups[index] = {
      ...updatedGroups[index],
      widgetTypes: selectedTypes,
      // Keep old field for backward compatibility
      widgetType: selectedTypes.length === 1 ? selectedTypes[0] : null,
    };
    // Recalculate selectors immediately
    updatedGroups[index].calculatedSelectors = calculateSelectorsForGroup(updatedGroups[index]);
    onChange({ ...(designGroups || {}), groups: updatedGroups });
  };

  const handleAddWidgetType = (groupIndex, widgetType) => {
    const group = groups[groupIndex];
    const currentTypes = group.widgetTypes || (group.widgetType ? [group.widgetType] : []);

    // Don't add if already exists
    if (currentTypes.includes(widgetType)) {
      return;
    }

    const newTypes = [...currentTypes, widgetType];
    handleUpdateWidgetTypes(groupIndex, newTypes);
    if (onDirty) onDirty();
  };

  const handleRemoveWidgetType = (groupIndex, widgetType) => {
    const group = groups[groupIndex];

    // Check if this widget type has any layout properties defined
    const hasProperties = group.layoutProperties && Object.keys(group.layoutProperties).some(part => {
      // Check if this part belongs to the widget type being removed
      const widgetMeta = widgetTypes.find(wt => wt.type === widgetType);
      if (widgetMeta?.layoutParts?.[part]) {
        // This part belongs to the widget, check if it has properties
        const partProps = group.layoutProperties[part];
        return partProps && Object.keys(partProps).length > 0;
      }
      return false;
    });

    if (hasProperties) {
      // Show confirmation dialog
      setWidgetTypeRemovalDialog({ groupIndex, widgetType, hasProperties: true });
    } else {
      // Remove directly
      performRemoveWidgetType(groupIndex, widgetType);
    }
  };

  const performRemoveWidgetType = (groupIndex, widgetType) => {
    const group = groups[groupIndex];
    const currentTypes = group.widgetTypes || (group.widgetType ? [group.widgetType] : []);
    const newTypes = currentTypes.filter(t => t !== widgetType);

    handleUpdateWidgetTypes(groupIndex, newTypes);
    if (onDirty) onDirty();

    // Close dialog if open
    setWidgetTypeRemovalDialog(null);
  };

  const handleUpdateSlots = (index, slotsString) => {
    const updatedGroups = [...groups];
    // Parse comma-separated slots
    const slotsArray = slotsString ? slotsString.split(',').map(s => s.trim()).filter(Boolean) : [];
    updatedGroups[index] = {
      ...updatedGroups[index],
      slots: slotsArray,
      // Keep old field for backward compatibility
      slot: slotsArray.length === 1 ? slotsArray[0] : null,
    };
    onChange({ ...(designGroups || {}), groups: updatedGroups });
  };

  const handleAddSlot = (groupIndex, slotName) => {
    const group = groups[groupIndex];
    const currentSlots = group.slots || (group.slot ? [group.slot] : []);

    // Don't add if already exists
    if (currentSlots.includes(slotName)) {
      return;
    }

    const newSlots = [...currentSlots, slotName];
    const updatedGroups = [...groups];
    updatedGroups[groupIndex] = {
      ...updatedGroups[groupIndex],
      slots: newSlots,
      slot: newSlots.length === 1 ? newSlots[0] : null,
    };
    // Recalculate selectors immediately
    updatedGroups[groupIndex].calculatedSelectors = calculateSelectorsForGroup(updatedGroups[groupIndex]);
    onChange({ ...(designGroups || {}), groups: updatedGroups });
    if (onDirty) onDirty();
  };

  const handleRemoveSlot = (groupIndex, slotName) => {
    const group = groups[groupIndex];
    const currentSlots = group.slots || (group.slot ? [group.slot] : []);
    const newSlots = currentSlots.filter(s => s !== slotName);

    const updatedGroups = [...groups];
    updatedGroups[groupIndex] = {
      ...updatedGroups[groupIndex],
      slots: newSlots,
      slot: newSlots.length === 1 ? newSlots[0] : null,
    };
    // Recalculate selectors immediately
    updatedGroups[groupIndex].calculatedSelectors = calculateSelectorsForGroup(updatedGroups[groupIndex]);
    onChange({ ...(designGroups || {}), groups: updatedGroups });
    if (onDirty) onDirty();
  };

  const handleUpdateTargetingMode = (index, mode) => {
    const updatedGroups = [...groups];
    updatedGroups[index] = {
      ...updatedGroups[index],
      targetingMode: mode,
    };
    // Recalculate selectors immediately
    updatedGroups[index].calculatedSelectors = calculateSelectorsForGroup(updatedGroups[index]);
    onChange({ ...(designGroups || {}), groups: updatedGroups });
  };

  const handleUpdateTargetCssClasses = (index, cssClasses) => {
    const updatedGroups = [...groups];
    updatedGroups[index] = {
      ...updatedGroups[index],
      targetCssClasses: cssClasses,
    };
    // Recalculate selectors immediately
    updatedGroups[index].calculatedSelectors = calculateSelectorsForGroup(updatedGroups[index]);
    onChange({ ...(designGroups || {}), groups: updatedGroups });
  };

  const handleToggleDefault = (index) => {
    const updatedGroups = groups.map((group, i) => ({
      ...group,
      isDefault: i === index
    }));
    onChange({ ...(designGroups || {}), groups: updatedGroups });
  };

  const toggleLayoutProps = (groupIndex) => {
    setExpandedLayoutProps({
      ...expandedLayoutProps,
      [groupIndex]: !expandedLayoutProps[groupIndex],
    });
  };

  const handleUpdateLayoutProperty = (groupIndex, part, breakpoint, property, value, immediate = false) => {
    const key = `${groupIndex}-${part}-${breakpoint}-${property}`;

    // Update local input state immediately
    setLayoutInputValues(prev => ({
      ...prev,
      [key]: value
    }));

    // Clear previous debounce timer for this specific property
    if (layoutDebounceTimerRef.current[key]) {
      clearTimeout(layoutDebounceTimerRef.current[key]);
    }

    // Function to perform the actual update
    const performUpdate = () => {
      const updatedGroups = [...groups];
      const layoutProperties = updatedGroups[groupIndex].layoutProperties || {};
      const partProps = layoutProperties[part] || {};
      const breakpointProps = partProps[breakpoint] || {};

      // Update or remove property
      if (value === null) {
        // Only delete if explicitly set to null (user wants to remove)
        delete breakpointProps[property];
      } else {
        // Keep the property even if empty string (allows field to show)
        breakpointProps[property] = value;
      }

      // Clean up empty objects
      if (Object.keys(breakpointProps).length === 0) {
        delete partProps[breakpoint];
      } else {
        partProps[breakpoint] = breakpointProps;
      }

      if (Object.keys(partProps).length === 0) {
        delete layoutProperties[part];
      } else {
        layoutProperties[part] = partProps;
      }

      updatedGroups[groupIndex] = {
        ...updatedGroups[groupIndex],
        layoutProperties: Object.keys(layoutProperties).length > 0 ? layoutProperties : undefined,
      };

      // Recalculate selectors to include layout part selectors
      updatedGroups[groupIndex].calculatedSelectors = calculateSelectorsForGroup(updatedGroups[groupIndex]);

      onChange({ ...(designGroups || {}), groups: updatedGroups });
      if (onDirty) onDirty();

      // Clear the local input value after successful update
      setLayoutInputValues(prev => {
        const newState = { ...prev };
        delete newState[key];
        return newState;
      });
    };

    // Either update immediately or debounce
    if (immediate) {
      performUpdate();
    } else {
      layoutDebounceTimerRef.current[key] = setTimeout(performUpdate, 500);
    }
  };

  const handleLayoutPropertyBlur = (groupIndex, part, breakpoint, property) => {
    const key = `${groupIndex}-${part}-${breakpoint}-${property}`;

    // Clear any pending debounce timer
    if (layoutDebounceTimerRef.current[key]) {
      clearTimeout(layoutDebounceTimerRef.current[key]);
    }

    // Trigger immediate update with current local value
    const value = layoutInputValues[key];
    if (value !== undefined) {
      handleUpdateLayoutProperty(groupIndex, part, breakpoint, property, value, true);
    }
  };

  const handleAddLayoutPart = (groupIndex, part) => {
    const updatedGroups = [...groups];
    const layoutProperties = updatedGroups[groupIndex].layoutProperties || {};

    // Only initialize if the part doesn't exist
    if (!(part in layoutProperties)) {
      // Initialize the part with empty sm breakpoint (mobile-first base)
      layoutProperties[part] = { sm: {} };

      updatedGroups[groupIndex] = {
        ...updatedGroups[groupIndex],
        layoutProperties
      };

      // Recalculate selectors when layout parts are added
      updatedGroups[groupIndex].calculatedSelectors = calculateSelectorsForGroup(updatedGroups[groupIndex]);

      onChange({ ...(designGroups || {}), groups: updatedGroups });
      if (onDirty) onDirty();
    }

    // Always ensure Layout Properties section is expanded
    if (!expandedLayoutProps[groupIndex]) {
      setExpandedLayoutProps({ ...expandedLayoutProps, [groupIndex]: true });
    }

    // Always auto-expand the part (whether new or existing)
    const partKey = `${groupIndex}-${part}`;
    setExpandedLayoutParts({ ...expandedLayoutParts, [partKey]: true });
  };

  const handleRemoveLayoutPart = (groupIndex, part) => {
    const updatedGroups = [...groups];
    const layoutProperties = updatedGroups[groupIndex].layoutProperties || {};

    // Remove the part
    delete layoutProperties[part];

    updatedGroups[groupIndex] = {
      ...updatedGroups[groupIndex],
      layoutProperties: Object.keys(layoutProperties).length > 0 ? layoutProperties : undefined
    };

    // Recalculate selectors when layout parts are removed
    updatedGroups[groupIndex].calculatedSelectors = calculateSelectorsForGroup(updatedGroups[groupIndex]);

    onChange({ ...(designGroups || {}), groups: updatedGroups });
    if (onDirty) onDirty();

    // Remove from expanded state
    const partKey = `${groupIndex}-${part}`;
    const newExpandedLayoutParts = { ...expandedLayoutParts };
    delete newExpandedLayoutParts[partKey];
    setExpandedLayoutParts(newExpandedLayoutParts);
  };

  const handleRemoveBreakpoint = (groupIndex, part, breakpoint) => {
    const updatedGroups = [...groups];
    const layoutProperties = updatedGroups[groupIndex].layoutProperties || {};
    const partProps = layoutProperties[part] || {};

    // Check if breakpoint has properties
    const breakpointProps = partProps[breakpoint] || {};
    const hasProperties = Object.keys(breakpointProps).length > 0;

    // Show confirmation if breakpoint has properties
    if (hasProperties) {
      const confirmed = window.confirm(
        `This breakpoint has ${Object.keys(breakpointProps).length} property/properties. Are you sure you want to remove it?`
      );
      if (!confirmed) return;
    }

    // Remove the breakpoint
    delete partProps[breakpoint];

    // If part has no breakpoints left, remove the part entirely
    if (Object.keys(partProps).length === 0) {
      delete layoutProperties[part];
    } else {
      layoutProperties[part] = partProps;
    }

    updatedGroups[groupIndex] = {
      ...updatedGroups[groupIndex],
      layoutProperties: Object.keys(layoutProperties).length > 0 ? layoutProperties : undefined
    };

    onChange({ ...(designGroups || {}), groups: updatedGroups });
    if (onDirty) onDirty();

    // Remove from expanded state
    const breakpointKey = `${groupIndex}-${part}-${breakpoint}`;
    const newExpandedLayoutBreakpoints = { ...expandedLayoutBreakpoints };
    delete newExpandedLayoutBreakpoints[breakpointKey];
    setExpandedLayoutBreakpoints(newExpandedLayoutBreakpoints);
  };

  const handleAddBreakpoint = (groupIndex, part, breakpoint) => {
    const updatedGroups = [...groups];
    const layoutProperties = updatedGroups[groupIndex].layoutProperties || {};
    const partProps = layoutProperties[part] || {};

    partProps[breakpoint] = {}; // Initialize with empty object
    layoutProperties[part] = partProps;

    updatedGroups[groupIndex] = {
      ...updatedGroups[groupIndex],
      layoutProperties
    };

    onChange({ ...(designGroups || {}), groups: updatedGroups });
    if (onDirty) onDirty();

    // Auto-expand the new breakpoint
    const breakpointKey = `${groupIndex}-${part}-${breakpoint}`;
    setExpandedLayoutBreakpoints({ ...expandedLayoutBreakpoints, [breakpointKey]: true });
  };

  const handleAddProperty = (groupIndex, part, breakpoint, property) => {
    // Initialize property with empty string (will show the form field)
    handleUpdateLayoutProperty(groupIndex, part, breakpoint, property, '', true);
  };

  // Convert layout properties to CSS
  const layoutPropertiesToCSS = (layoutProperties, groupIndex) => {
    if (!layoutProperties || Object.keys(layoutProperties).length === 0) return '';

    const cssParts = [];
    const effectiveBreakpoints = getBreakpoints({ breakpoints });

    // Get selected widget types for this group to look up selectors
    const group = groups[groupIndex];
    const selectedWidgetTypes = group?.widgetTypes || (group?.widgetType ? [group.widgetType] : []);

    // Build part selector map from widget metadata
    const partSelectorMap = {};  // part_id -> custom selector
    if (selectedWidgetTypes.length > 0) {
      selectedWidgetTypes.forEach(wtType => {
        const widgetMeta = widgetTypes.find(wt => wt.type === wtType);
        if (widgetMeta?.layoutParts) {
          Object.entries(widgetMeta.layoutParts).forEach(([partId, partConfig]) => {
            if (partConfig?.selector) {
              partSelectorMap[partId] = partConfig.selector;
            }
          });
        }
      });
    }

    // Helper to convert property value (handle color references)
    const formatPropertyValue = (prop, value) => {
      const cssProp = cssPropertyToKebab(prop);

      // Check if this is a color property and value is a named color
      const colorProperties = ['color', 'backgroundColor', 'borderColor', 'borderLeftColor',
        'borderRightColor', 'borderTopColor', 'borderBottomColor'];

      if (colorProperties.includes(prop) && colors[value]) {
        return `  ${cssProp}: var(--${value});\n`;
      }

      return `  ${cssProp}: ${value};\n`;
    };

    for (const [part, bpStyles] of Object.entries(layoutProperties)) {
      // Use custom selector if available, otherwise fallback to .{part}
      const selector = partSelectorMap[part] || `.${part}`;

      // Default (no media query)
      if (bpStyles.default && Object.keys(bpStyles.default).length > 0) {
        let cssRule = `${selector} {\n`;
        for (const [prop, value] of Object.entries(bpStyles.default)) {
          cssRule += formatPropertyValue(prop, value);
        }
        cssRule += '}';
        cssParts.push(cssRule);
      }

      // Legacy desktop support (migrate to default)
      else if (bpStyles.desktop && Object.keys(bpStyles.desktop).length > 0) {
        let cssRule = `${selector} {\n`;
        for (const [prop, value] of Object.entries(bpStyles.desktop)) {
          cssRule += formatPropertyValue(prop, value);
        }
        cssRule += '}';
        cssParts.push(cssRule);
      }

      // Generate media queries for each breakpoint (mobile-first)
      ['sm', 'md', 'lg', 'xl'].forEach(bp => {
        if (bpStyles[bp] && Object.keys(bpStyles[bp]).length > 0 && effectiveBreakpoints[bp]) {
          let cssRule = `@media (min-width: ${effectiveBreakpoints[bp]}px) {\n  ${selector} {\n`;
          for (const [prop, value] of Object.entries(bpStyles[bp])) {
            cssRule += '  ' + formatPropertyValue(prop, value);
          }
          cssRule += '  }\n}';
          cssParts.push(cssRule);
        }
      });

      // Legacy tablet support (migrate to md)
      if (bpStyles.tablet && Object.keys(bpStyles.tablet).length > 0 && !bpStyles.md) {
        let cssRule = `@media (min-width: ${effectiveBreakpoints.md}px) {\n  ${selector} {\n`;
        for (const [prop, value] of Object.entries(bpStyles.tablet)) {
          cssRule += '  ' + formatPropertyValue(prop, value);
        }
        cssRule += '  }\n}';
        cssParts.push(cssRule);
      }

      // Legacy mobile support (migrate to sm)
      if (bpStyles.mobile && Object.keys(bpStyles.mobile).length > 0 && !bpStyles.sm) {
        let cssRule = `@media (min-width: ${effectiveBreakpoints.sm}px) {\n  ${selector} {\n`;
        for (const [prop, value] of Object.entries(bpStyles.mobile)) {
          cssRule += '  ' + formatPropertyValue(prop, value);
        }
        cssRule += '  }\n}';
        cssParts.push(cssRule);
      }
    }

    return cssParts.join('\n\n');
  };

  // Convert CSS to layout properties
  const cssToLayoutProperties = (cssText, groupIndex) => {
    const layoutProperties = {};

    // Get selected widget types for this group to build selector-to-partId map
    const group = groups[groupIndex];
    const selectedWidgetTypes = group?.widgetTypes || (group?.widgetType ? [group.widgetType] : []);

    // Build reverse map: selector -> part_id
    const selectorToPartMap = {};  // selector -> part_id
    const partIdSet = new Set();  // All known part IDs
    if (selectedWidgetTypes.length > 0) {
      selectedWidgetTypes.forEach(wtType => {
        const widgetMeta = widgetTypes.find(wt => wt.type === wtType);
        if (widgetMeta?.layoutParts) {
          Object.entries(widgetMeta.layoutParts).forEach(([partId, partConfig]) => {
            partIdSet.add(partId);
            if (partConfig?.selector) {
              // Store custom selector mapping
              selectorToPartMap[partConfig.selector] = partId;
            }
          });
        }
      });
    }

    try {
      // Parse default (non-media query) rules
      // Match both class selectors (.part) and custom selectors
      const defaultRules = cssText.match(/([.#][\w-]+(?:\s+[.#\w\s>+~:[\]()="'-]+)?)\s*\{([^}]+)\}/g);
      if (defaultRules) {
        defaultRules.forEach(rule => {
          const match = rule.match(/([.#][\w-]+(?:\s+[.#\w\s>+~:[\]()="'-]+)?)\s*\{([^}]+)\}/);
          if (match) {
            const selector = match[1].trim();
            const properties = match[2];

            // Try to map selector to part ID
            let part = null;
            if (selectorToPartMap[selector]) {
              // Custom selector matches
              part = selectorToPartMap[selector];
            } else if (selector.startsWith('.') && !selector.includes(' ')) {
              // Simple class selector - extract part ID
              const className = selector.substring(1);
              if (partIdSet.has(className)) {
                part = className;
              }
            }

            if (part) {
              if (!layoutProperties[part]) layoutProperties[part] = {};
              if (!layoutProperties[part].default) layoutProperties[part].default = {};

              const propMatches = properties.matchAll(/\s*([a-z-]+)\s*:\s*([^;]+);/g);
              for (const propMatch of propMatches) {
                const cssProp = propMatch[1];
                const value = propMatch[2].trim();
                const camelProp = cssProp.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
                layoutProperties[part].default[camelProp] = value;
              }
            }
          }
        });
      }

      // Parse breakpoint media queries (mobile-first)
      const effectiveBreakpoints = getBreakpoints({ breakpoints });
      ['sm', 'md', 'lg', 'xl'].forEach(bp => {
        const bpValue = effectiveBreakpoints[bp];
        if (!bpValue) return;

        const regex = new RegExp(`@media\\s*\\(min-width:\\s*${bpValue}px\\)\\s*\\{([\\s\\S]*?)\\n\\}`, 'g');
        const matches = cssText.matchAll(regex);

        for (const match of matches) {
          const content = match[1];
          const rules = content.matchAll(/([.#][\w-]+(?:\s+[.#\w\s>+~:[\]()="'-]+)?)\s*\{([^}]+)\}/g);

          for (const rule of rules) {
            const selector = rule[1].trim();
            const properties = rule[2];

            // Try to map selector to part ID
            let part = null;
            if (selectorToPartMap[selector]) {
              // Custom selector matches
              part = selectorToPartMap[selector];
            } else if (selector.startsWith('.') && !selector.includes(' ')) {
              // Simple class selector - extract part ID
              const className = selector.substring(1);
              if (partIdSet.has(className)) {
                part = className;
              }
            }

            if (part) {
              if (!layoutProperties[part]) layoutProperties[part] = {};
              if (!layoutProperties[part][bp]) layoutProperties[part][bp] = {};

              const propMatches = properties.matchAll(/\s*([a-z-]+)\s*:\s*([^;]+);/g);
              for (const propMatch of propMatches) {
                const cssProp = propMatch[1];
                const value = propMatch[2].trim();
                const camelProp = cssProp.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
                layoutProperties[part][bp][camelProp] = value;
              }
            }
          }
        }
      });

    } catch (error) {
      console.error('Error parsing layout CSS:', error);
      throw new Error('Invalid CSS format');
    }

    return layoutProperties;
  };

  const handleLayoutCSSBlur = (groupIndex) => {
    const textarea = cssTextareaRefs.current[`layout-${groupIndex}`];
    if (!textarea) return;

    try {
      const cssText = textarea.value;
      const layoutProperties = cssToLayoutProperties(cssText, groupIndex);

      const updatedGroups = [...groups];
      updatedGroups[groupIndex] = {
        ...updatedGroups[groupIndex],
        layoutProperties: Object.keys(layoutProperties).length > 0 ? layoutProperties : undefined,
      };

      onChange({ ...(designGroups || {}), groups: updatedGroups });
      if (onDirty) onDirty();
    } catch (error) {
      addNotification({
        type: 'error',
        message: `Failed to parse layout CSS: ${error.message}`
      });
    }
  };

  // Import Handlers
  const openImportModal = (type, groupIndex = null, elementKey = null) => {
    setImportModal({ type, groupIndex, elementKey });
    setImportMode('css');
    setImportCSSText('');
    setImportJSONText('');
  };

  const closeImportModal = () => {
    setImportModal(null);
    setImportMode('css');
    setImportCSSText('');
    setImportJSONText('');
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Detect file type and set mode
    const fileName = file.name.toLowerCase();
    if (fileName.endsWith('.json')) {
      setImportMode('json');
    } else if (fileName.endsWith('.css')) {
      setImportMode('css');
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      if (fileName.endsWith('.json')) {
        setImportJSONText(e.target.result);
      } else {
        setImportCSSText(e.target.result);
      }
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
          isDefault: false,
          widgetTypes: [],
          slots: [],
          widgetType: null,
          slot: null,
          elements,
        };

        onChange({ ...(designGroups || {}), groups: [...groups, newGroup] });

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

  // JSON Import Handler
  const handleImportJSON = () => {
    const jsonText = importJSONText.trim();
    if (!jsonText) {
      addNotification({ type: 'error', message: 'Please enter or upload JSON' });
      return;
    }

    try {
      let parsedData;
      try {
        parsedData = JSON.parse(jsonText);
      } catch (parseError) {
        addNotification({ type: 'error', message: `Invalid JSON syntax: ${parseError.message}` });
        return;
      }

      if (importModal.type === 'global') {
        // Create new group(s) from JSON
        let groupsToAdd = [];

        // Check for theme copy/paste format first
        let groupsData = null;
        if (parsedData.type === 'theme-settings' && parsedData.data?.groups) {
          // Theme copy/paste format: { type: 'theme-settings', data: { groups: [...] } }
          groupsData = parsedData.data.groups;
        } else if (parsedData.groups && Array.isArray(parsedData.groups)) {
          // Direct format: { groups: [...] }
          groupsData = parsedData.groups;
        }

        // Auto-detect format
        if (groupsData) {
          groupsToAdd = groupsData.map(group => {
            const newGroup = {
              name: group.name || `Imported Group ${groups.length + 1}`,
              className: group.className || generateClassName(group.name || `Imported Group ${groups.length + 1}`),
              isDefault: group.isDefault || false,
              widgetTypes: group.widgetTypes || group.widget_types || [],
              slots: group.slots || [],
              widgetType: group.widgetType || group.widget_type || null,
              slot: group.slot || null,
              targetingMode: group.targetingMode || group.targeting_mode || 'widget-slot',
              targetCssClasses: group.targetCssClasses || group.target_css_classes || null,
              colorScheme: group.colorScheme || group.color_scheme || { background: null, text: null },
              elements: normalizeElements(group.elements || {}),
              layoutProperties: group.layoutProperties || group.layout_properties || {},
              // Preserve calculatedSelectors if present, otherwise it will be recalculated
              ...(group.calculatedSelectors && { calculatedSelectors: group.calculatedSelectors }),
            };
            return newGroup;
          });
        } else if (parsedData.name || parsedData.elements) {
          // Single group format: { name, elements, ... }
          const newGroup = {
            name: parsedData.name || `Imported Group ${groups.length + 1}`,
            className: parsedData.className || generateClassName(parsedData.name || `Imported Group ${groups.length + 1}`),
            isDefault: parsedData.isDefault || false,
            widgetTypes: parsedData.widgetTypes || parsedData.widget_types || [],
            slots: parsedData.slots || [],
            widgetType: parsedData.widgetType || parsedData.widget_type || null,
            slot: parsedData.slot || null,
            targetingMode: parsedData.targetingMode || parsedData.targeting_mode || 'widget-slot',
            targetCssClasses: parsedData.targetCssClasses || parsedData.target_css_classes || null,
            colorScheme: parsedData.colorScheme || parsedData.color_scheme || { background: null, text: null },
            elements: normalizeElements(parsedData.elements || {}),
            layoutProperties: parsedData.layoutProperties || parsedData.layout_properties || {},
            // Preserve calculatedSelectors if present
            ...(parsedData.calculatedSelectors && { calculatedSelectors: parsedData.calculatedSelectors }),
          };
          groupsToAdd = [newGroup];
        } else {
          addNotification({ type: 'error', message: 'Invalid JSON format. Expected theme copy/paste format ({ type: "theme-settings", data: { groups: [...] } }), direct format ({ groups: [...] }), or single group format ({ name, elements, ... })' });
          return;
        }

        if (groupsToAdd.length === 0) {
          addNotification({ type: 'error', message: 'No valid groups found in JSON' });
          return;
        }

        const updatedGroups = [...groups, ...groupsToAdd];
        onChange({ ...(designGroups || {}), groups: updatedGroups });

        // Auto-expand new groups
        const newExpandedContent = { ...expandedContent };
        groupsToAdd.forEach((_, index) => {
          newExpandedContent[groups.length + index] = true;
        });
        setExpandedContent(newExpandedContent);

        addNotification({
          type: 'success',
          message: `Created ${groupsToAdd.length} ${groupsToAdd.length === 1 ? 'group' : 'groups'} from JSON`
        });

      } else if (importModal.type === 'group') {
        // Update existing group with JSON data
        if (!parsedData.elements && !parsedData.layoutProperties && !parsedData.layout_properties) {
          addNotification({ type: 'error', message: 'JSON must contain elements or layoutProperties to update a group' });
          return;
        }

        const updatedGroups = [...groups];
        const currentGroup = updatedGroups[importModal.groupIndex];

        // Merge with existing group data
        updatedGroups[importModal.groupIndex] = {
          ...currentGroup,
          ...(parsedData.name && { name: parsedData.name }),
          ...(parsedData.className && { className: parsedData.className }),
          ...(parsedData.isDefault !== undefined && { isDefault: parsedData.isDefault }),
          ...(parsedData.widgetTypes && { widgetTypes: parsedData.widgetTypes }),
          ...(parsedData.widget_types && { widgetTypes: parsedData.widget_types }),
          ...(parsedData.slots && { slots: parsedData.slots }),
          ...(parsedData.widgetType !== undefined && { widgetType: parsedData.widgetType }),
          ...(parsedData.widget_type !== undefined && { widgetType: parsedData.widget_type }),
          ...(parsedData.slot !== undefined && { slot: parsedData.slot }),
          ...(parsedData.targetingMode && { targetingMode: parsedData.targetingMode }),
          ...(parsedData.targeting_mode && { targetingMode: parsedData.targeting_mode }),
          ...(parsedData.targetCssClasses !== undefined && { targetCssClasses: parsedData.targetCssClasses }),
          ...(parsedData.target_css_classes !== undefined && { targetCssClasses: parsedData.target_css_classes }),
          ...(parsedData.colorScheme && { colorScheme: parsedData.colorScheme }),
          ...(parsedData.color_scheme && { colorScheme: parsedData.color_scheme }),
          ...(parsedData.elements && { elements: { ...currentGroup.elements, ...normalizeElements(parsedData.elements) } }),
          ...(parsedData.layoutProperties && { layoutProperties: { ...currentGroup.layoutProperties, ...parsedData.layoutProperties } }),
          ...(parsedData.layout_properties && { layoutProperties: { ...currentGroup.layoutProperties, ...parsedData.layout_properties } }),
        };

        onChange({ ...(designGroups || {}), groups: updatedGroups });
        addNotification({ type: 'success', message: 'Updated group from JSON' });

      } else if (importModal.type === 'element') {
        // Update single element properties from JSON object
        if (typeof parsedData !== 'object' || Array.isArray(parsedData)) {
          addNotification({ type: 'error', message: 'Element import expects a JSON object with property names and values' });
          return;
        }

        const updatedGroups = [...groups];
        const currentStyles = updatedGroups[importModal.groupIndex].elements[importModal.elementKey] || {};

        // Normalize property keys (snake_case to camelCase)
        const normalizedProperties = {};
        Object.entries(parsedData).forEach(([propKey, propValue]) => {
          const camelKey = propKey.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
          normalizedProperties[camelKey] = propValue;
        });

        // Merge properties
        updatedGroups[importModal.groupIndex] = {
          ...updatedGroups[importModal.groupIndex],
          elements: {
            ...updatedGroups[importModal.groupIndex].elements,
            [importModal.elementKey]: { ...currentStyles, ...normalizedProperties },
          },
        };

        onChange({ ...(designGroups || {}), groups: updatedGroups });
        addNotification({
          type: 'success',
          message: `Updated ${importModal.elementKey} with ${Object.keys(normalizedProperties).length} ${Object.keys(normalizedProperties).length === 1 ? 'property' : 'properties'}`
        });
      }

      closeImportModal();
    } catch (error) {
      addNotification({ type: 'error', message: `Failed to import JSON: ${error.message}` });
    }
  };

  const handleUpdateElement = (groupIndex, element, property, value, immediate = false) => {
    const key = `${groupIndex}-${element}-${property}`;

    // Update local input state immediately for responsive UI
    setElementInputValues(prev => ({
      ...prev,
      [key]: value
    }));

    // Clear previous debounce timer for this specific property
    if (elementDebounceTimerRef.current[key]) {
      clearTimeout(elementDebounceTimerRef.current[key]);
    }

    // Function to perform the actual update
    const performUpdate = () => {
      const updatedGroups = [...groups];
      const currentStyles = updatedGroups[groupIndex].elements[element] || {};

      // Validate element structure
      if (!currentStyles || typeof currentStyles !== 'object' || Array.isArray(currentStyles)) {
        console.error('Invalid element structure:', { groupIndex, element, currentStyles });
        addNotification({
          type: 'error',
          message: `Cannot edit ${element}: data structure is corrupted. Try removing and re-adding the element.`
        });
        return;
      }

      // Validate CSS values and warn about common issues
      if (value && typeof value === 'string') {
        // Check for duplicate units (e.g., "36pxpx", "2remrem")
        const duplicateUnitPattern = /(px|rem|em|%|vh|vw|ch|ex){2,}/;
        if (duplicateUnitPattern.test(value)) {
          addNotification({
            type: 'warning',
            message: `Invalid CSS value "${value}" for ${property} - contains duplicate units. Please correct this value.`
          });
        }

        // Check for triple quotes in font-family
        if (property === 'fontFamily' && (value.includes('"""') || value.includes("'''"))) {
          addNotification({
            type: 'warning',
            message: `Invalid font-family value "${value}" - contains triple quotes. Please correct this value.`
          });
        }

        // Check for malformed numeric values
        const numericProperties = ['fontSize', 'lineHeight', 'marginTop', 'marginBottom', 'letterSpacing', 'padding', 'margin'];
        if (numericProperties.includes(property)) {
          // Value should be: number + unit, or just a number (unitless)
          const validNumericPattern = /^-?\d+(\.\d+)?(px|rem|em|%|vh|vw|ch|ex)?$/;
          if (!validNumericPattern.test(value) && value !== '' && value !== 'auto' && value !== 'inherit' && value !== 'normal') {
            addNotification({
              type: 'warning',
              message: `Invalid numeric value "${value}" for ${property}. Expected format: number + unit (e.g., "16px", "1.5rem")`
            });
          }
        }
      }

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

      // Clear the local input value after successful update
      setElementInputValues(prev => {
        const newState = { ...prev };
        delete newState[key];
        return newState;
      });
    };

    // Either update immediately or debounce
    if (immediate) {
      performUpdate();
    } else {
      elementDebounceTimerRef.current[key] = setTimeout(performUpdate, 500);
    }
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

  const handleElementPropertyBlur = (groupIndex, element, property) => {
    const key = `${groupIndex}-${element}-${property}`;

    // Clear any pending debounce timer
    if (elementDebounceTimerRef.current[key]) {
      clearTimeout(elementDebounceTimerRef.current[key]);
    }

    // Trigger immediate update with current local value
    const value = elementInputValues[key];
    if (value !== undefined) {
      handleUpdateElement(groupIndex, element, property, value, true);
    }
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

  // Toggle group edit mode between 'tags' and 'css'
  const toggleGroupEditMode = (groupIndex) => {
    const currentMode = groupEditMode[groupIndex] || 'tags';

    // If switching from CSS to tags, save the CSS first
    if (currentMode === 'css') {
      const ref = cssTextareaRefs.current[`group-${groupIndex}`];
      if (ref) {
        handleGroupCSSBlur(groupIndex);
      }
    }

    setGroupEditMode({
      ...groupEditMode,
      [groupIndex]: currentMode === 'css' ? 'tags' : 'css',
    });
  };

  // Handle group CSS blur (save changes)
  const handleGroupCSSBlur = (groupIndex) => {
    const ref = cssTextareaRefs.current[`group-${groupIndex}`];
    if (!ref) return;

    const cssText = ref.value;
    try {
      const rules = parseCSSRules(cssText);
      const { elements, warnings } = cssToGroupElements(rules);

      // Replace entire elements object
      const updatedGroups = [...groups];
      updatedGroups[groupIndex] = {
        ...updatedGroups[groupIndex],
        elements: elements,
      };
      onChange({ ...(designGroups || {}), groups: updatedGroups });

      if (warnings.length > 0) {
        addNotification({
          type: 'warning',
          message: `Updated group CSS (${warnings.length} selectors skipped)`
        });
      }
    } catch (error) {
      addNotification({
        type: 'error',
        message: `Failed to parse CSS: ${error.message}`
      });
    }
  };

  // Tag/Element-level paste handler  
  const handleElementPaste = async (e, groupIndex, elementKey) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain').trim();

    if (!text) return;

    try {
      // Parse as CSS properties (no selector)
      const properties = cssToElementProperties(text);

      if (Object.keys(properties).length > 0) {
        const updatedGroups = [...groups];
        const currentStyles = updatedGroups[groupIndex].elements[elementKey] || {};

        updatedGroups[groupIndex] = {
          ...updatedGroups[groupIndex],
          elements: {
            ...updatedGroups[groupIndex].elements,
            [elementKey]: { ...currentStyles, ...properties }
          }
        };
        onChange({ ...(designGroups || {}), groups: updatedGroups });

        addNotification({
          type: 'success',
          message: `Pasted ${Object.keys(properties).length} properties to ${elementKey}`
        });
      } else {
        addNotification({
          type: 'warning',
          message: 'No valid CSS properties found in clipboard'
        });
      }
    } catch (error) {
      addNotification({
        type: 'error',
        message: `Failed to paste: ${error.message}`
      });
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
      isDefault: false, // Clones are never default
      elements: JSON.parse(JSON.stringify(groupToClone.elements)), // Deep clone
    };

    const updatedTypography = {
      ...designGroups,
      groups: [...groups, newGroup],
    };
    onChange(updatedTypography);
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
    const key = `${groupIndex}-${element}-${property}`;
    const storedValue = value || '';
    const displayValue = elementInputValues[key] !== undefined ? elementInputValues[key] : storedValue;

    if (!propConfig) {
      return (
        <input
          type="text"
          value={displayValue}
          onChange={(e) => handleUpdateElement(groupIndex, element, property, e.target.value)}
          onBlur={() => handleElementPropertyBlur(groupIndex, element, property)}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md"
        />
      );
    }

    switch (propConfig.type) {
      case 'color':
        return (
          <ColorSelector
            value={displayValue}
            onChange={(newValue) => handleUpdateElement(groupIndex, element, property, newValue, true)}
            colors={colors}
            className="w-full"
          />
        );

      case 'font':
        const currentStyles = groups[groupIndex].elements[element] || {};
        return (
          <FontSelector
            fontFamily={displayValue}
            fontWeight={currentStyles.fontWeight}
            onFontFamilyChange={(newValue) => handleUpdateElement(groupIndex, element, property, newValue, true)}
            onFontWeightChange={(newWeight) => handleUpdateElement(groupIndex, element, 'fontWeight', newWeight, true)}
            fonts={fonts}
            className="w-full"
          />
        );

      case 'numeric':
        return (
          <NumericInput
            value={displayValue}
            onChange={(newValue) => handleUpdateElement(groupIndex, element, property, newValue)}
            onBlur={() => handleElementPropertyBlur(groupIndex, element, property)}
            property={property}
            className="w-full"
          />
        );

      case 'select':
        return (
          <select
            value={displayValue}
            onChange={(e) => handleUpdateElement(groupIndex, element, property, e.target.value, true)}
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
            value={displayValue}
            onChange={(e) => handleUpdateElement(groupIndex, element, property, e.target.value)}
            onBlur={() => handleElementPropertyBlur(groupIndex, element, property)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        );
    }
  };

  // Extract filter options from all groups
  const filterOptions = extractFilterOptions(groups, widgetTypes);

  // Filter groups based on selected filter (OR logic - match ANY criteria)
  const filteredGroups = filterValue ? groups.filter((group, index) => {
    const { filterType, filterValue: fValue } = filterValue;

    if (filterType === 'widgetType') {
      const groupWidgetTypes = group.widgetTypes || (group.widgetType ? [group.widgetType] : []);
      return groupWidgetTypes.includes(fValue);
    } else if (filterType === 'slot') {
      const groupSlots = group.slots || (group.slot ? [group.slot] : []);
      return groupSlots.includes(fValue);
    } else if (filterType === 'selector') {
      // Check in calculatedSelectors
      if (group.calculatedSelectors?.baseSelectors?.includes(fValue)) {
        return true;
      }
      // Check in targetCssClasses
      if (group.targetCssClasses) {
        const customSelectors = group.targetCssClasses.split(/[\n,]/).map(s => s.trim()).filter(Boolean);
        return customSelectors.includes(fValue);
      }
      return false;
    }
    return false;
  }) : groups;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="text-lg font-semibold text-gray-900" role="heading" aria-level="3">Design Groups</div>
        <div className="flex gap-2 items-center">
          {/* Filter Combobox */}
          <div className="relative">
            <select
              value={filterValue ? filterValue.value : ''}
              onChange={(e) => {
                if (!e.target.value) {
                  setFilterValue(null);
                } else {
                  const option = filterOptions.find(opt => opt.value === e.target.value);
                  if (option) {
                    setFilterValue({ filterType: option.filterType, filterValue: option.filterValue, value: option.value, label: option.label });
                  }
                }
              }}
              className="pl-3 pr-10 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="">Filter by... ({filteredGroups.length}/{groups.length})</option>
              {filterOptions.length > 0 && (
                <>
                  {['Widget Types', 'Slots', 'Selectors'].map(category => {
                    const categoryOptions = filterOptions.filter(opt => opt.category === category);
                    if (categoryOptions.length === 0) return null;
                    return (
                      <optgroup key={category} label={category}>
                        {categoryOptions.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </optgroup>
                    );
                  })}
                </>
              )}
            </select>
            {filterValue && (
              <button
                type="button"
                onClick={() => setFilterValue(null)}
                className="absolute right-8 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded"
                title="Clear filter"
              >
                <X className="w-3 h-3 text-gray-500" />
              </button>
            )}
            <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
              <ChevronDown className="w-4 h-4 text-gray-400" />
            </div>
          </div>
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
          {filteredGroups.length > 0 ? (
            filteredGroups.map((group, groupIndex) => {
              // Get original group index for handlers
              const originalGroupIndex = groups.indexOf(group);
              const tagGroupsInGroup = getTagGroupsInGroup(group);
              const availableTagGroups = getAvailableTagGroups(group);

              return (
                <div
                  key={originalGroupIndex}
                  className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm"
                >
                  {/* Group Header */}
                  <div className="p-4 bg-gradient-to-r from-gray-50 to-white border-b border-gray-200">
                    <div className="flex items-center gap-3 mb-2">
                      {/* Default Group Radio Button */}
                      <div className="flex items-center gap-1" title="Mark as default/base group">
                        <input
                          type="radio"
                          id={`default-group-${originalGroupIndex}`}
                          name="default-group"
                          checked={group.isDefault === true}
                          onChange={() => handleToggleDefault(originalGroupIndex)}
                          className="w-4 h-4 text-blue-600 focus:ring-2 focus:ring-blue-500"
                        />
                        <label
                          htmlFor={`default-group-${originalGroupIndex}`}
                          className="text-xs text-gray-600 font-medium cursor-pointer"
                        >
                          Default
                        </label>
                      </div>

                      <input
                        type="text"
                        value={groupNameValues[originalGroupIndex] ?? group.name}
                        onChange={(e) => handleUpdateGroupName(originalGroupIndex, e.target.value)}
                        onBlur={() => handleGroupNameBlur(originalGroupIndex)}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Group name"
                      />

                      {/* Targeting Badge */}
                      {group.targetingMode === 'css-classes' && group.targetCssClasses ? (
                        <div className="flex items-center gap-1 px-2 py-1 bg-purple-50 text-purple-700 text-xs rounded-md border border-purple-200">
                          <Code className="w-3 h-3" />
                          <span className="font-mono max-w-[200px] truncate" title={group.targetCssClasses}>
                            {group.targetCssClasses.split(/[\n,]/).filter(Boolean).length} selector{group.targetCssClasses.split(/[\n,]/).filter(Boolean).length !== 1 ? 's' : ''}
                          </span>
                        </div>
                      ) : (group.widgetTypes?.length > 0 || group.widgetType || group.slots?.length > 0 || group.slot) ? (
                        <div className="flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-md border border-blue-200">
                          <Package className="w-3 h-3" />
                          <span>
                            {(() => {
                              const types = group.widgetTypes?.length > 0 ? group.widgetTypes : (group.widgetType ? [group.widgetType] : []);
                              const slots = group.slots?.length > 0 ? group.slots : (group.slot ? [group.slot] : []);

                              let text = types.length > 0
                                ? types.map(t => widgetTypes.find(w => w.type === t)?.name || t).join(', ')
                                : 'Any';

                              if (slots.length > 0) {
                                text += ` > ${slots.join(', ')}`;
                              }

                              return text;
                            })()}
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 px-2 py-1 bg-gray-50 text-gray-600 text-xs rounded-md border border-gray-200">
                          <Globe className="w-3 h-3" />
                          <span>Global</span>
                        </div>
                      )}

                      <div className="text-xs text-gray-500 font-medium">
                        {tagGroupsInGroup.length} tags
                      </div>

                      <div className="flex gap-1">
                        {/* Toggle between Tags and CSS mode */}
                        <button
                          type="button"
                          onClick={() => toggleGroupEditMode(originalGroupIndex)}
                          className={`inline-flex items-center px-3 py-1.5 text-xs font-medium rounded transition-colors ${(groupEditMode[originalGroupIndex] || 'tags') === 'css'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                          title={(groupEditMode[originalGroupIndex] || 'tags') === 'css' ? 'Switch to tag editor' : 'Edit all CSS'}
                        >
                          {(groupEditMode[originalGroupIndex] || 'tags') === 'css' ? (
                            <>
                              <FileText className="w-3 h-3 mr-1" />
                              Tags
                            </>
                          ) : (
                            <>
                              <Code className="w-3 h-3 mr-1" />
                              CSS
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => openImportModal('group', originalGroupIndex)}
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
                          onClick={() => handlePaste(originalGroupIndex)}
                          disabled={!clipboard || clipboard.type !== 'group'}
                          className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Paste styles to all tags (creates tags if needed)"
                        >
                          <Clipboard className="w-4 h-4" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleCloneGroup(originalGroupIndex)}
                          className="p-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors"
                          title="Clone this group"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveGroup(originalGroupIndex)}
                        className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Targeting Section */}
                  <div className="border-t border-gray-200">
                    <button
                      type="button"
                      onClick={() => toggleTargeting(originalGroupIndex)}
                      className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                    >
                      {expandedTargeting[originalGroupIndex] ? (
                        <ChevronDown size={18} className="text-gray-600" />
                      ) : (
                        <ChevronRight size={18} className="text-gray-600" />
                      )}
                      <span className="text-sm font-semibold text-gray-900">
                        Targeting
                      </span>
                    </button>

                    {expandedTargeting[originalGroupIndex] && (
                      <div className="px-4 pb-4">
                        {/* Targeting Mode Toggle */}
                        <div className="mb-4 flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleUpdateTargetingMode(originalGroupIndex, 'widget-slot')}
                            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${(group.targetingMode || 'widget-slot') === 'widget-slot'
                              ? 'bg-blue-100 text-blue-700 border border-blue-300'
                              : 'bg-gray-100 text-gray-600 border border-gray-300 hover:bg-gray-200'
                              }`}
                          >
                            Widget/Slot
                          </button>
                          <button
                            type="button"
                            onClick={() => handleUpdateTargetingMode(originalGroupIndex, 'css-classes')}
                            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${group.targetingMode === 'css-classes'
                              ? 'bg-blue-100 text-blue-700 border border-blue-300'
                              : 'bg-gray-100 text-gray-600 border border-gray-300 hover:bg-gray-200'
                              }`}
                          >
                            CSS Classes
                          </button>
                        </div>

                        {(group.targetingMode || 'widget-slot') === 'widget-slot' ? (
                          <div className="grid grid-cols-2 gap-4">
                            {/* Widget Types (select and add with pills) */}
                            <div>
                              <label className="block text-xs text-gray-700 font-medium mb-1">Apply to Widget Types:</label>

                              {/* Autocomplete to add widget types */}
                              <WidgetTypeAutocomplete
                                availableWidgets={(() => {
                                  const selectedTypes = group.widgetTypes || (group.widgetType ? [group.widgetType] : []);
                                  return widgetTypes.filter(wt => !selectedTypes.includes(wt.type));
                                })()}
                                onSelect={(widgetType) => handleAddWidgetType(originalGroupIndex, widgetType)}
                                disabled={isLoadingTypes}
                              />
                              <div className="text-xs text-gray-500 mt-1">Search and select widget types to apply this design group. Empty = all widgets</div>

                              {/* Selected widget types as pills */}
                              {(() => {
                                const selectedTypes = group.widgetTypes || (group.widgetType ? [group.widgetType] : []);
                                return selectedTypes.length > 0 && (
                                  <div className="flex flex-wrap gap-1.5 mt-2">
                                    {selectedTypes.map(wtType => {
                                      const widgetMeta = widgetTypes.find(wt => wt.type === wtType);
                                      return (
                                        <div
                                          key={wtType}
                                          className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded border border-blue-200"
                                        >
                                          <span>{widgetMeta?.name || wtType}</span>
                                          <button
                                            type="button"
                                            onClick={() => handleRemoveWidgetType(originalGroupIndex, wtType)}
                                            className="hover:bg-blue-200 rounded-sm p-0.5 transition-colors"
                                            title="Remove widget type"
                                          >
                                            <X className="w-3 h-3" />
                                          </button>
                                        </div>
                                      );
                                    })}
                                  </div>
                                );
                              })()}
                            </div>

                            {/* Slots (pills and autocomplete) */}
                            <div>
                              <label className="block text-xs text-gray-700 font-medium mb-1">Apply to Slots:</label>

                              {/* Autocomplete to add slots */}
                              <SlotAutocomplete
                                availableSlots={(() => {
                                  const selectedSlots = group.slots || (group.slot ? [group.slot] : []);
                                  return availableSlots.filter(slot => !selectedSlots.includes(slot.name));
                                })()}
                                onSelect={(slotName) => handleAddSlot(originalGroupIndex, slotName)}
                                disabled={isLoadingSlots}
                              />
                              <div className="text-xs text-gray-500 mt-1">Search and select slots to apply this design group. Empty = all slots</div>

                              {/* Selected slots as pills */}
                              {(() => {
                                const selectedSlots = group.slots || (group.slot ? [group.slot] : []);
                                return selectedSlots.length > 0 && (
                                  <div className="flex flex-wrap gap-1.5 mt-2">
                                    {selectedSlots.map(slotName => (
                                      <div
                                        key={slotName}
                                        className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-green-100 text-green-700 rounded border border-green-200"
                                      >
                                        <span>{slotName}</span>
                                        <button
                                          type="button"
                                          onClick={() => handleRemoveSlot(originalGroupIndex, slotName)}
                                          className="hover:bg-green-200 rounded-sm p-0.5 transition-colors"
                                          title="Remove slot"
                                        >
                                          <X className="w-3 h-3" />
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                );
                              })()}
                            </div>
                          </div>
                        ) : (
                          <div>
                            <label className="block text-xs text-gray-700 font-medium mb-1">Target CSS Selectors:</label>
                            <textarea
                              value={group.targetCssClasses || ''}
                              onChange={(e) => handleUpdateTargetCssClasses(originalGroupIndex, e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[100px]"
                              placeholder=".my-custom-class, .another-class&#10;.complex > .selector&#10;#specific-id"
                            />
                            <div className="text-xs text-gray-500 mt-1">Enter CSS selectors (one per line or comma-separated). Used exactly as entered.</div>
                          </div>
                        )}

                        {/* Calculated Selectors Section - Prominent Display */}
                        {group.calculatedSelectors && (
                          <CalculatedSelectorsSection calculatedSelectors={group.calculatedSelectors} />
                        )}
                      </div>

                    )}
                  </div>

                  {/* Layout Properties Section */}
                  <div className="border-t border-gray-200">
                    <button
                      type="button"
                      onClick={() => toggleLayoutProps(originalGroupIndex)}
                      className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                    >
                      {expandedLayoutProps[originalGroupIndex] ? (
                        <ChevronDown size={18} className="text-gray-600" />
                      ) : (
                        <ChevronRight size={18} className="text-gray-600" />
                      )}
                      <span className="text-sm font-semibold text-gray-900">
                        Layout Properties
                      </span>
                    </button>

                    {expandedLayoutProps[originalGroupIndex] && (
                      <div className="px-4 pb-4">
                        {(() => {
                          const effectiveBreakpoints = getBreakpoints({ breakpoints });
                          const selectedWidgetTypes = group.widgetTypes || (group.widgetType ? [group.widgetType] : []);
                          const layoutParts = new Set();
                          const groupSlots = group.slots || (group.slot ? [group.slot] : []);

                          // If widget types are selected, collect layout parts from widgets
                          if (selectedWidgetTypes.length > 0) {
                            selectedWidgetTypes.forEach(wtType => {
                              const widgetMeta = widgetTypes.find(wt => wt.type === wtType);
                              if (widgetMeta?.layoutParts) {
                                Object.keys(widgetMeta.layoutParts).forEach(part => layoutParts.add(part));
                              }
                            });
                          } else if (groupSlots.length > 0) {
                            // If no widget types but slots exist, use slots as parts
                            groupSlots.forEach(slot => layoutParts.add(slot));
                          }

                          if (layoutParts.size === 0) {
                            return (
                              <div className="text-sm text-gray-600">
                                {(group.widgetTypes?.length > 0 || group.widgetType)
                                  ? "Selected widgets don't have customizable layout parts."
                                  : "Select widget types in the Targeting section to configure layout properties."}
                              </div>
                            );
                          }

                          // Separate parts into used vs unused
                          const usedParts = Array.from(layoutParts).filter(part => {
                            const partKey = `${groupIndex}-${part}`;
                            // Part is visible if explicitly added to UI OR has actual data
                            return partKey in expandedLayoutParts ||
                              (part in (group.layoutProperties || {}) &&
                                Object.keys(group.layoutProperties[part]).length > 0);
                          });

                          const unusedParts = Array.from(layoutParts).filter(part => {
                            const partKey = `${groupIndex}-${part}`;
                            // Part is pill if not added to UI and has no data
                            return !(partKey in expandedLayoutParts) &&
                              !(part in (group.layoutProperties || {}) &&
                                Object.keys(group.layoutProperties[part]).length > 0);
                          });

                          return (
                            <div className="space-y-3">
                              {/* Pills for unused parts */}
                              {unusedParts.length > 0 && (
                                <div className="flex flex-wrap gap-2">
                                  {unusedParts.map(part => (
                                    <button
                                      key={part}
                                      type="button"
                                      onClick={() => handleAddLayoutPart(originalGroupIndex, part)}
                                      className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                                      title={`Add ${getPartLabel(part, selectedWidgetTypes)}`}
                                    >
                                      + {getPartLabel(part, selectedWidgetTypes)}
                                    </button>
                                  ))}
                                </div>
                              )}

                              {/* Collapsible sections for used parts */}
                              {usedParts.map(part => {
                                const partProps = group.layoutProperties?.[part] || {};
                                const partKey = `${groupIndex}-${part}`;
                                const isPartExpanded = expandedLayoutParts[partKey] === true; // Only expanded if explicitly set

                                // Check if this part is a slot (not from widget metadata)
                                const isSlot = selectedWidgetTypes.length === 0 && groupSlots.includes(part);

                                // Get allowed properties for this part from widget metadata
                                let allowedProperties = null; // null = all properties allowed
                                if (!isSlot) {
                                  // Only check widget metadata if this is not a slot
                                  selectedWidgetTypes.forEach(wtType => {
                                    const widgetMeta = widgetTypes.find(wt => wt.type === wtType);
                                    if (widgetMeta?.layoutParts?.[part]?.properties) {
                                      // If any widget defines properties for this part, use them
                                      const partConfig = widgetMeta.layoutParts[part];
                                      if (partConfig.properties) {
                                        allowedProperties = partConfig.properties;
                                      }
                                    }
                                  });
                                }

                                // Filter LAYOUT_PROPERTIES based on allowed properties
                                // Slots get all properties (no restrictions)
                                const availableProperties = allowedProperties
                                  ? Object.fromEntries(
                                    Object.entries(LAYOUT_PROPERTIES).filter(([prop]) =>
                                      allowedProperties.includes(prop)
                                    )
                                  )
                                  : LAYOUT_PROPERTIES;

                                // Get the label for this part from widget metadata or format slot name
                                let partLabel = part;
                                if (isSlot) {
                                  // Format slot name: capitalize first letter and replace underscores/hyphens with spaces
                                  partLabel = part
                                    .replace(/[-_]/g, ' ')
                                    .split(' ')
                                    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                                    .join(' ');
                                } else {
                                  selectedWidgetTypes.forEach(wtType => {
                                    const widgetMeta = widgetTypes.find(wt => wt.type === wtType);
                                    if (widgetMeta?.layoutParts?.[part]?.label) {
                                      partLabel = widgetMeta.layoutParts[part].label;
                                    }
                                  });
                                }

                                // Calculate selectors for this specific part
                                const calculatePartSelectors = () => {
                                  const baseSelectors = group.calculatedSelectors?.baseSelectors || [''];
                                  return baseSelectors.map(base =>
                                    base ? `${base} .${part}`.trim() : `.${part}`
                                  );
                                };

                                const partSelectors = calculatePartSelectors();

                                return (
                                  <LayoutPartEditor
                                    key={part}
                                    groupIndex={originalGroupIndex}
                                    part={part}
                                    partProps={partProps}
                                    partLabel={partLabel}
                                    availableProperties={availableProperties}
                                    group={{ ...group, themeId }}
                                    colors={colors}
                                    fonts={fonts}
                                    breakpoints={effectiveBreakpoints}
                                    isExpanded={isPartExpanded}
                                    expandedBreakpoints={expandedLayoutBreakpoints}
                                    editMode={{}}
                                    clipboard={null}
                                    copiedIndicator={null}
                                    layoutInputValues={layoutInputValues}
                                    onToggle={() => setExpandedLayoutParts({
                                      ...expandedLayoutParts,
                                      [partKey]: !isPartExpanded
                                    })}
                                    onRemovePart={() => handleRemoveLayoutPart(originalGroupIndex, part)}
                                    onAddBreakpoint={(bp) => handleAddBreakpoint(originalGroupIndex, part, bp)}
                                    onRemoveBreakpoint={(bp) => handleRemoveBreakpoint(originalGroupIndex, part, bp)}
                                    onToggleBreakpoint={(bp) => {
                                      const breakpointKey = `${originalGroupIndex}-${part}-${bp}`;
                                      setExpandedLayoutBreakpoints({
                                        ...expandedLayoutBreakpoints,
                                        [breakpointKey]: !expandedLayoutBreakpoints[breakpointKey]
                                      });
                                    }}
                                    onSetEditMode={(bp, mode) => {
                                      // Edit mode not implemented yet
                                    }}
                                    onCopyBreakpoint={(bp, data) => {
                                      // Copy/paste not implemented yet
                                    }}
                                    onPasteBreakpoint={(bp) => {
                                      // Copy/paste not implemented yet
                                    }}
                                    onUpdateProperty={(gIdx, p, bp, prop, value, immediate) => 
                                      handleUpdateLayoutProperty(gIdx, p, bp, prop, value, immediate)
                                    }
                                    onPropertyBlur={(gIdx, p, bp, prop) => 
                                      handleLayoutPropertyBlur(gIdx, p, bp, prop)
                                    }
                                    onAddProperty={(gIdx, p, bp, prop) => 
                                      handleUpdateLayoutProperty(gIdx, p, bp, prop, '', true)
                                    }
                                    onDirty={onDirty}
                                  />
                                );
                              })}
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>

                  {/* Content Section */}
                  <div className="border-t border-gray-200">
                    <button
                      type="button"
                      onClick={() => toggleContent(originalGroupIndex)}
                      className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                    >
                      {expandedContent[originalGroupIndex] ? (
                        <ChevronDown size={18} className="text-gray-600" />
                      ) : (
                        <ChevronRight size={18} className="text-gray-600" />
                      )}
                      <span className="text-sm font-semibold text-gray-900">
                        Content & Styles
                      </span>
                      <span className="text-xs text-gray-500 ml-auto">
                        {tagGroupsInGroup.length} {tagGroupsInGroup.length === 1 ? 'tag' : 'tags'}
                      </span>
                    </button>

                    {expandedContent[originalGroupIndex] && (
                      <div className="p-4 space-y-4">
                        {(groupEditMode[originalGroupIndex] || 'tags') === 'css' ? (
                          /* CSS Editor Mode - Edit all group CSS at once */
                          <div className="space-y-3">
                            <div className="text-sm text-gray-600 mb-2">
                              Edit all CSS for this group. Changes are saved when you click away or switch back to Tags mode.
                            </div>
                            <textarea
                              ref={(el) => {
                                if (el) cssTextareaRefs.current[`group-${groupIndex}`] = el;
                              }}
                              defaultValue={groupElementsToCSS(group.elements || {})}
                              onChange={() => {
                                if (onDirty) onDirty();
                              }}
                              onBlur={() => handleGroupCSSBlur(groupIndex)}
                              className="w-full px-3 py-2 text-sm font-mono border border-gray-300 rounded-md bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              rows={Math.max(10, Object.keys(group.elements || {}).length * 5)}
                              placeholder="h1 {&#10;  font-size: 2.5rem;&#10;  font-weight: 700;&#10;}&#10;&#10;p {&#10;  font-size: 1rem;&#10;  line-height: 1.6;&#10;}"
                            />
                          </div>
                        ) : (
                          /* Tags Mode - Individual tag editors */
                          <>
                            {/* Add Tag Buttons */}
                            {availableTagGroups.length > 0 && (
                              <div className="flex flex-wrap gap-2">
                                {availableTagGroups.map(tagGroup => (
                                  <button
                                    key={tagGroup.base}
                                    type="button"
                                    onClick={() => handleAddTagGroup(originalGroupIndex, tagGroup)}
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
                              const isTagExpanded = expandedTags[`${originalGroupIndex}-${tagGroup.base}`] ?? false;
                              const baseStyles = group.elements[tagGroup.base] || {};

                              return (
                                <div key={tagGroup.base} className="border border-gray-200 rounded-lg overflow-hidden">
                                  {/* Tag Header */}
                                  <div
                                    className="flex items-center gap-3 p-3 bg-gray-50 border-b border-gray-200"
                                    onPaste={(e) => handleElementPaste(e, originalGroupIndex, tagGroup.base)}
                                    tabIndex={-1}
                                  >
                                    {/* Only show toggle for links */}
                                    {tagGroup.hasGroup && (
                                      <button
                                        type="button"
                                        onClick={() => toggleTag(originalGroupIndex, tagGroup.base)}
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
                                        onClick={() => openImportModal('element', originalGroupIndex, tagGroup.base)}
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
                                        onClick={() => handlePaste(originalGroupIndex, tagGroup.base)}
                                        disabled={!clipboard || clipboard.type !== 'tag'}
                                        className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                        title="Paste tag styles"
                                      >
                                        <Clipboard className="w-4 h-4" />
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => handleRemoveTagGroup(originalGroupIndex, tagGroup)}
                                        className="p-1.5 text-red-600 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </div>
                                  </div>

                                  {/* Tag Content */}
                                  {(isTagExpanded || !tagGroup.hasGroup) && (
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
                                                  onClick={() => toggleEditMode(originalGroupIndex, tagGroup.base, variant)}
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
                                                  onClick={() => toggleEditMode(originalGroupIndex, tagGroup.base, variant)}
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
                                                      {renderPropertyField(originalGroupIndex, variant, property, value)}
                                                    </div>
                                                    <button
                                                      type="button"
                                                      onClick={() => handleRemoveProperty(originalGroupIndex, variant, property)}
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
                                                        onClick={() => handleUpdateElement(originalGroupIndex, variant, prop, '')}
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
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center py-12 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50">
              <div className="text-gray-500">No typography groups yet. Click "Add Group" to get started.</div>
            </div>
          )}
        </div>

        {/* Preview - takes 1 column */}
        <div className="lg:sticky lg:top-6 lg:self-start">
          <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
            <div className="text-sm font-semibold text-gray-900 mb-3" role="heading" aria-level="4">Live Preview</div>
            <DesignGroupsPreview designGroups={designGroups} colors={colors} breakpoints={breakpoints} />
          </div>
        </div>
      </div>

      {/* Import Modal */}
      {importModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="text-lg font-semibold text-gray-900" role="heading" aria-level="3">
                Import {importMode === 'json' ? 'JSON' : 'CSS'} {
                  importModal.type === 'global' ? 'to Create New Group' :
                    importModal.type === 'group' ? 'to Update Group' :
                      `for ${importModal.elementKey}`
                }
              </div>
              <div className="text-sm text-gray-600 mt-1">
                {importMode === 'css' && (
                  <>
                    {importModal.type === 'global' && 'Paste CSS rules with selectors (e.g., h1 { font-size: 2.5rem; })'}
                    {importModal.type === 'group' && 'Paste CSS rules with selectors to update all elements in this group'}
                    {importModal.type === 'element' && 'Paste CSS properties without selector (e.g., font-size: 2.5rem; color: blue;)'}
                  </>
                )}
                {importMode === 'json' && (
                  <>
                    {importModal.type === 'global' && 'Paste JSON with groups array or single group object'}
                    {importModal.type === 'group' && 'Paste JSON object to update this group (elements, layoutProperties, etc.)'}
                    {importModal.type === 'element' && 'Paste JSON object with property names and values (e.g., { "fontSize": "2rem", "color": "#333" })'}
                  </>
                )}
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* Import Mode Toggle */}
              <div className="flex gap-2 border-b border-gray-200 pb-3">
                <button
                  type="button"
                  onClick={() => setImportMode('css')}
                  className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${importMode === 'css'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                >
                  CSS
                </button>
                <button
                  type="button"
                  onClick={() => setImportMode('json')}
                  className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${importMode === 'json'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                >
                  JSON
                </button>
              </div>

              {/* File Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Upload {importMode === 'json' ? 'JSON' : 'CSS'} File
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={importMode === 'json' ? '.json' : '.css'}
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
                  <span className="px-2 bg-white text-gray-500">or paste {importMode === 'json' ? 'JSON' : 'CSS'}</span>
                </div>
              </div>

              {/* Textarea */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {importMode === 'json' ? 'JSON' : 'CSS'} Code
                </label>
                {importMode === 'css' ? (
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
                ) : (
                  <textarea
                    value={importJSONText}
                    onChange={(e) => setImportJSONText(e.target.value)}
                    placeholder={
                      importModal.type === 'element'
                        ? '{\n  "fontSize": "2rem",\n  "color": "#333",\n  "fontWeight": "700"\n}'
                        : importModal.type === 'global'
                          ? '{\n  "groups": [\n    {\n      "name": "My Group",\n      "elements": { "h1": { "fontSize": "2rem" } }\n    }\n  ]\n}'
                          : '{\n  "elements": { "h1": { "fontSize": "2rem" } },\n  "layoutProperties": { ... }\n}'
                    }
                    className="w-full h-64 px-3 py-2 border border-gray-300 rounded-md font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                )}
              </div>

              {/* Preview Info */}
              {importMode === 'css' && importCSSText.trim() && (
                <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                  <div className="text-sm text-blue-800">
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
                  </div>
                </div>
              )}
              {importMode === 'json' && importJSONText.trim() && (
                <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                  <div className="text-sm text-blue-800">
                    {(() => {
                      try {
                        const parsed = JSON.parse(importJSONText);
                        if (importModal.type === 'element') {
                          if (typeof parsed === 'object' && !Array.isArray(parsed)) {
                            const count = Object.keys(parsed).length;
                            return count > 0
                              ? `✓ ${count} ${count === 1 ? 'property' : 'properties'} detected: ${Object.keys(parsed).join(', ')}`
                              : '⚠ Empty object';
                          }
                          return '⚠ Expected object with property names and values';
                        } else if (importModal.type === 'global') {
                          if (parsed.groups && Array.isArray(parsed.groups)) {
                            return `✓ ${parsed.groups.length} ${parsed.groups.length === 1 ? 'group' : 'groups'} detected`;
                          } else if (parsed.name || parsed.elements) {
                            return '✓ Single group object detected';
                          }
                          return '⚠ Expected { groups: [...] } or { name, elements, ... }';
                        } else {
                          if (parsed.elements || parsed.layoutProperties || parsed.layout_properties) {
                            return '✓ Valid group update data detected';
                          }
                          return '⚠ Expected object with elements or layoutProperties';
                        }
                      } catch (error) {
                        return `⚠ Invalid JSON: ${error.message}`;
                      }
                    })()}
                  </div>
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
                onClick={importMode === 'json' ? handleImportJSON : handleImportCSS}
                disabled={importMode === 'json' ? !importJSONText.trim() : !importCSSText.trim()}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Import
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Widget Type Removal Confirmation Dialog */}
      <ConfirmDialog
        isOpen={widgetTypeRemovalDialog !== null}
        onConfirm={() => {
          if (widgetTypeRemovalDialog) {
            performRemoveWidgetType(widgetTypeRemovalDialog.groupIndex, widgetTypeRemovalDialog.widgetType);
          }
        }}
        onCancel={() => setWidgetTypeRemovalDialog(null)}
        title="Remove Widget Type"
        message={widgetTypeRemovalDialog ?
          `This widget type has layout properties defined. Removing it will not delete the properties, but they may no longer be used. Are you sure you want to remove "${widgetTypes.find(wt => wt.type === widgetTypeRemovalDialog.widgetType)?.name || widgetTypeRemovalDialog.widgetType}"?` :
          ''
        }
        confirmText="Remove"
        cancelText="Cancel"
        confirmButtonStyle="danger"
      />

    </div>
  );
};

export default DesignGroupsTab;
