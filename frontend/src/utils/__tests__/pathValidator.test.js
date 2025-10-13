/**
 * Path Validator Tests
 * 
 * Tests for client-side path validation security measures
 */

import { describe, it, expect } from 'vitest';
import {
    sanitizePath,
    detectMaliciousPatterns,
    validatePathFormat,
    isPathSafe,
    validateAndSanitizePath
} from '../pathValidator';

describe('pathValidator', () => {
    describe('sanitizePath', () => {
        it('should trim whitespace from path', () => {
            expect(sanitizePath('  my-article/  ')).toBe('my-article/');
            expect(sanitizePath('\tmy-article/\n')).toBe('my-article/');
        });

        it('should normalize multiple slashes to single slash', () => {
            expect(sanitizePath('my//article///')).toBe('my/article/');
            expect(sanitizePath('2025///10/my-article/')).toBe('2025/10/my-article/');
        });

        it('should remove leading slash', () => {
            expect(sanitizePath('/my-article/')).toBe('my-article/');
            expect(sanitizePath('//my-article/')).toBe('my-article/');
        });

        it('should handle empty or non-string input', () => {
            expect(sanitizePath('')).toBe('');
            expect(sanitizePath(null)).toBe('');
            expect(sanitizePath(undefined)).toBe('');
            expect(sanitizePath(123)).toBe('');
        });

        it('should preserve trailing slashes', () => {
            expect(sanitizePath('my-article/')).toBe('my-article/');
            expect(sanitizePath('my-article')).toBe('my-article');
        });
    });

    describe('detectMaliciousPatterns', () => {
        it('should detect script tags', () => {
            const result = detectMaliciousPatterns('<script>alert(1)</script>');
            expect(result.detected).toBe(true);
            expect(result.pattern).toContain('script');
        });

        it('should detect javascript protocol', () => {
            const result = detectMaliciousPatterns('javascript:alert(1)');
            expect(result.detected).toBe(true);
        });

        it('should detect data URLs', () => {
            const result = detectMaliciousPatterns('data:text/html,<script>alert(1)</script>');
            expect(result.detected).toBe(true);
        });

        it('should detect event handlers', () => {
            const result = detectMaliciousPatterns('onclick=alert(1)');
            expect(result.detected).toBe(true);
        });

        it('should detect iframe tags', () => {
            const result = detectMaliciousPatterns('<iframe src="evil.com">');
            expect(result.detected).toBe(true);
        });

        it('should detect object tags', () => {
            const result = detectMaliciousPatterns('<object data="evil.swf">');
            expect(result.detected).toBe(true);
        });

        it('should detect embed tags', () => {
            const result = detectMaliciousPatterns('<embed src="evil.swf">');
            expect(result.detected).toBe(true);
        });

        it('should detect img tags', () => {
            const result = detectMaliciousPatterns('<img src=x onerror=alert(1)>');
            expect(result.detected).toBe(true);
        });

        it('should detect svg tags', () => {
            const result = detectMaliciousPatterns('<svg onload=alert(1)>');
            expect(result.detected).toBe(true);
        });

        it('should detect vbscript protocol', () => {
            const result = detectMaliciousPatterns('vbscript:msgbox(1)');
            expect(result.detected).toBe(true);
        });

        it('should detect URL-encoded script tags', () => {
            const result = detectMaliciousPatterns('%3Cscript%3E');
            expect(result.detected).toBe(true);
        });

        it('should detect HTML entities', () => {
            const result = detectMaliciousPatterns('&#60;script&#62;');
            expect(result.detected).toBe(true);
        });

        it('should detect null bytes', () => {
            const result = detectMaliciousPatterns('my-article\0malicious');
            expect(result.detected).toBe(true);
            expect(result.pattern).toBe('null byte');
        });

        it('should not detect patterns in safe paths', () => {
            expect(detectMaliciousPatterns('my-article/').detected).toBe(false);
            expect(detectMaliciousPatterns('2025/10/my-article/').detected).toBe(false);
            expect(detectMaliciousPatterns('category/subcategory/').detected).toBe(false);
        });

        it('should handle non-string input', () => {
            expect(detectMaliciousPatterns(null).detected).toBe(false);
            expect(detectMaliciousPatterns(undefined).detected).toBe(false);
            expect(detectMaliciousPatterns(123).detected).toBe(false);
        });
    });

    describe('validatePathFormat', () => {
        it('should accept valid paths', () => {
            expect(validatePathFormat('my-article/').valid).toBe(true);
            expect(validatePathFormat('2025/10/my-article/').valid).toBe(true);
            expect(validatePathFormat('category/subcategory/').valid).toBe(true);
        });

        it('should reject empty paths', () => {
            const result = validatePathFormat('');
            expect(result.valid).toBe(false);
            expect(result.reason).toContain('empty');
        });

        it('should reject non-string input', () => {
            expect(validatePathFormat(null).valid).toBe(false);
            expect(validatePathFormat(undefined).valid).toBe(false);
            expect(validatePathFormat(123).valid).toBe(false);
        });

        it('should reject paths exceeding max length', () => {
            const longPath = 'a'.repeat(501) + '/';
            const result = validatePathFormat(longPath);
            expect(result.valid).toBe(false);
            expect(result.reason).toContain('maximum length');
        });

        it('should reject paths with null bytes', () => {
            const result = validatePathFormat('my-article\0/');
            expect(result.valid).toBe(false);
            expect(result.reason).toContain('null bytes');
        });

        it('should accept paths at max length', () => {
            const path = 'a'.repeat(499) + '/';
            expect(validatePathFormat(path).valid).toBe(true);
        });

        it('should warn about unusual characters but still pass', () => {
            // This test checks that unusual chars are logged but don't fail validation
            const consoleSpy = vi.spyOn(console, 'debug').mockImplementation(() => { });
            const result = validatePathFormat('my-article!@#$/');
            expect(result.valid).toBe(true);
            expect(consoleSpy).toHaveBeenCalled();
            consoleSpy.mockRestore();
        });
    });

    describe('isPathSafe', () => {
        it('should accept safe paths', () => {
            expect(isPathSafe('my-article/').safe).toBe(true);
            expect(isPathSafe('2025/10/my-article/').safe).toBe(true);
            expect(isPathSafe('category_name/item-123/').safe).toBe(true);
        });

        it('should reject paths with malicious patterns', () => {
            const result = isPathSafe('<script>alert(1)</script>');
            expect(result.safe).toBe(false);
            expect(result.reason).toContain('malicious');
        });

        it('should reject empty paths', () => {
            const result = isPathSafe('');
            expect(result.safe).toBe(false);
            expect(result.reason).toContain('empty');
        });

        it('should reject paths that are too long', () => {
            const longPath = 'a'.repeat(501) + '/';
            const result = isPathSafe(longPath);
            expect(result.safe).toBe(false);
            expect(result.reason).toContain('maximum length');
        });

        it('should reject paths with null bytes', () => {
            const result = isPathSafe('my-article\0/');
            expect(result.safe).toBe(false);
        });

        it('should return sanitized path on success', () => {
            const result = isPathSafe('my-article/');
            expect(result.safe).toBe(true);
            expect(result.sanitized).toBe('my-article/');
        });
    });

    describe('validateAndSanitizePath', () => {
        it('should sanitize and validate in one call', () => {
            const result = validateAndSanitizePath('  my-article/  ');
            expect(result.safe).toBe(true);
            expect(result.sanitized).toBe('my-article/');
        });

        it('should normalize slashes during sanitization', () => {
            const result = validateAndSanitizePath('my//article///');
            expect(result.safe).toBe(true);
            expect(result.sanitized).toBe('my/article/');
        });

        it('should remove leading slash', () => {
            const result = validateAndSanitizePath('/my-article/');
            expect(result.safe).toBe(true);
            expect(result.sanitized).toBe('my-article/');
        });

        it('should reject malicious patterns even after sanitization', () => {
            const result = validateAndSanitizePath('  <script>alert(1)</script>  ');
            expect(result.safe).toBe(false);
            expect(result.reason).toContain('malicious');
        });

        it('should reject empty paths after sanitization', () => {
            const result = validateAndSanitizePath('   ');
            expect(result.safe).toBe(false);
            expect(result.reason).toContain('empty');
        });
    });

    describe('edge cases', () => {
        it('should handle paths with multiple types of whitespace', () => {
            const result = validateAndSanitizePath('\n\r\t  my-article/  \t\r\n');
            expect(result.safe).toBe(true);
            expect(result.sanitized).toBe('my-article/');
        });

        it('should handle paths with mixed case', () => {
            const result = validateAndSanitizePath('My-Article-2025/');
            expect(result.safe).toBe(true);
            expect(result.sanitized).toBe('My-Article-2025/');
        });

        it('should handle paths with numbers', () => {
            const result = validateAndSanitizePath('2025/10/13/article-123/');
            expect(result.safe).toBe(true);
            expect(result.sanitized).toBe('2025/10/13/article-123/');
        });

        it('should handle paths with underscores', () => {
            const result = validateAndSanitizePath('my_article_name/');
            expect(result.safe).toBe(true);
            expect(result.sanitized).toBe('my_article_name/');
        });

        it('should handle paths with dots', () => {
            const result = validateAndSanitizePath('my.article.name/');
            expect(result.safe).toBe(true);
            expect(result.sanitized).toBe('my.article.name/');
        });
    });

    describe('XSS prevention', () => {
        const xssPayloads = [
            '<script>alert("XSS")</script>',
            'javascript:alert(1)',
            '<img src=x onerror=alert(1)>',
            '<svg onload=alert(1)>',
            '<iframe src="javascript:alert(1)">',
            'data:text/html,<script>alert(1)</script>',
            '<object data="data:text/html,<script>alert(1)</script>">',
            '<embed src="data:text/html,<script>alert(1)</script>">',
            'vbscript:msgbox(1)',
            '%3Cscript%3Ealert(1)%3C/script%3E',
            '&#60;script&#62;alert(1)&#60;/script&#62;',
        ];

        xssPayloads.forEach((payload, index) => {
            it(`should reject XSS payload #${index + 1}: ${payload.substring(0, 30)}...`, () => {
                const result = isPathSafe(payload);
                expect(result.safe).toBe(false);
                expect(result.reason).toContain('malicious');
            });
        });
    });
});

