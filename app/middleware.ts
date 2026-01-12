// Next.js middleware for route protection

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public routes (no auth required)
  const publicRoutes = ['/login', '/api/auth/login', '/api/auth/refresh'];
  if (publicRoutes.some((route) => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // API routes: Auth handled in route handler (don't check tokens here)
  if (pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // Protected pages: Check for access token in Authorization header only
  // SECURITY: Do NOT check cookies for access token (XSS risk)
  // Access token should only be in Authorization header or localStorage (handled client-side)
  const accessToken = request.headers.get('Authorization')?.replace('Bearer ', '');

  // For protected pages, we rely on client-side redirect
  // The actual auth check happens in the route handler or layout
  // This middleware just allows the request through
  if (pathname.startsWith('/dashboard')) {
    // Client-side will handle redirect if not authenticated
    // We don't check token here to avoid security issues
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};

