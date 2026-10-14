import { type NextRequest, NextResponse } from 'next/server';

const THEME_ERROR_ROUTES = new Set(['/403', '/500', '/503']);

export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname.replace(/\/$/, '');
  if (!THEME_ERROR_ROUTES.has(path)) return NextResponse.next();
  const status = Number(path.slice(1));
  const destination = request.nextUrl.clone();
  destination.pathname = `/theme-error-status/${status}`;
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-eceee-theme-error', String(status));
  return NextResponse.rewrite(destination, { status, request: { headers: requestHeaders } });
}

export const config = {
  matcher: ['/403', '/403/', '/500', '/500/', '/503', '/503/'],
};
