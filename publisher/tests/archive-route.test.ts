import { describe, expect, it } from 'vitest';
import { archiveSelector } from '../src/archive-route';
import { canonicalPath, unresolvedDynamicDetail } from '../src/website';
import type { PublishedPageModel } from '../src/model';
const model = (type: string, config: Record<string, unknown>, status = 'empty') => ({ remainingPath: 'old/', context: { pathVariables: { news_slug: 'old' } }, slots: { main: [{ type, config, data: { status, item: { slug: 'old' } } }] } }) as unknown as PublishedPageModel;
it('uses only the object types actually supported by the published detail widget', () => {
  expect(archiveSelector(model('object_storage.ObjectDetailWidget', { objectType: 'library_item' }), 'publications')).toEqual({ objectTypeNames: ['library_item'], objectTypeIds: [] });
  expect(archiveSelector(model('easy_widgets.NewsDetailWidget', { objectTypes: [7] }), 'news')).toEqual({ objectTypeIds: ['7'], objectTypeNames: [] });
  expect(archiveSelector(model('object_storage.ObjectDetailWidget', { objectType: 'event', objectId: 4 }), 'events')).toBeNull();
});
describe('old path precedence', () => {
  it('checks aliases for empty dynamic details while preserving real pages and live objects', () => {
    const empty = model('easy_widgets.NewsDetailWidget', {});
    expect(unresolvedDynamicDetail(empty)).toBe(true);
    expect(unresolvedDynamicDetail({ ...empty, slots: { main: [{ type: 'section', config: { slots: empty.slots } }] } } as unknown as PublishedPageModel)).toBe(true);
    expect(unresolvedDynamicDetail({ ...empty, remainingPath: '' })).toBe(false);
    expect(unresolvedDynamicDetail(model('easy_widgets.NewsDetailWidget', {}, 'ready'))).toBe(false);
    expect(unresolvedDynamicDetail({ ...empty, slots: {} })).toBe(true);
    expect(unresolvedDynamicDetail(model('object_storage.ObjectDetailWidget', { objectId: 4 }, 'ready'))).toBe(true);
    expect(canonicalPath('/new-address/')).toBe('/new-address');
  });
});
