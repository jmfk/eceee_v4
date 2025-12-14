/**
 * Property Configuration
 * 
 * Configuration objects for layout properties, CSS properties, and tag groups
 * used in the Design Groups editor.
 */

// Comprehensive CSS properties for widget layout parts
export const LAYOUT_PROPERTIES = {
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

// Common CSS properties - required for text blocks
export const CSS_PROPERTIES = {
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

// Tag groups - only links have multiple variants (pseudo-classes)
export const TAG_GROUPS = [
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

