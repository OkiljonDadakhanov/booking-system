import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const authRoutes = ['/login', '/register'];
const protectedRoutes = ['/events', '/bookings'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const refreshToken = request.cookies.get('refreshToken')?.value;

  // Redirect authenticated users away from auth pages
  if (authRoutes.some((route) => pathname.startsWith(route)) && refreshToken) {
    return NextResponse.redirect(new URL('/events', request.url));
  }

  // Redirect unauthenticated users to login
  if (
    protectedRoutes.some((route) => pathname.startsWith(route)) &&
    !refreshToken
  ) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Redirect root to events or login
  if (pathname === '/') {
    if (refreshToken) {
      return NextResponse.redirect(new URL('/events', request.url));
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/login', '/register', '/events/:path*', '/bookings/:path*'],
};
