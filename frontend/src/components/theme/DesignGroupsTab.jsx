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
import { Plus, Trash2, ChevronDown, ChevronRight, Copy, Check, Clipboard, Code, FileText, Upload, FileUp, Globe, Package } from 'lucide-react';
import { createDesignGroup, generateClassName, getBreakpoints } from '../../utils/themeUtils';
import { parseCSSRules, cssToGroupElements, cssToElementProperties, groupElementsToCSS, isValidClassName } from '../../utils/cssParser';
import DesignGroupsPreview from './DesignGroupsPreview';
import ColorSelector from './form-fields/ColorSelector';
import FontSelector from './form-fields/FontSelector';
import NumericInput from './form-fields/NumericInput';
import CopyButton from './CopyButton';
import { useGlobalNotifications } from '../../contexts/GlobalNotificationContext';
import { useWidgets } from '../../hooks/useWidgets';

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

const DesignGroupsTab = ({ designGroups, colors, fonts, breakpoints, onChange, onDirty }) => {
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
  const [importCSSText, setImportCSSText] = useState('');
  const [layoutInputValues, setLayoutInputValues] = useState({}); // Local state for layout property inputs
  const layoutDebounceTimerRef = useRef({});
  const { addNotification } = useGlobalNotifications();

  // Fetch widget types from API
  const { widgetTypes = [], isLoadingTypes } = useWidgets();

  // Cleanup layout debounce timers on unmount
  useEffect(() => {
    return () => {
      Object.values(layoutDebounceTimerRef.current).forEach(timer => {
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
      sm: 'Base / SM & Up',
      md: `MD & Up (≥${themeBreakpoints.md}px)`,
      lg: `LG & Up (≥${themeBreakpoints.lg}px)`,
      xl: `XL & Up (≥${themeBreakpoints.xl}px)`,
    };
    return labels[bp] || bp;
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
    setExpandedContent({ ...expandedContent, [groups.length]: true });
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

  const handleUpdateWidgetTypes = (index, selectedTypes) => {
    const updatedGroups = [...groups];
    updatedGroups[index] = {
      ...updatedGroups[index],
      widgetTypes: selectedTypes,
      // Keep old field for backward compatibility
      widgetType: selectedTypes.length === 1 ? selectedTypes[0] : null,
    };
    onChange({ ...(designGroups || {}), groups: updatedGroups });
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

  const handleUpdateTargetingMode = (index, mode) => {
    const updatedGroups = [...groups];
    updatedGroups[index] = {
      ...updatedGroups[index],
      targetingMode: mode,
    };
    onChange({ ...(designGroups || {}), groups: updatedGroups });
  };

  const handleUpdateTargetCssClasses = (index, cssClasses) => {
    const updatedGroups = [...groups];
    updatedGroups[index] = {
      ...updatedGroups[index],
      targetCssClasses: cssClasses,
    };
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
      if (value === '' || value === null) {
        delete breakpointProps[property];
      } else {
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

  // Convert layout properties to CSS
  const layoutPropertiesToCSS = (layoutProperties) => {
    if (!layoutProperties || Object.keys(layoutProperties).length === 0) return '';

    const cssParts = [];
    const effectiveBreakpoints = getBreakpoints({ breakpoints });

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
      // Default (no media query)
      if (bpStyles.default && Object.keys(bpStyles.default).length > 0) {
        let cssRule = `.${part} {\n`;
        for (const [prop, value] of Object.entries(bpStyles.default)) {
          cssRule += formatPropertyValue(prop, value);
        }
        cssRule += '}';
        cssParts.push(cssRule);
      }

      // Legacy desktop support (migrate to default)
      else if (bpStyles.desktop && Object.keys(bpStyles.desktop).length > 0) {
        let cssRule = `.${part} {\n`;
        for (const [prop, value] of Object.entries(bpStyles.desktop)) {
          cssRule += formatPropertyValue(prop, value);
        }
        cssRule += '}';
        cssParts.push(cssRule);
      }

      // Generate media queries for each breakpoint (mobile-first)
      ['sm', 'md', 'lg', 'xl'].forEach(bp => {
        if (bpStyles[bp] && Object.keys(bpStyles[bp]).length > 0 && effectiveBreakpoints[bp]) {
          let cssRule = `@media (min-width: ${effectiveBreakpoints[bp]}px) {\n  .${part} {\n`;
          for (const [prop, value] of Object.entries(bpStyles[bp])) {
            cssRule += '  ' + formatPropertyValue(prop, value);
          }
          cssRule += '  }\n}';
          cssParts.push(cssRule);
        }
      });

      // Legacy tablet support (migrate to md)
      if (bpStyles.tablet && Object.keys(bpStyles.tablet).length > 0 && !bpStyles.md) {
        let cssRule = `@media (min-width: ${effectiveBreakpoints.md}px) {\n  .${part} {\n`;
        for (const [prop, value] of Object.entries(bpStyles.tablet)) {
          cssRule += '  ' + formatPropertyValue(prop, value);
        }
        cssRule += '  }\n}';
        cssParts.push(cssRule);
      }

      // Legacy mobile support (migrate to sm)
      if (bpStyles.mobile && Object.keys(bpStyles.mobile).length > 0 && !bpStyles.sm) {
        let cssRule = `@media (min-width: ${effectiveBreakpoints.sm}px) {\n  .${part} {\n`;
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
  const cssToLayoutProperties = (cssText) => {
    const layoutProperties = {};

    try {
      // Parse default (non-media query) rules
      const defaultRules = cssText.match(/\.(\w+)\s*\{([^}]+)\}/g);
      if (defaultRules) {
        defaultRules.forEach(rule => {
          const match = rule.match(/\.(\w+)\s*\{([^}]+)\}/);
          if (match) {
            const part = match[1];
            const properties = match[2];

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
          const rules = content.matchAll(/\.(\w+)\s*\{([^}]+)\}/g);

          for (const rule of rules) {
            const part = rule[1];
            const properties = rule[2];

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
      const layoutProperties = cssToLayoutProperties(cssText);

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
          isDefault: false,
          widgetTypes: [],
          slots: [],
          widgetType: null,
          slot: null,
          elements,
        };

        onChange({ ...(designGroups || {}), groups: [...groups, newGroup] });
        setExpandedContent({ ...expandedContent, [groups.length]: true });

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

    // Auto-expand the new group
    setExpandedContent({ ...expandedContent, [groups.length]: true });
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
                      {/* Default Group Radio Button */}
                      <div className="flex items-center gap-1" title="Mark as default/base group">
                        <input
                          type="radio"
                          id={`default-group-${groupIndex}`}
                          name="default-group"
                          checked={group.isDefault === true}
                          onChange={() => handleToggleDefault(groupIndex)}
                          className="w-4 h-4 text-blue-600 focus:ring-2 focus:ring-blue-500"
                        />
                        <label
                          htmlFor={`default-group-${groupIndex}`}
                          className="text-xs text-gray-600 font-medium cursor-pointer"
                        >
                          Default
                        </label>
                      </div>

                      <input
                        type="text"
                        value={group.name}
                        onChange={(e) => handleUpdateGroupName(groupIndex, e.target.value)}
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
                          onClick={() => toggleGroupEditMode(groupIndex)}
                          className={`inline-flex items-center px-3 py-1.5 text-xs font-medium rounded transition-colors ${(groupEditMode[groupIndex] || 'tags') === 'css'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                          title={(groupEditMode[groupIndex] || 'tags') === 'css' ? 'Switch to tag editor' : 'Edit all CSS'}
                        >
                          {(groupEditMode[groupIndex] || 'tags') === 'css' ? (
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

                  {/* Targeting Section */}
                  <div className="border-t border-gray-200">
                    <button
                      type="button"
                      onClick={() => toggleTargeting(groupIndex)}
                      className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                    >
                      {expandedTargeting[groupIndex] ? (
                        <ChevronDown size={18} className="text-gray-600" />
                      ) : (
                        <ChevronRight size={18} className="text-gray-600" />
                      )}
                      <span className="text-sm font-semibold text-gray-900">
                        Targeting
                      </span>
                    </button>

                    {expandedTargeting[groupIndex] && (
                      <div className="px-4 pb-4">
                        {/* Targeting Mode Toggle */}
                        <div className="mb-4 flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleUpdateTargetingMode(groupIndex, 'widget-slot')}
                            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                              (group.targetingMode || 'widget-slot') === 'widget-slot'
                                ? 'bg-blue-100 text-blue-700 border border-blue-300'
                                : 'bg-gray-100 text-gray-600 border border-gray-300 hover:bg-gray-200'
                            }`}
                          >
                            Widget/Slot
                          </button>
                          <button
                            type="button"
                            onClick={() => handleUpdateTargetingMode(groupIndex, 'css-classes')}
                            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                              group.targetingMode === 'css-classes'
                                ? 'bg-blue-100 text-blue-700 border border-blue-300'
                                : 'bg-gray-100 text-gray-600 border border-gray-300 hover:bg-gray-200'
                            }`}
                          >
                            CSS Classes
                          </button>
                        </div>

                        {(group.targetingMode || 'widget-slot') === 'widget-slot' ? (
                          <div className="grid grid-cols-2 gap-4">
                            {/* Widget Types (multi-select) */}
                            <div>
                              <label className="block text-xs text-gray-700 font-medium mb-1">Apply to Widget Types:</label>
                              <select
                                multiple
                                value={group.widgetTypes || (group.widgetType ? [group.widgetType] : [])}
                                onChange={(e) => {
                                  const selectedOptions = Array.from(e.target.selectedOptions, option => option.value).filter(Boolean);
                                  handleUpdateWidgetTypes(groupIndex, selectedOptions);
                                }}
                                className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[80px]"
                                disabled={isLoadingTypes}
                              >
                                {isLoadingTypes ? (
                                  <option disabled>Loading widget types...</option>
                                ) : (
                                  widgetTypes.map(wt => (
                                    <option key={wt.type} value={wt.type}>{wt.name}</option>
                                  ))
                                )}
                              </select>
                              <div className="text-xs text-gray-500 mt-1">Hold Ctrl/Cmd to select multiple. Empty = all widgets</div>
                            </div>

                            {/* Slots (comma-separated) */}
                            <div>
                              <label className="block text-xs text-gray-700 font-medium mb-1">Apply to Slots:</label>
                              <input
                                type="text"
                                value={(group.slots || (group.slot ? [group.slot] : [])).join(', ')}
                                onChange={(e) => handleUpdateSlots(groupIndex, e.target.value)}
                                className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="main, sidebar, footer (comma-separated)"
                              />
                              <div className="text-xs text-gray-500 mt-1">Comma-separated. Empty = all slots</div>
                            </div>
                          </div>
                        ) : (
                          <div>
                            <label className="block text-xs text-gray-700 font-medium mb-1">Target CSS Selectors:</label>
                            <textarea
                              value={group.targetCssClasses || ''}
                              onChange={(e) => handleUpdateTargetCssClasses(groupIndex, e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[100px]"
                              placeholder=".my-custom-class, .another-class&#10;.complex > .selector&#10;#specific-id"
                            />
                            <div className="text-xs text-gray-500 mt-1">Enter CSS selectors (one per line or comma-separated). Used exactly as entered.</div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Layout Properties Section */}
                  <div className="border-t border-gray-200">
                    <button
                      type="button"
                      onClick={() => toggleLayoutProps(groupIndex)}
                      className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                    >
                      {expandedLayoutProps[groupIndex] ? (
                        <ChevronDown size={18} className="text-gray-600" />
                      ) : (
                        <ChevronRight size={18} className="text-gray-600" />
                      )}
                      <span className="text-sm font-semibold text-gray-900">
                        Layout Properties
                      </span>
                    </button>

                    {expandedLayoutProps[groupIndex] && (
                      <div className="px-4 pb-4">
                        {(() => {
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

                          return (
                            <div className="space-y-3">
                              {Array.from(layoutParts).map(part => {
                                const partProps = group.layoutProperties?.[part] || {};
                                const partKey = `${groupIndex}-${part}`;
                                const isPartExpanded = expandedLayoutParts[partKey] !== false; // Default to true

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

                                return (
                                  <div key={part} className="bg-white rounded border border-gray-200">
                                    {/* Part Header - Collapsible */}
                                    <button
                                      type="button"
                                      onClick={() => setExpandedLayoutParts({
                                        ...expandedLayoutParts,
                                        [partKey]: !isPartExpanded
                                      })}
                                      className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-gray-50 rounded-t transition-colors"
                                    >
                                      {isPartExpanded ? (
                                        <ChevronDown size={14} className="text-gray-600" />
                                      ) : (
                                        <ChevronRight size={14} className="text-gray-600" />
                                      )}
                                      <span className="text-xs font-semibold text-gray-700">
                                        {partLabel}
                                      </span>
                                      {allowedProperties && (
                                        <span className="text-xs text-gray-500 ml-auto">
                                          {allowedProperties.length} {allowedProperties.length === 1 ? 'property' : 'properties'}
                                        </span>
                                      )}
                                    </button>

                                    {isPartExpanded && (
                                      <div className="p-3 pt-0">
                                        {BREAKPOINTS.map(breakpoint => {
                                          const modeKey = `${groupIndex}-${part}-${breakpoint}`;
                                          const currentMode = layoutEditMode[modeKey] || 'form';
                                          const breakpointProps = partProps[breakpoint] || {};

                                          // Convert breakpoint properties to CSS
                                          const breakpointToCSS = () => {
                                            if (!breakpointProps || Object.keys(breakpointProps).length === 0) return '';
                                            let css = '';
                                            for (const [prop, value] of Object.entries(breakpointProps)) {
                                              const cssProp = cssPropertyToKebab(prop);
                                              css += `${cssProp}: ${value};\n`;
                                            }
                                            return css;
                                          };

                                          const breakpointKey = `${groupIndex}-${part}-${breakpoint}`;
                                          const isBreakpointExpanded = expandedLayoutBreakpoints[breakpointKey] !== false; // Default to true

                                          return (
                                            <div key={breakpoint} className="mb-3 last:mb-0 border border-gray-200 rounded">
                                              {/* Breakpoint Header - Collapsible */}
                                              <div className="flex items-center justify-between px-2 py-1.5 bg-gray-50 rounded-t">
                                                <button
                                                  type="button"
                                                  onClick={() => setExpandedLayoutBreakpoints({
                                                    ...expandedLayoutBreakpoints,
                                                    [breakpointKey]: !isBreakpointExpanded
                                                  })}
                                                  className="flex items-center gap-1 text-xs font-medium text-gray-600 capitalize hover:text-gray-900 transition-colors"
                                                >
                                                  {isBreakpointExpanded ? (
                                                    <ChevronDown size={12} className="text-gray-500" />
                                                  ) : (
                                                    <ChevronRight size={12} className="text-gray-500" />
                                                  )}
                                                  {getBreakpointLabel(breakpoint)}
                                                </button>
                                                <div className="flex gap-1">
                                                  {/* Copy/Paste Buttons */}
                                                  <button
                                                    type="button"
                                                    onClick={() => {
                                                      setClipboard({
                                                        type: 'layoutBreakpoint',
                                                        part,
                                                        breakpoint,
                                                        data: breakpointProps
                                                      });
                                                      setCopiedIndicator(`layout-${modeKey}`);
                                                      setTimeout(() => setCopiedIndicator(null), 2000);
                                                    }}
                                                    className="p-1 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
                                                    title={`Copy ${part} ${breakpoint} properties`}
                                                  >
                                                    {copiedIndicator === `layout-${modeKey}` ? (
                                                      <Check className="w-3 h-3 text-green-600" />
                                                    ) : (
                                                      <Copy className="w-3 h-3" />
                                                    )}
                                                  </button>
                                                  <button
                                                    type="button"
                                                    onClick={() => {
                                                      if (!clipboard || clipboard.type !== 'layoutBreakpoint') return;

                                                      const updatedGroups = [...groups];
                                                      const layoutProperties = updatedGroups[groupIndex].layoutProperties || {};
                                                      const partProps = layoutProperties[part] || {};

                                                      // Merge clipboard data with existing properties
                                                      partProps[breakpoint] = { ...partProps[breakpoint], ...clipboard.data };

                                                      if (Object.keys(partProps).length > 0) {
                                                        layoutProperties[part] = partProps;
                                                      }

                                                      updatedGroups[groupIndex] = {
                                                        ...updatedGroups[groupIndex],
                                                        layoutProperties: Object.keys(layoutProperties).length > 0 ? layoutProperties : undefined,
                                                      };

                                                      onChange({ ...(designGroups || {}), groups: updatedGroups });
                                                      if (onDirty) onDirty();
                                                    }}
                                                    disabled={!clipboard || clipboard.type !== 'layoutBreakpoint'}
                                                    className="p-1 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                                    title={`Paste ${clipboard?.part || ''} ${clipboard?.breakpoint || ''} properties`}
                                                  >
                                                    <Clipboard className="w-3 h-3" />
                                                  </button>

                                                  {/* Form/CSS Toggle */}
                                                  <button
                                                    type="button"
                                                    onClick={() => setLayoutEditMode({ ...layoutEditMode, [modeKey]: 'form' })}
                                                    className={`px-2 py-0.5 text-xs rounded transition-colors ${currentMode === 'form'
                                                      ? 'bg-blue-600 text-white'
                                                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                                      }`}
                                                  >
                                                    Form
                                                  </button>
                                                  <button
                                                    type="button"
                                                    onClick={() => setLayoutEditMode({ ...layoutEditMode, [modeKey]: 'css' })}
                                                    className={`px-2 py-0.5 text-xs rounded transition-colors ${currentMode === 'css'
                                                      ? 'bg-blue-600 text-white'
                                                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                                      }`}
                                                  >
                                                    CSS
                                                  </button>
                                                </div>
                                              </div>

                                              {isBreakpointExpanded && (currentMode === 'css' ? (
                                                <div className="p-2">
                                                  <textarea
                                                    ref={(el) => {
                                                      if (el) cssTextareaRefs.current[`layout-${modeKey}`] = el;
                                                    }}
                                                    defaultValue={breakpointToCSS()}
                                                    onChange={() => {
                                                      if (onDirty) onDirty();
                                                    }}
                                                    onBlur={(e) => {
                                                      try {
                                                        const cssText = e.target.value;
                                                        const properties = {};
                                                        const propMatches = cssText.matchAll(/\s*([a-z-]+)\s*:\s*([^;]+);/g);
                                                        for (const match of propMatches) {
                                                          const cssProp = match[1];
                                                          const value = match[2].trim();
                                                          const camelProp = cssProp.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
                                                          properties[camelProp] = value;
                                                        }

                                                        const updatedGroups = [...groups];
                                                        const layoutProperties = updatedGroups[groupIndex].layoutProperties || {};
                                                        const partProps = layoutProperties[part] || {};

                                                        if (Object.keys(properties).length > 0) {
                                                          partProps[breakpoint] = properties;
                                                        } else {
                                                          delete partProps[breakpoint];
                                                        }

                                                        if (Object.keys(partProps).length > 0) {
                                                          layoutProperties[part] = partProps;
                                                        } else {
                                                          delete layoutProperties[part];
                                                        }

                                                        updatedGroups[groupIndex] = {
                                                          ...updatedGroups[groupIndex],
                                                          layoutProperties: Object.keys(layoutProperties).length > 0 ? layoutProperties : undefined,
                                                        };

                                                        onChange({ ...(designGroups || {}), groups: updatedGroups });
                                                      } catch (error) {
                                                        addNotification({
                                                          type: 'error',
                                                          message: `Failed to parse CSS: ${error.message}`
                                                        });
                                                      }
                                                    }}
                                                    className="w-full px-2 py-1.5 text-xs font-mono border border-gray-300 rounded bg-gray-50 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                    rows={5}
                                                    placeholder="width: 100%;&#10;padding: 1rem;&#10;gap: 0.5rem;"
                                                  />
                                                </div>
                                              ) : (
                                                <div className="grid grid-cols-2 gap-2 p-2">
                                                  {Object.entries(availableProperties).map(([prop, config]) => {
                                                    const key = `${groupIndex}-${part}-${breakpoint}-${prop}`;
                                                    const storedValue = breakpointProps[prop] || '';
                                                    const value = layoutInputValues[key] !== undefined ? layoutInputValues[key] : storedValue;

                                                    return (
                                                      <div key={prop}>
                                                        <label className="block text-xs text-gray-500 mb-0.5">
                                                          {config.label}:
                                                        </label>
                                                        {config.type === 'color' ? (
                                                          <ColorSelector
                                                            value={value}
                                                            onChange={(newValue) => handleUpdateLayoutProperty(groupIndex, part, breakpoint, prop, newValue || null, true)}
                                                            colors={colors}
                                                            className="w-full"
                                                          />
                                                        ) : config.type === 'font' ? (
                                                          <FontSelector
                                                            fontFamily={value}
                                                            fontWeight={breakpointProps.fontWeight}
                                                            onFontFamilyChange={(newValue) => handleUpdateLayoutProperty(groupIndex, part, breakpoint, prop, newValue || null, true)}
                                                            onFontWeightChange={(newWeight) => handleUpdateLayoutProperty(groupIndex, part, breakpoint, 'fontWeight', newWeight || null, true)}
                                                            fonts={fonts}
                                                            className="w-full"
                                                          />
                                                        ) : config.type === 'numeric' ? (
                                                          <NumericInput
                                                            value={value}
                                                            onChange={(newValue) => handleUpdateLayoutProperty(groupIndex, part, breakpoint, prop, newValue || null)}
                                                            onBlur={() => handleLayoutPropertyBlur(groupIndex, part, breakpoint, prop)}
                                                            property={prop}
                                                            className="w-full"
                                                          />
                                                        ) : config.type === 'select' ? (
                                                          <select
                                                            value={value}
                                                            onChange={(e) => handleUpdateLayoutProperty(groupIndex, part, breakpoint, prop, e.target.value || null, true)}
                                                            className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                          >
                                                            <option value="">None</option>
                                                            {config.options?.map(opt => (
                                                              <option key={opt} value={opt}>{opt}</option>
                                                            ))}
                                                          </select>
                                                        ) : (
                                                          <input
                                                            type="text"
                                                            value={value}
                                                            onChange={(e) => handleUpdateLayoutProperty(groupIndex, part, breakpoint, prop, e.target.value || null)}
                                                            onBlur={() => handleLayoutPropertyBlur(groupIndex, part, breakpoint, prop)}
                                                            className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                            placeholder={config.placeholder}
                                                          />
                                                        )}
                                                      </div>
                                                    );
                                                  })}
                                                </div>
                                              ))}
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
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
                      onClick={() => toggleContent(groupIndex)}
                      className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                    >
                      {expandedContent[groupIndex] ? (
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

                    {expandedContent[groupIndex] && (
                      <div className="p-4 space-y-4">
                        {(groupEditMode[groupIndex] || 'tags') === 'css' ? (
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
                                  <div
                                    className="flex items-center gap-3 p-3 bg-gray-50 border-b border-gray-200"
                                    onPaste={(e) => handleElementPaste(e, groupIndex, tagGroup.base)}
                                    tabIndex={-1}
                                  >
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
              <p className="text-gray-500">No typography groups yet. Click "Add Group" to get started.</p>
            </div>
          )}
        </div>

        {/* Preview - takes 1 column */}
        <div className="lg:sticky lg:top-6 lg:self-start">
          <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
            <h4 className="text-sm font-semibold text-gray-900 mb-3">Live Preview</h4>
            <DesignGroupsPreview designGroups={designGroups} colors={colors} breakpoints={breakpoints} />
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
