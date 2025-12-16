/**
 * Tests for normalizeElements utility function
 * Tests various corrupted data structures that can occur during import
 */

import { describe, it, expect } from 'vitest';

// Copy of normalizeElements function for testing
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

describe('normalizeElements', () => {
  it('should handle null elements', () => {
    const result = normalizeElements(null);
    expect(result).toEqual({});
  });

  it('should handle undefined elements', () => {
    const result = normalizeElements(undefined);
    expect(result).toEqual({});
  });

  it('should handle array instead of object', () => {
    const result = normalizeElements([]);
    expect(result).toEqual({});
  });

  it('should handle array with items', () => {
    const result = normalizeElements(['li', 'ul', 'ol']);
    expect(result).toEqual({});
  });

  it('should skip null element values', () => {
    const input = {
      li: null,
      p: { fontSize: '16px' }
    };
    const result = normalizeElements(input);
    expect(result).toEqual({
      p: { fontSize: '16px' }
    });
  });

  it('should skip undefined element values', () => {
    const input = {
      li: undefined,
      p: { fontSize: '16px' }
    };
    const result = normalizeElements(input);
    expect(result).toEqual({
      p: { fontSize: '16px' }
    });
  });

  it('should skip array element values', () => {
    const input = {
      li: ['fontSize', 'color'],
      p: { fontSize: '16px' }
    };
    const result = normalizeElements(input);
    expect(result).toEqual({
      p: { fontSize: '16px' }
    });
  });

  it('should skip string element values', () => {
    const input = {
      li: 'corrupted',
      p: { fontSize: '16px' }
    };
    const result = normalizeElements(input);
    expect(result).toEqual({
      p: { fontSize: '16px' }
    });
  });

  it('should convert snake_case property keys to camelCase', () => {
    const input = {
      li: {
        font_size: '16px',
        font_family: 'Arial',
        margin_top: '10px',
        margin_bottom: '10px',
        line_height: '1.5',
        letter_spacing: '0.05em'
      }
    };
    const result = normalizeElements(input);
    expect(result).toEqual({
      li: {
        fontSize: '16px',
        fontFamily: 'Arial',
        marginTop: '10px',
        marginBottom: '10px',
        lineHeight: '1.5',
        letterSpacing: '0.05em'
      }
    });
  });

  it('should handle mixed snake_case and camelCase', () => {
    const input = {
      li: {
        fontSize: '16px',
        font_family: 'Arial',
        marginTop: '10px',
        margin_bottom: '10px'
      }
    };
    const result = normalizeElements(input);
    expect(result).toEqual({
      li: {
        fontSize: '16px',
        fontFamily: 'Arial',
        marginTop: '10px',
        marginBottom: '10px'
      }
    });
  });

  it('should handle valid elements structure', () => {
    const input = {
      li: {
        fontSize: '16px',
        color: '#333'
      },
      p: {
        fontSize: '18px',
        lineHeight: '1.6'
      }
    };
    const result = normalizeElements(input);
    expect(result).toEqual(input);
  });

  it('should handle empty object', () => {
    const result = normalizeElements({});
    expect(result).toEqual({});
  });

  it('should handle complex corrupted structure', () => {
    const input = {
      li: null,
      ul: ['item1', 'item2'],
      ol: 'string',
      p: {
        font_size: '16px',
        color: '#333'
      },
      h1: undefined,
      a: {
        color: 'blue',
        text_decoration: 'underline'
      }
    };
    const result = normalizeElements(input);
    expect(result).toEqual({
      p: {
        fontSize: '16px',
        color: '#333'
      },
      a: {
        color: 'blue',
        textDecoration: 'underline'
      }
    });
  });

  it('should handle element with empty properties object', () => {
    const input = {
      li: {}
    };
    const result = normalizeElements(input);
    expect(result).toEqual({
      li: {}
    });
  });

  it('should preserve already camelCase properties', () => {
    const input = {
      li: {
        fontSize: '16px',
        fontFamily: 'Arial',
        marginTop: '10px'
      }
    };
    const result = normalizeElements(input);
    expect(result).toEqual(input);
  });
});

