/**
 * Tests for CSS Parser Utility
 */

import { describe, it, expect } from 'vitest';
import {
    cssToElementProperties,
    parseCSSRules,
    cssToGroupElements,
    generateClassName,
    isValidClassName,
    groupElementsToCSS,
    camelToKebab,
} from '../cssParser';

describe('cssToElementProperties', () => {
    it('should parse simple CSS properties', () => {
        const css = 'font-size: 2rem; color: blue;';
        const result = cssToElementProperties(css);

        expect(result).toEqual({
            fontSize: '2rem',
            color: 'blue',
        });
    });

    it('should handle properties with trailing semicolons', () => {
        const css = 'font-size: 2rem; color: blue;';
        const result = cssToElementProperties(css);

        expect(result.fontSize).toBe('2rem');
    });

    it('should handle properties without trailing semicolons', () => {
        const css = 'font-size: 2rem; color: blue';
        const result = cssToElementProperties(css);

        expect(result.color).toBe('blue');
    });

    it('should convert kebab-case to camelCase', () => {
        const css = 'font-weight: 700; line-height: 1.5; margin-bottom: 1rem;';
        const result = cssToElementProperties(css);

        expect(result).toEqual({
            fontWeight: '700',
            lineHeight: '1.5',
            marginBottom: '1rem',
        });
    });

    it('should handle CSS comments', () => {
        const css = '/* This is a comment */ font-size: 2rem; /* Another comment */ color: blue;';
        const result = cssToElementProperties(css);

        expect(result).toEqual({
            fontSize: '2rem',
            color: 'blue',
        });
    });

    it('should handle empty CSS', () => {
        const result = cssToElementProperties('');
        expect(result).toEqual({});
    });

    it('should handle complex values with spaces', () => {
        const css = 'font-family: "Helvetica Neue", Arial, sans-serif; box-shadow: 0 2px 4px rgba(0,0,0,0.1);';
        const result = cssToElementProperties(css);

        expect(result.fontFamily).toBe('Helvetica Neue", Arial, sans-serif');
        expect(result.boxShadow).toBe('0 2px 4px rgba(0,0,0,0.1)');
    });
});

describe('parseCSSRules', () => {
    it('should parse single CSS rule', () => {
        const css = 'h1 { font-size: 2rem; color: blue; }';
        const result = parseCSSRules(css);

        expect(result).toHaveLength(1);
        expect(result[0].selector).toBe('h1');
        expect(result[0].properties).toEqual({
            fontSize: '2rem',
            color: 'blue',
        });
    });

    it('should parse multiple CSS rules', () => {
        const css = `
      h1 { font-size: 2rem; }
      p { font-size: 1rem; line-height: 1.6; }
    `;
        const result = parseCSSRules(css);

        expect(result).toHaveLength(2);
        expect(result[0].selector).toBe('h1');
        expect(result[1].selector).toBe('p');
    });

    it('should handle pseudo-classes', () => {
        const css = 'a:hover { color: red; text-decoration: underline; }';
        const result = parseCSSRules(css);

        expect(result).toHaveLength(1);
        expect(result[0].selector).toBe('a:hover');
        expect(result[0].properties.color).toBe('red');
    });

    it('should handle minified CSS', () => {
        const css = 'h1{font-size:2rem;color:blue;}p{font-size:1rem;}';
        const result = parseCSSRules(css);

        expect(result).toHaveLength(2);
        expect(result[0].properties.fontSize).toBe('2rem');
    });

    it('should handle CSS with comments', () => {
        const css = `
      /* Main heading */
      h1 { font-size: 2rem; }
      /* Paragraph */
      p { font-size: 1rem; }
    `;
        const result = parseCSSRules(css);

        expect(result).toHaveLength(2);
    });

    it('should handle empty CSS', () => {
        const result = parseCSSRules('');
        expect(result).toEqual([]);
    });

    it('should handle scoped selectors', () => {
        const css = '.container h1 { font-size: 2rem; }';
        const result = parseCSSRules(css);

        expect(result).toHaveLength(1);
        expect(result[0].selector).toBe('.container h1');
    });
});

