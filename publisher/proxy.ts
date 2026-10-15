import { type NextRequest, NextResponse } from 'next/server';

const THEME_ERROR_ROUTES = new Set(['/403', '/500', '/503']);
const INTERNAL_THEME_ERROR_ROUTE = '/theme-error-status/';

const withBuildHeader = (response: NextResponse) => {
  const build = process.env.APP_VERSION?.trim();
  if (build) response.headers.set('X-ECEEE-Build', build);
  return response;
};

export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname.replace(/\/$/, '');
  if (path === INTERNAL_THEME_ERROR_ROUTE.slice(0, -1) || path.startsWith(INTERNAL_THEME_ERROR_ROUTE)) {
    return withBuildHeader(new NextResponse('Not Found', { status: 404 }));
  }
  if (!THEME_ERROR_ROUTES.has(path)) return withBuildHeader(NextResponse.next());
  const status = Number(path.slice(1));
  const destination = request.nextUrl.clone();
  destination.pathname = `/theme-error-status/${status}`;
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-eceee-theme-error', String(status));
  return withBuildHeader(NextResponse.rewrite(destination, { status, request: { headers: requestHeaders } }));
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
