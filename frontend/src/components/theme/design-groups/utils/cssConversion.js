/**
 * CSS Conversion Utilities
 * 
 * Functions for converting between CSS text and JavaScript objects,
 * and handling CSS property transformations.
 */

// Convert camelCase CSS properties to kebab-case
export const cssPropertyToKebab = (prop) => {
  return prop.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`);
};

// Convert element styles object to CSS string
export const stylesToCSS = (styles) => {
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
export const parseCSS = (cssText) => {
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

// Convert layout properties to CSS
export const layoutPropertiesToCSS = (layoutProperties, groupIndex, groups, widgetTypes, colors, breakpoints) => {
  if (!layoutProperties || Object.keys(layoutProperties).length === 0) return '';

  const cssParts = [];
  const effectiveBreakpoints = breakpoints;

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

    // Helper to filter out 'images' field when generating CSS
    const filterImages = (props) => {
      const filtered = {};
      for (const [key, value] of Object.entries(props)) {
        if (key !== 'images') {
          filtered[key] = value;
        }
      }
      return filtered;
    };

    // Helper to get pixel value for a breakpoint
    const getBreakpointValue = (bp) => {
      // Check if it's a custom breakpoint (numeric string)
      if (!isNaN(bp)) {
        return parseInt(bp);
      }
      // Standard breakpoint from theme
      return effectiveBreakpoints[bp] || 0;
    };

    // Helper to check if a breakpoint is custom
    const isCustomBreakpoint = (bp) => !isNaN(bp);

    // Collect all breakpoints (standard + custom) and sort them
    const standardBreakpoints = ['sm', 'md', 'lg', 'xl'];
    const customBreakpoints = Object.keys(bpStyles).filter(bp => 
      bp !== 'default' && bp !== 'desktop' && bp !== 'tablet' && bp !== 'mobile' && 
      !standardBreakpoints.includes(bp)
    );
    
    const allBreakpoints = [...standardBreakpoints, ...customBreakpoints].filter(bp => 
      bpStyles[bp] && Object.keys(bpStyles[bp]).length > 0
    );

    // Sort breakpoints by pixel value (mobile-first)
    const sortedBreakpoints = allBreakpoints.sort((a, b) => {
      return getBreakpointValue(a) - getBreakpointValue(b);
    });

    // Default (no media query)
    if (bpStyles.default && Object.keys(bpStyles.default).length > 0) {
      const props = filterImages(bpStyles.default);
      if (Object.keys(props).length > 0) {
        let cssRule = `${selector} {\n`;
        for (const [prop, value] of Object.entries(props)) {
          cssRule += formatPropertyValue(prop, value);
        }
        cssRule += '}';
        cssParts.push(cssRule);
      }
    }

    // Legacy desktop support (migrate to default)
    else if (bpStyles.desktop && Object.keys(bpStyles.desktop).length > 0) {
      const props = filterImages(bpStyles.desktop);
      if (Object.keys(props).length > 0) {
        let cssRule = `${selector} {\n`;
        for (const [prop, value] of Object.entries(props)) {
          cssRule += formatPropertyValue(prop, value);
        }
        cssRule += '}';
        cssParts.push(cssRule);
      }
    }

    // Generate media queries for all breakpoints (standard + custom) in sorted order
    sortedBreakpoints.forEach(bp => {
      const bpValue = getBreakpointValue(bp);
      
      // Skip if breakpoint value is invalid
      if (!bpValue || bpValue <= 0) return;

      const props = filterImages(bpStyles[bp]);
      if (Object.keys(props).length > 0) {
        let cssRule = `@media (min-width: ${bpValue}px) {\n  ${selector} {\n`;
        for (const [prop, value] of Object.entries(props)) {
          cssRule += '  ' + formatPropertyValue(prop, value);
        }
        cssRule += '  }\n}';
        cssParts.push(cssRule);
      }
    });

    // Legacy tablet support (migrate to md)
    if (bpStyles.tablet && Object.keys(bpStyles.tablet).length > 0 && !bpStyles.md) {
      const props = filterImages(bpStyles.tablet);
      if (Object.keys(props).length > 0) {
        let cssRule = `@media (min-width: ${effectiveBreakpoints.md}px) {\n  ${selector} {\n`;
        for (const [prop, value] of Object.entries(props)) {
          cssRule += '  ' + formatPropertyValue(prop, value);
        }
        cssRule += '  }\n}';
        cssParts.push(cssRule);
      }
    }

    // Legacy mobile support (migrate to sm)
    if (bpStyles.mobile && Object.keys(bpStyles.mobile).length > 0 && !bpStyles.sm) {
      const props = filterImages(bpStyles.mobile);
      if (Object.keys(props).length > 0) {
        let cssRule = `@media (min-width: ${effectiveBreakpoints.sm}px) {\n  ${selector} {\n`;
        for (const [prop, value] of Object.entries(props)) {
          cssRule += '  ' + formatPropertyValue(prop, value);
        }
        cssRule += '  }\n}';
        cssParts.push(cssRule);
      }
    }
  }

  return cssParts.join('\n\n');
};

// Helper function to group background properties into composite backgroundImage object
const groupBackgroundProperties = (props) => {
  const result = { ...props };
  
  // Check if we have background-image that should be grouped
  if (result.backgroundImage && typeof result.backgroundImage === 'string' && result.backgroundImage.startsWith('url(')) {
    // Extract URL from url('...')
    const urlMatch = result.backgroundImage.match(/url\(['"]?([^'"]+)['"]?\)/);
    if (urlMatch) {
      const compositeImage = {
        url: urlMatch[1]
      };
      
      // Group related background properties
      if (result.backgroundSize) {
        compositeImage.backgroundSize = result.backgroundSize;
        delete result.backgroundSize;
      }
      if (result.backgroundPosition) {
        compositeImage.backgroundPosition = result.backgroundPosition;
        delete result.backgroundPosition;
      }
      if (result.backgroundRepeat) {
        compositeImage.backgroundRepeat = result.backgroundRepeat;
        delete result.backgroundRepeat;
      }
      
      // Include aspect-ratio if present
      if (result.aspectRatio) {
        compositeImage.useAspectRatio = true;
        compositeImage.aspectRatio = result.aspectRatio;
        delete result.aspectRatio;
      }
      
      result.backgroundImage = compositeImage;
    }
  }
  
  return result;
};

// Convert CSS to layout properties
export const cssToLayoutProperties = (cssText, groupIndex, groups, widgetTypes, breakpoints) => {
  const layoutProperties = {};

  // Get selected widget types for this group to build selector-to-partId map
  const group = groups[groupIndex];
  const selectedWidgetTypes = group?.widgetTypes || (group?.widgetType ? [group.widgetType] : []);

  // Preserve existing images from the group's layoutProperties
  const existingLayoutProps = group?.layoutProperties || {};
  for (const [part, partBreakpoints] of Object.entries(existingLayoutProps)) {
    for (const [bp, bpProps] of Object.entries(partBreakpoints)) {
      if (bpProps && bpProps.images) {
        if (!layoutProperties[part]) layoutProperties[part] = {};
        if (!layoutProperties[part][bp]) layoutProperties[part][bp] = {};
        layoutProperties[part][bp].images = bpProps.images;
      }
    }
  }

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
            
            // Group background properties into composite objects
            layoutProperties[part].default = groupBackgroundProperties(layoutProperties[part].default);
          }
        }
      });
    }

    // Parse breakpoint media queries (mobile-first)
    const effectiveBreakpoints = breakpoints;
    
    // Parse standard breakpoints
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
            
            // Group background properties into composite objects
            layoutProperties[part][bp] = groupBackgroundProperties(layoutProperties[part][bp]);
          }
        }
      }
    });

    // Parse custom breakpoints (any numeric pixel value not in standard breakpoints)
    const customBreakpointRegex = /@media\s*\(min-width:\s*(\d+)px\)\s*\{([\s\S]*?)\n\}/g;
    const customMatches = cssText.matchAll(customBreakpointRegex);

    for (const match of customMatches) {
      const pixelValue = match[1];
      const content = match[2];

      // Skip if this is a standard breakpoint value
      const standardValues = Object.values(effectiveBreakpoints);
      if (standardValues.includes(parseInt(pixelValue))) {
        continue;
      }

      // Parse rules within this custom media query
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
          if (!layoutProperties[part][pixelValue]) layoutProperties[part][pixelValue] = {};

          const propMatches = properties.matchAll(/\s*([a-z-]+)\s*:\s*([^;]+);/g);
          for (const propMatch of propMatches) {
            const cssProp = propMatch[1];
            const value = propMatch[2].trim();
            const camelProp = cssProp.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
            layoutProperties[part][pixelValue][camelProp] = value;
          }
          
          // Group background properties into composite objects
          layoutProperties[part][pixelValue] = groupBackgroundProperties(layoutProperties[part][pixelValue]);
        }
      }
    }

  } catch (error) {
    console.error('Error parsing layout CSS:', error);
    throw new Error('Invalid CSS format');
  }

  return layoutProperties;
};

