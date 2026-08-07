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

export const testTokens = {
  access: ACCESS_TOKEN,
  refresh: REFRESH_TOKEN,
}

export async function mockCmsApi(page, { authenticated = false } = {}) {
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
        results: rootPages,
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
}

export async function seedAuthenticatedSession(page) {
  await page.addInitScript(({ access, refresh }) => {
    window.localStorage.setItem('access_token', access)
    window.localStorage.setItem('refresh_token', refresh)
  }, testTokens)
}