describe('cssToGroupElements', () => {
    it('should convert simple CSS rules to elements', () => {
        const rules = [
            { selector: 'h1', properties: { fontSize: '2rem', fontWeight: '700' } },
            { selector: 'p', properties: { fontSize: '1rem', lineHeight: '1.6' } },
        ];
        const result = cssToGroupElements(rules);

        expect(result.elements).toEqual({
            h1: { fontSize: '2rem', fontWeight: '700' },
            p: { fontSize: '1rem', lineHeight: '1.6' },
        });
        expect(result.warnings).toEqual([]);
    });

    it('should handle pseudo-classes for links', () => {
        const rules = [
            { selector: 'a', properties: { color: 'blue' } },
            { selector: 'a:hover', properties: { color: 'red' } },
        ];
        const result = cssToGroupElements(rules);

        expect(result.elements).toHaveProperty('a');
        expect(result.elements).toHaveProperty('a:hover');
    });

    it('should extract element from complex selectors', () => {
        const rules = [
            { selector: '.container h1', properties: { fontSize: '2rem' } },
            { selector: 'div p', properties: { fontSize: '1rem' } },
        ];
        const result = cssToGroupElements(rules);

        expect(result.elements).toHaveProperty('h1');
        expect(result.elements).toHaveProperty('p');
    });

    it('should skip unsupported selectors', () => {
        const rules = [
            { selector: 'h1', properties: { fontSize: '2rem' } },
            { selector: '.my-class', properties: { color: 'blue' } },
            { selector: '#my-id', properties: { color: 'red' } },
        ];
        const result = cssToGroupElements(rules);

        expect(result.elements).toHaveProperty('h1');
        expect(result.elements).not.toHaveProperty('.my-class');
        expect(result.warnings).toHaveLength(2);
    });

    it('should merge properties for duplicate selectors', () => {
        const rules = [
            { selector: 'h1', properties: { fontSize: '2rem' } },
            { selector: 'h1', properties: { fontWeight: '700' } },
        ];
        const result = cssToGroupElements(rules);

        expect(result.elements.h1).toEqual({
            fontSize: '2rem',
            fontWeight: '700',
        });
    });

    it('should handle all supported HTML elements', () => {
        const elements = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'a', 'ul', 'ol', 'li', 'blockquote', 'code', 'pre', 'strong', 'em'];
        const rules = elements.map(el => ({
            selector: el,
            properties: { fontSize: '1rem' },
        }));
        const result = cssToGroupElements(rules);

        elements.forEach(el => {
            expect(result.elements).toHaveProperty(el);
        });
    });
});

describe('generateClassName', () => {
    it('should convert simple names to lowercase with hyphens', () => {
        expect(generateClassName('Heading Styles')).toBe('heading-styles');
        expect(generateClassName('Main Content')).toBe('main-content');
    });

    it('should handle multiple spaces', () => {
        expect(generateClassName('My   Group   Name')).toBe('my-group-name');
    });

    it('should remove special characters', () => {
        expect(generateClassName('Group #1!')).toBe('group-1');
        expect(generateClassName('My_Group@Name')).toBe('my-group-name');
    });

    it('should remove leading and trailing hyphens', () => {
        expect(generateClassName('---Group---')).toBe('group');
        expect(generateClassName(' Group ')).toBe('group');
    });

    it('should handle numbers', () => {
        expect(generateClassName('Group 123')).toBe('group-123');
        expect(generateClassName('2023 Updates')).toBe('2023-updates');
    });

    it('should handle empty strings', () => {
        expect(generateClassName('')).toBe('');
    });
});

describe('isValidClassName', () => {
    it('should validate correct class names', () => {
        expect(isValidClassName('my-class')).toBe(true);
        expect(isValidClassName('MyClass')).toBe(true);
        expect(isValidClassName('_class')).toBe(true);
        expect(isValidClassName('class123')).toBe(true);
        expect(isValidClassName('class-name-123')).toBe(true);
    });

    it('should reject invalid class names', () => {
        expect(isValidClassName('123class')).toBe(false); // starts with number
        expect(isValidClassName('-class')).toBe(false);   // starts with hyphen
        expect(isValidClassName('my class')).toBe(false); // contains space
        expect(isValidClassName('my@class')).toBe(false); // special char
    });

    it('should handle edge cases', () => {
        expect(isValidClassName('')).toBe(false);
    });
});

