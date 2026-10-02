import { describe, expect, it } from 'vitest';
import { compileThemeCss, widgetVariantClasses } from '../src/theme';
import type { Page, Theme, Version } from '../src/model';

const page = { enable_css_injection: true, page_css_variables: {}, page_custom_css: '' } as Page;
const version = { enable_css_injection: true, page_css_variables: {}, page_custom_css: '' } as Version;

describe('publisher theme compiler', () => {
  it('compiles Django-compatible design group selectors and responsive layout properties', () => {
    const theme = {
      colors: { brand: '#123456' }, css_variables: {}, html_elements: {}, custom_css: '', breakpoints: { md: 800 },
      component_styles: {}, image_styles: {}, gallery_styles: {}, carousel_styles: {}, fonts: {},
      design_groups: { groups: [{
        widgetTypes: ['easy_widgets.HeaderWidget'], slots: ['header'],
        elements: { h1: { color: 'brand', fontFamily: 'Source Sans 3, sans-serif' } },
        layoutProperties: { 'header-widget': { xs: { height: '80px' }, md: { height: '120px' } } },
      }] },
    } as unknown as Theme;

    const css = compileThemeCss(theme, page, version);
    expect(css).toContain('.slot-header>.widget-type-easy-widgets-headerwidget h1');
    expect(css).toContain('color: var(--brand)');
    expect(css).toContain('font-family: "Source Sans 3", sans-serif');
    expect(css).toContain('.slot-header>.widget-type-easy-widgets-headerwidget .header-widget');
    expect(css).toContain('@media (min-width: 800px)');
    expect(css).toContain('height: 120px');
    expect(css).toContain('.widget-type-header');
  });

  it('maps registered widget variants from their configuration fields', () => {
    expect(widgetVariantClasses('easy_widgets.ContentWidget', { show_border: true })).toContain('border-enabled');
  });

  it('emits only styles selected by rendered widgets and skips empty image styles', () => {
    const theme = {
      colors: {}, css_variables: {}, html_elements: {}, custom_css: '', breakpoints: {}, fonts: {}, design_groups: {},
      component_styles: { selected: { css: '.selected { color: red; }' }, unused: { css: 'h4 { margin: 99px; }' } },
      image_styles: { logos: { css: 'h4 { margin: 88px; }' } }, gallery_styles: {}, carousel_styles: {},
    } as unknown as Theme;
    const slots = { main: [
      { id: 'content', type: 'easy_widgets.ContentWidget', config: { component_style: 'selected' } },
      { id: 'empty-image', type: 'easy_widgets.ImageWidget', config: { image_style: 'logos', mediaItems: [] } },
    ] };

    const css = compileThemeCss(theme, page, version, slots);
    expect(css).toContain('.selected { color: red; }');
    expect(css).not.toContain('margin: 99px');
    expect(css).not.toContain('margin: 88px');
  });
});
