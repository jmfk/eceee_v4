const ACCESS_TOKEN = 'playwright-access-token'
const REFRESH_TOKEN = 'playwright-refresh-token'

const json = (route, body, status = 200) => route.fulfill({
  status,
  contentType: 'application/json',
  body: JSON.stringify(body),
})

const rootPages = [
  {
    id: 101,
    title: 'Summer Study',
    slug: 'summer-study',
    parent: null,
    sortOrder: 10,
    children: [],
    childrenCount: 0,
    hostnames: ['summerstudy.local'],
    publicationStatus: 'published',
    latestVersionNumber: 3,
    publishedVersionNumber: 3,
  },
]

const clone = value => JSON.parse(JSON.stringify(value))

const createEditorPage = () => ({
  id: 101,
  title: 'Summer Study',
  slug: 'summer-study',
  parent: null,
  sortOrder: 10,
  children: [],
  childrenCount: 0,
  hostnames: ['summerstudy.local'],
  publicationStatus: 'draft',
  cachedRootId: 101,
  pathPattern: '',
  effectiveLayout: { name: 'main_layout' },
  effectiveTheme: null,
  layoutInheritanceInfo: null,
  themeInheritanceInfo: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
})

const createEditorVersion = () => ({
  id: 201,
  pageId: 101,
  page: 101,
  versionId: 201,
  versionNumber: 3,
  number: 3,
  title: 'Summer Study v3',
  status: 'draft',
  publicationStatus: 'draft',
  codeLayout: 'main_layout',
  metaTitle: '',
  metaDescription: '',
  pageData: {},
  widgets: {
    main: [
      {
        id: 'content-intro',
        type: 'easy_widgets.ContentWidget',
        name: 'Content',
        config: {
          content: '<p>Initial editor copy</p>',
          isActive: true,
        },
      },
      {
        id: 'content-sidebar',
        type: 'easy_widgets.ContentWidget',
        name: 'Content',
        config: {
          content: '<p>Second widget copy</p>',
          isActive: true,
        },
      },
      {
        id: 'headline-main',
        type: 'easy_widgets.HeadlineWidget',
        name: 'Headline',
        config: {
          anchor: '',
          content: 'Initial headline',
          componentStyle: 'default',
          showBorder: true,
          headerLevel: 'h1',
        },
      },
    ],
  },
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
})

const editorLayoutJson = {
  name: 'main_layout',
  layout: { name: 'main_layout' },
  slots: [
    {
      id: 'main',
      name: 'main',
      label: 'Main Content',
      description: 'Primary page content',
      allowedWidgetTypes: ['*'],
      maxWidgets: 20,
      required: false,
    },
  ],
}

const widgetTypes = [
  {
    type: 'easy_widgets.ContentWidget',
    name: 'Content',
    description: 'Rich text content block',
    category: 'core',
    schema: {},
  },
  {
    type: 'easy_widgets.HeadlineWidget',
    name: 'Headline',
    description: 'Header text widget for page sections',
    category: 'content',
    schema: {},
  },
]

export const testTokens = {
  access: ACCESS_TOKEN,
  refresh: REFRESH_TOKEN,
}

