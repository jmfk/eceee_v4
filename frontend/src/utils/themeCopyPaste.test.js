import { describe, expect, it } from 'vitest';
import { detectConflicts, mergeThemeData } from './themeCopyPaste';

const existing = { textOutlineStyles: { glow: { name: 'Old glow', style: 'outline' } } };
const incoming = { textOutlineStyles: { glow: { name: 'Glow', style: 'gradientBlur' }, shadow: { name: 'Shadow' } } };

describe('theme outline copy and paste', () => {
    it('detects full-theme outline conflicts', () => {
        expect(detectConflicts(existing, incoming, null, 'full')).toEqual(
            expect.arrayContaining([expect.objectContaining({ section: 'textOutlineStyles', key: 'glow' })])
        );
    });
    it('merges outlines with conflict resolutions in full themes', () => {
        const result = mergeThemeData(existing, incoming, 'full', null, { 'textOutlineStyles.glow': 'overwrite' });
        expect(result.textOutlineStyles).toEqual(incoming.textOutlineStyles);
    });
    it.each(['full', 'section'])('replaces outline definitions for %s paste', level => {
        const result = mergeThemeData(existing, level === 'full' ? incoming : incoming.textOutlineStyles,
            level, 'textOutlineStyles', {}, true);
        expect(result.textOutlineStyles).toEqual(incoming.textOutlineStyles);
    });
});
