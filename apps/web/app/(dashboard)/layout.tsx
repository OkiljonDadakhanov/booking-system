'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth-store';
import { connectSocket, disconnectSocket } from '@/lib/socket';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAuthenticated, initialized, logout, refresh } = useAuthStore();

  useEffect(() => {
    // Try to restore auth state on mount
    if (!isAuthenticated && !initialized) {
      refresh();
    }
  }, [isAuthenticated, initialized, refresh]);

  useEffect(() => {
    if (isAuthenticated) {
      connectSocket();
      return () => disconnectSocket();
    }
  }, [isAuthenticated]);

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  const navLinks = [
    { href: '/events', label: 'Events' },
    { href: '/bookings', label: 'My Bookings' },
  ];

  // Wait for auth to be initialized before rendering children
  if (!initialized) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  // Redirect to login if not authenticated after initialization
  if (!isAuthenticated) {
    router.push('/login');
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-8">
              <Link
                href="/events"
                className="text-xl font-bold text-primary-600"
              >
                BookingHub
              </Link>
              <div className="hidden sm:flex gap-1">
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
                      pathname === link.href
                        ? 'bg-primary-50 text-primary-700'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                    }`}
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-4">
              {user && (
                <span className="text-sm text-gray-600 hidden sm:inline">
                  {user.name}
                </span>
              )}
              <button
                onClick={handleLogout}
                className="text-sm text-gray-500 hover:text-gray-700 font-medium transition"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
        {/* Mobile nav */}
        <div className="sm:hidden border-t border-gray-100 px-4 py-2 flex gap-2">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`flex-1 text-center px-3 py-2 rounded-lg text-sm font-medium transition ${
                pathname === link.href
                  ? 'bg-primary-50 text-primary-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>
      </nav>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}