export async function mockCmsApi(page, { authenticated = false, pageEditor = false } = {}) {
  const editorState = {
    page: createEditorPage(),
    version: createEditorVersion(),
    savedPages: [],
    savedVersions: [],
    clipboard: {},
  }

  await page.route('**/api/v1/webpages/themes/**/styles.css*', route => route.fulfill({
    status: 200,
    contentType: 'text/css',
    body: '',
  }))

  await page.route('**/csrf-token/', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    headers: { 'set-cookie': 'csrftoken=playwright-csrf-token; Path=/' },
    body: JSON.stringify({ csrfToken: 'playwright-csrf-token' }),
  }))

  await page.route('**/api/v1/**', async (route, request) => {
    const url = new URL(request.url())
    const method = request.method()
    const authorization = request.headers().authorization
    const hasToken = authorization === `Bearer ${ACCESS_TOKEN}`
    const isAuthenticated = authenticated || hasToken

    if (url.pathname === '/api/v1/auth/token/' && method === 'POST') {
      return json(route, { access: ACCESS_TOKEN, refresh: REFRESH_TOKEN })
    }

    if (url.pathname === '/api/v1/auth/token/refresh/' && method === 'POST') {
      return json(route, { access: ACCESS_TOKEN })
    }

    if (url.pathname === '/api/v1/utils/current-user/') {
      if (!isAuthenticated) {
        return json(route, { detail: 'Authentication credentials were not provided.' }, 401)
      }

      return json(route, {
        id: 1,
        username: 'admin',
        email: 'admin@example.com',
        isStaff: true,
        isSuperuser: true,
      })
    }

    if (url.pathname === '/api/v1/webpages/pages/') {
      if (!isAuthenticated) {
        return json(route, { detail: 'Authentication credentials were not provided.' }, 401)
      }

      return json(route, {
        count: rootPages.length,
        next: null,
        previous: null,
        results: pageEditor ? [editorState.page] : rootPages,
      })
    }

    if (pageEditor && url.pathname === '/api/v1/namespaces/' && method === 'GET') {
      return json(route, {
        count: 1,
        next: null,
        previous: null,
        results: [{ id: 1, name: 'Default', slug: 'default', isDefault: true }],
      })
    }

    if (pageEditor && url.pathname === '/api/v1/webpages/layouts/default/' && method === 'GET') {
      return json(route, { default_layout: 'main_layout', name: 'main_layout' })
    }

    if (pageEditor && url.pathname === '/api/v1/webpages/layouts/' && method === 'GET') {
      return json(route, {
        count: 1,
        next: null,
        previous: null,
        results: [{ id: 'main_layout', name: 'main_layout', label: 'Main Layout', active: true }],
      })
    }

    if (pageEditor && url.pathname === '/api/v1/webpages/layouts/main_layout/json/' && method === 'GET') {
      return json(route, editorLayoutJson)
    }

    if (pageEditor && url.pathname === '/api/v1/webpages/widget-types/' && method === 'GET') {
      return json(route, widgetTypes)
    }

    if (pageEditor && url.pathname === '/api/v1/utils/clipboard/' && method === 'POST') {
      const body = request.postDataJSON()
      const entry = {
        id: `clipboard-${Date.now()}`,
        clipboardType: body.clipboardType,
        operation: body.operation,
        data: body.data,
        metadata: body.metadata || {},
        expiresAt: null,
      }
      editorState.clipboard[body.clipboardType] = entry
      return json(route, entry, 201)
    }

    const clipboardByTypeMatch = url.pathname.match(/^\/api\/v1\/utils\/clipboard\/by-type\/([^/]+)\/$/)
    if (pageEditor && clipboardByTypeMatch && method === 'GET') {
      const entry = editorState.clipboard[clipboardByTypeMatch[1]]
      return entry ? json(route, entry) : json(route, { detail: 'Clipboard entry not found' }, 404)
    }

    if (pageEditor && clipboardByTypeMatch && method === 'DELETE') {
      delete editorState.clipboard[clipboardByTypeMatch[1]]
      return json(route, {}, 204)
    }

    const clipboardEntryMatch = url.pathname.match(/^\/api\/v1\/utils\/clipboard\/([^/]+)\/$/)
    if (pageEditor && clipboardEntryMatch && method === 'GET') {
      const entry = Object.values(editorState.clipboard).find(item => item.id === clipboardEntryMatch[1])
      return entry ? json(route, entry) : json(route, { detail: 'Clipboard entry not found' }, 404)
    }

    if (pageEditor && clipboardEntryMatch && method === 'DELETE') {
      for (const [type, entry] of Object.entries(editorState.clipboard)) {
        if (entry.id === clipboardEntryMatch[1]) {
          delete editorState.clipboard[type]
        }
      }
      return json(route, {}, 204)
    }

    if (pageEditor && url.pathname === '/api/v1/utils/clipboard/clear-all/' && method === 'DELETE') {
      editorState.clipboard = {}
      return json(route, {}, 204)
    }

    if (pageEditor && url.pathname === '/api/v1/webpages/pages/101/' && method === 'GET') {
      if (!isAuthenticated) {
        return json(route, { detail: 'Authentication credentials were not provided.' }, 401)
      }

      return json(route, clone(editorState.page))
    }

    if (pageEditor && url.pathname === '/api/v1/webpages/pages/101/' && method === 'PATCH') {
      const body = request.postDataJSON()
      editorState.page = {
        ...editorState.page,
        ...body,
        updatedAt: new Date().toISOString(),
      }
      editorState.savedPages.push(clone(body))
      return json(route, clone(editorState.page))
    }

    if (pageEditor && url.pathname === '/api/v1/webpages/pages/101/versions/current/' && method === 'GET') {
      return json(route, clone(editorState.version))
    }

    if (pageEditor && url.pathname === '/api/v1/webpages/pages/101/versions/' && method === 'GET') {
      return json(route, {
        count: 1,
        next: null,
        previous: null,
        results: [clone(editorState.version)],
      })
    }

    if (pageEditor && url.pathname === '/api/v1/webpages/pages/101/versions/201/' && method === 'GET') {
      return json(route, clone(editorState.version))
    }

    if (pageEditor && url.pathname === '/api/v1/webpages/pages/101/versions/201/' && method === 'PATCH') {
      const body = request.postDataJSON()
      editorState.version = {
        ...editorState.version,
        ...body,
        widgets: body.widgets || editorState.version.widgets,
        updatedAt: new Date().toISOString(),
      }
      editorState.savedVersions.push(clone(body))
      return json(route, clone(editorState.version))
    }

    if (pageEditor && url.pathname === '/api/v1/webpages/versions/201/' && method === 'PATCH') {
      const body = request.postDataJSON()
      editorState.version = {
        ...editorState.version,
        ...body,
        widgets: body.widgets || editorState.version.widgets,
        updatedAt: new Date().toISOString(),
      }
      editorState.savedVersions.push(clone(body))
      return json(route, clone(editorState.version))
    }

    if (pageEditor && url.pathname === '/api/v1/webpages/pages/101/widget-inheritance/' && method === 'GET') {
      return json(route, {
        page_id: 101,
        parent_id: null,
        has_parent: false,
        has_inherited_content: false,
        slots: {},
        inherited_widgets: {},
        slot_inheritance_rules: {},
      })
    }

    if (
      url.pathname === '/api/v1/webpages/site-packages/exports/' ||
      url.pathname === '/api/v1/webpages/site-packages/imports/'
    ) {
      if (!isAuthenticated) {
        return json(route, { detail: 'Authentication credentials were not provided.' }, 401)
      }

      return json(route, { count: 0, next: null, previous: null, results: [] })
    }

    return json(route, { detail: `Unhandled test API route: ${method} ${url.pathname}` }, 404)
  })

  return editorState
}

export async function seedAuthenticatedSession(page) {
  await page.addInitScript(({ access, refresh }) => {
    window.localStorage.setItem('access_token', access)
    window.localStorage.setItem('refresh_token', refresh)
  }, testTokens)
}