describe('groupElementsToCSS', () => {
    it('should convert elements to CSS without scoping', () => {
        const elements = {
            h1: { fontSize: '2rem', fontWeight: '700' },
            p: { fontSize: '1rem', lineHeight: '1.6' },
        };
        const result = groupElementsToCSS(elements);

        expect(result).toContain('h1 {');
        expect(result).toContain('font-size: 2rem;');
        expect(result).toContain('font-weight: 700;');
        expect(result).toContain('p {');
        expect(result).toContain('line-height: 1.6;');
    });

    it('should convert elements to CSS with class scoping', () => {
        const elements = {
            h1: { fontSize: '2rem' },
            p: { fontSize: '1rem' },
        };
        const result = groupElementsToCSS(elements, 'my-class');

        expect(result).toContain('.my-class h1 {');
        expect(result).toContain('.my-class p {');
    });

    it('should handle empty elements', () => {
        const result = groupElementsToCSS({});
        expect(result).toBe('');
    });

    it('should skip elements with no properties', () => {
        const elements = {
            h1: { fontSize: '2rem' },
            p: {},
        };
        const result = groupElementsToCSS(elements);

        expect(result).toContain('h1 {');
        expect(result).not.toContain('p {');
    });
});

describe('camelToKebab', () => {
    it('should convert camelCase to kebab-case', () => {
        expect(camelToKebab('fontSize')).toBe('font-size');
        expect(camelToKebab('fontWeight')).toBe('font-weight');
        expect(camelToKebab('marginBottom')).toBe('margin-bottom');
        expect(camelToKebab('backgroundColor')).toBe('background-color');
    });

    it('should handle already kebab-case', () => {
        expect(camelToKebab('color')).toBe('color');
        expect(camelToKebab('font')).toBe('font');
    });

    it('should handle multiple capitals', () => {
        expect(camelToKebab('WebkitTransform')).toBe('-webkit-transform');
    });
});

describe('Integration Tests', () => {
    it('should handle complete CSS import workflow', () => {
        const css = `
      h1 {
        font-size: 2.5rem;
        font-weight: 700;
        line-height: 1.2;
        margin-bottom: 1.5rem;
      }
      
      p {
        font-size: 1rem;
        line-height: 1.6;
        margin-bottom: 1rem;
      }
      
      a {
        color: blue;
        text-decoration: underline;
      }
      
      a:hover {
        color: red;
      }
    `;

        // Parse CSS
        const rules = parseCSSRules(css);
        expect(rules).toHaveLength(4);

        // Convert to elements
        const { elements, warnings } = cssToGroupElements(rules);
        expect(Object.keys(elements)).toHaveLength(4);
        expect(warnings).toHaveLength(0);

        // Verify structure
        expect(elements.h1).toEqual({
            fontSize: '2.5rem',
            fontWeight: '700',
            lineHeight: '1.2',
            marginBottom: '1.5rem',
        });

        expect(elements.p).toEqual({
            fontSize: '1rem',
            lineHeight: '1.6',
            marginBottom: '1rem',
        });

        expect(elements.a).toEqual({
            color: 'blue',
            textDecoration: 'underline',
        });

        expect(elements['a:hover']).toEqual({
            color: 'red',
        });

        // Convert back to CSS
        const outputCSS = groupElementsToCSS(elements, 'my-group');
        expect(outputCSS).toContain('.my-group h1 {');
        expect(outputCSS).toContain('.my-group p {');
        expect(outputCSS).toContain('.my-group a {');
        expect(outputCSS).toContain('.my-group a:hover {');
    });

    it('should handle CSS with unsupported selectors gracefully', () => {
        const css = `
      h1 { font-size: 2rem; }
      .my-class { color: blue; }
      #my-id { color: red; }
      p { font-size: 1rem; }
      div.container { padding: 1rem; }
    `;

        const rules = parseCSSRules(css);
        const { elements, warnings } = cssToGroupElements(rules);

        // Should only extract h1 and p
        expect(Object.keys(elements)).toHaveLength(2);
        expect(elements).toHaveProperty('h1');
        expect(elements).toHaveProperty('p');

        // Should have warnings for unsupported selectors
        expect(warnings.length).toBeGreaterThan(0);
    });
});

