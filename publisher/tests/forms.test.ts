import { beforeEach, describe, expect, it, vi } from 'vitest';
import { findPublishedForm, submitPublishedForm, type FormSubmissionStore } from '../src/forms';
import type { Page, PageReader, ReadDb, Version, Widget } from '../src/model';

const root: Page = {
  id: '42',
  tenant_id: 'b62c7810-cdde-4dc4-b255-64ce51daf465',
  parent_id: null,
  slug: null,
  title: 'Contact',
  hostnames: ['example.org'],
  path_pattern: '',
  enable_css_injection: true,
  page_css_variables: {},
  page_custom_css: '',
};

const formWidget: Widget = {
  id: 'contact-form',
  type: 'easy_widgets.FormsWidget',
  config: {
    title: 'Contact us',
    storeSubmissions: true,
    honeypotProtection: true,
    fields: [
      { name: 'email', label: 'Email', type: 'email', required: true, validation: { max_length: 200 } },
      { name: 'topic', label: 'Topic', type: 'select', options: ['General', 'Press'], required: true },
      { name: 'updates', label: 'Updates', type: 'checkbox' },
      { name: 'channels', label: 'Channels', type: 'checkbox', options: ['Email', 'SMS'] },
    ],
  },
};

const publishedVersion: Version = {
  id: '100',
  page_id: root.id,
  meta_title: '',
  meta_description: '',
  code_layout: 'main_layout',
  widgets: {
    main: [{
      id: 'section',
      type: 'easy_widgets.SectionWidget',
      config: { slots: { content: [formWidget] } },
    }],
  },
  theme_id: null,
  enable_css_injection: true,
  page_css_variables: {},
  page_custom_css: '',
};

const reader: PageReader = {
  root: async hostname => hostname === 'example.org' ? root : null,
  child: async () => null,
  version: async pageId => pageId === root.id ? publishedVersion : null,
  theme: async () => null,
  defaultTheme: async () => null,
};
const readDb: ReadDb = { withSnapshot: async read => read(reader) };
const insert = vi.fn<FormSubmissionStore['insert']>();
const store: FormSubmissionStore = { insert };

const validInput = () => ({
  readDb,
  store,
  hostname: 'example.org',
  pageId: '42',
  widgetId: 'contact-form',
  pagePath: '/',
  values: {
    email: ['visitor@example.org'],
    topic: ['General'],
    updates: ['on'],
    'channels[]': ['Email', 'SMS'],
  },
  honeypot: '',
  at: new Date('2026-09-29T00:00:00Z'),
});

describe('public form submissions', () => {
  beforeEach(() => {
    insert.mockReset();
    insert.mockResolvedValue('stored');
  });

  it('finds a form recursively and stores only validated values with server-owned identity', async () => {
    const result = await submitPublishedForm(validInput());

    expect(result).toEqual({ status: 'success', redirectPath: '/' });
    expect(insert).toHaveBeenCalledWith({
      tenantId: root.tenant_id,
      pageId: root.id,
      versionId: publishedVersion.id,
      widgetId: 'contact-form',
      formTitle: 'Contact us',
      data: {
        email: 'visitor@example.org',
        topic: 'General',
        updates: true,
        channels: ['Email', 'SMS'],
      },
    });
  });

  it.each([
    [{ email: ['not-an-email'], topic: ['General'] }, 'invalid email'],
    [{ email: ['visitor@example.org'], topic: ['Unknown'] }, 'invalid option'],
    [{ email: ['visitor@example.org'], topic: ['General'], unexpected: ['value'] }, 'unknown field'],
    [{ email: ['visitor@example.org', 'second@example.org'], topic: ['General'] }, 'duplicate scalar'],
  ])('rejects %s without writing (%s)', async (values, description) => {
    expect(description).toBeTruthy();
    const result = await submitPublishedForm({ ...validInput(), values });

    expect(result).toEqual({ status: 'invalid', redirectPath: '/' });
    expect(insert).not.toHaveBeenCalled();
  });

  it('silently accepts a tripped honeypot without storing data', async () => {
    const result = await submitPublishedForm({ ...validInput(), honeypot: 'spam' });

    expect(result).toEqual({ status: 'success', redirectPath: '/' });
    expect(insert).not.toHaveBeenCalled();
  });

  it('rejects a client-selected page or unknown widget', async () => {
    await expect(submitPublishedForm({ ...validInput(), pageId: '99' })).resolves.toEqual({ status: 'not_found' });
    await expect(submitPublishedForm({ ...validInput(), widgetId: 'missing' })).resolves.toEqual({ status: 'not_found' });
    expect(insert).not.toHaveBeenCalled();
  });

  it('returns rate limiting as page-scoped feedback', async () => {
    insert.mockResolvedValue('rate_limited');

    await expect(submitPublishedForm(validInput())).resolves.toEqual({ status: 'rate_limited', redirectPath: '/' });
  });
});

describe('form lookup', () => {
  it('rejects ambiguous duplicate widget identifiers', () => {
    expect(findPublishedForm({ main: [formWidget, { ...formWidget }] }, 'contact-form')).toBeNull();
  });

  it('does not treat the landing page slot alias as a duplicate widget', () => {
    const widgets = [formWidget];
    expect(findPublishedForm({ landing_page: widgets, landingPage: widgets }, 'contact-form')).toBe(formWidget);
  });
});
