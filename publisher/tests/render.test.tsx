import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PublishedPage } from '../src/render';
import type { PublishedPageModel } from '../src/model';

const model: PublishedPageModel = {
  layout: 'main_layout',
  slots: {
    main: [
      { id: 'headline', type: 'easy_widgets.HeadlineWidget', config: { content: 'Server rendered' } },
      { id: 'content', type: 'easy_widgets.ContentWidget', config: { content: '<p>Safe body</p><script>alert(1)</script>' } },
    ],
  },
  context: {
    mode: 'public', preview: false, tenantId: '7', siteId: '1', siteHostnames: ['example.org'],
    pageId: '2', versionId: '3', componentStyles: {},
  },
  fontCss: '', themeCss: '', title: 'Page', description: '', matchedPath: '/', remainingPath: '',
};

describe('public renderer', () => {
  it('server-renders the shared widget registry and sanitizes rich HTML', () => {
    const html = renderToStaticMarkup(<PublishedPage model={model} />);
    expect(html).toContain('Server rendered');
    expect(html).toContain('<p>Safe body</p>');
    expect(html).not.toContain('<script>');
    expect(html).toContain('data-render-layout="main_layout"');
  });
});
