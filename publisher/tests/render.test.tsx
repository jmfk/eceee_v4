import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PublishedPage, publicFormResult } from '../src/render';
import type { PublishedPageModel } from '../src/model';

const model: PublishedPageModel = {
  layout: 'main_layout',
  slots: {
    main: [
      { id: 'headline', type: 'easy_widgets.HeadlineWidget', config: { content: 'Server rendered' } },
      { id: 'content', type: 'easy_widgets.ContentWidget', config: { content: '<p>Safe body</p><script>alert(1)</script>' } },
      { id: 'form', type: 'easy_widgets.FormsWidget', config: { submitUrl: 'https://collector.invalid/submit', submitMethod: 'POST', fields: [{ name: 'email', label: 'Email', type: 'email' }] } },
    ],
  },
  context: {
    mode: 'public', preview: false, tenantId: '7', siteId: '1', siteHostnames: ['example.org'],
    pageId: '2', versionId: '3', pathVariables: {}, simulatedPath: '/', componentStyles: {},
    publicForms: { endpointBase: '/api/forms/2', pagePath: '/' },
  },
  fontUrl: '', themeCss: '', title: 'Page', description: '', matchedPath: '/', remainingPath: '',
};

describe('public renderer', () => {
  it('deduplicates a news headline and introduction during server rendering without mutating the article', () => {
    const item = { id: 'article', title: 'Energy & security', data: { summary: 'Energy & security Our introduction.' },
      widgets: { main: [{ id: 'body', type: 'easy_widgets.ContentWidget', config: {
        content: '<h1>Energy &amp; security</h1><p>Our introduction.</p><p>The rest of the article.</p>',
      } }] } };
    const before = JSON.stringify(item);
    const html = renderToStaticMarkup(<PublishedPage model={{ ...model, slots: { main: [{
      id: 'detail', type: 'easy_widgets.NewsDetailWidget', config: {}, data: { status: 'ready', item },
    }] } }} />);
    expect(html.match(/<h1\b/g)).toHaveLength(1);
    expect(html.match(/Our introduction\./g)).toHaveLength(1);
    expect(html).toContain('The rest of the article.');
    expect(JSON.stringify(item)).toBe(before);
  });

  it('server-renders the shared widget registry and sanitizes rich HTML', () => {
    const html = renderToStaticMarkup(<PublishedPage model={model} />);
    expect(html).toContain('Server rendered');
    expect(html).toContain('<p>Safe body</p>');
    expect(html).not.toContain('<script>');
    expect(html).toContain('data-render-layout="main_layout"');
    expect(html).toContain('<form');
    expect(html).not.toContain('collector.invalid');
    expect(html).toContain('action="/api/forms/2/form"');
    expect(html).toContain('name="__page_path" value="/"');
    expect(html).toContain('type="submit"');
  });

  it('derives form feedback from the browser query for every published page kind', () => {
    expect(publicFormResult('?form_status=success&form_widget=contact-form')).toEqual({
      widgetId: 'contact-form', status: 'success',
    });
    expect(publicFormResult('?form_status=invalid&form_widget=contact-form')).toBeUndefined();
    expect(publicFormResult('?form_status=error')).toBeUndefined();
  });
});
