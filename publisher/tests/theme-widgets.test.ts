import { describe, expect, it } from 'vitest';
import { normalizeWidgets } from '../src/model';

describe('Theme widget references in publisher models', () => {
  it('retains pinned versions through top-level and nested normalization', () => {
    const widget = { id: 'person', type: 'theme_widgets.2bf85f1b-26cc-4801-8cfa-bb680f93e256', type_version: 1, config: { personName: 'Alex' } };
    const slots = normalizeWidgets({ main: [widget, { id: 'container', type: 'easy_widgets.SectionWidget', config: { slots: { content: [{ ...widget, type_version: undefined, typeVersion: 2 }] } } }] });
    expect(slots.main[0].typeVersion).toBe(1);
    const nested = slots.main[1].config.slots as { content: Array<{ typeVersion?: number }> };
    expect(nested.content[0].typeVersion).toBe(2);
  });
  it('does not invent a version for an unpinned widget', () => {
    const slots = normalizeWidgets({ main: [{ id: 'bad', type: 'theme_widgets.missing', config: {} }] });
    expect(slots.main[0].typeVersion).toBeUndefined();
  });
});
