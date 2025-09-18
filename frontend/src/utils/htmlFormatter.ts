// List of HTML block elements that should have newlines around them
const BLOCK_ELEMENTS = new Set([
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',  // Headers
  'p',                                  // Paragraphs
  'table', 'tr', 'td', 'th',           // Tables
  'thead', 'tbody', 'tfoot',           // Table sections
  'div',                               // Basic blocks
  'form',                              // Forms
  'blockquote',                        // Quotes
  'pre'                                // Preformatted text
]);

// Elements that need special handling for newlines
const LIST_CONTAINERS = new Set(['ul', 'ol']);
const LIST_ITEMS = new Set(['li']);

/**
 * Format HTML by adding newlines around block elements
 * @param html The HTML string to format
 * @returns Formatted HTML string
 */
export const formatHtml = (html: string): string => {
  if (!html) return '';

  // Create a temporary DOM element
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html.trim();

  // Function to process a node and its children
  const processNode = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) {
      // Collapse multiple spaces and trim, but preserve a single space if it exists
      const text = node.textContent?.replace(/\s+/g, ' ') || '';
      return text;
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as Element;
      const tagName = element.tagName.toLowerCase();
      const isBlock = BLOCK_ELEMENTS.has(tagName);
      const isList = LIST_CONTAINERS.has(tagName);
      const isListItem = LIST_ITEMS.has(tagName);
      
      // Get attributes string
      const attrs = Array.from(element.attributes)
        .map(attr => `${attr.name}="${attr.value}"`)
        .join(' ');
      const attrString = attrs ? ' ' + attrs : '';

      // Process children
      const childNodes = Array.from(element.childNodes);
      let childContent = childNodes
        .map(child => processNode(child))
        .join('')
        .trim();

      // For list containers (ul, ol), add newlines after each li
      if (isList) {
        childContent = childContent.replace(/<\/li>/g, '</li>\n');
        return `<${tagName}${attrString}>\n${childContent}</${tagName}>\n`;
      }
      // For list items, just keep content inline
      else if (isListItem) {
        return `<${tagName}${attrString}>${childContent}</${tagName}>`;
      }
      // For block elements, add newlines around the content
      else if (isBlock) {
        return `<${tagName}${attrString}>${childContent}</${tagName}>\n`;
      }
      // For inline elements, keep everything on the same line
      else {
        return `<${tagName}${attrString}>${childContent}</${tagName}>`;
      }
    }

    return '';
  };

  // Process the entire document
  let formatted = Array.from(tempDiv.childNodes)
    .map(node => processNode(node))
    .join('')
    .trim();

  // Clean up any remaining multiple newlines
  formatted = formatted
    .replace(/\n\s*\n/g, '\n')  // Replace double+ newlines with single
    .replace(/^\s+|\s+$/g, ''); // Trim whitespace at start and end

  return formatted;
};