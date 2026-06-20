'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/components/providers/AuthProvider';
import { useTheme } from '@/components/providers/ThemeProvider';
import { 
  Home, 
  BookOpen, 
  Bookmark, 
  FileText, 
  Crown, 
  User, 
  ShieldAlert, 
  LogOut, 
  Sun, 
  Moon 
} from 'lucide-react';

export const Navbar = () => {
  const pathname = usePathname();
  const { user, profile, isAdmin, isPremium, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();

  // Do not render navigation if the user is not logged in or is on the login page
  if (!user || pathname === '/login') {
    return null;
  }

  const navItems = [
    { name: 'Home', href: '/', icon: Home },
    { name: 'Library', href: '/library', icon: BookOpen },
    { name: 'Bookmarks', href: '/bookmarks', icon: Bookmark },
    { name: 'Notes', href: '/notes', icon: FileText },
    { name: 'Premium', href: '/premium', icon: Crown, premiumHighlight: true },
    { name: 'Profile', href: '/profile', icon: User },
  ];

  if (isAdmin) {
    navItems.push({ name: 'Admin', href: '/admin', icon: ShieldAlert });
  }

  return (
    <>
      {/* 1. DESKTOP/TABLET SIDEBAR */}
      <aside className="hidden md:flex flex-col fixed top-0 left-0 h-screen w-64 bg-surface border-r border-outline-variant p-4 z-40 transition-all duration-300">
        {/* Brand Logo Header */}
        <div className="flex items-center gap-3 px-3 py-4 mb-6">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-on-primary font-bold text-lg shadow-md shadow-primary/20">
            TN
          </div>
          <div>
            <h1 className="font-bold text-md leading-none text-foreground">TN School Book</h1>
            <span className="text-xs text-primary font-medium tracking-wide">PWA ACADEMY</span>
          </div>
        </div>

        {/* User Quick Info */}
        <div className="bg-surface-variant/40 rounded-2xl p-3 mb-6 flex items-center gap-3 border border-outline-variant/30">
          <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center overflow-hidden">
            {profile?.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <span className="font-bold text-primary">{profile?.full_name?.charAt(0).toUpperCase() || 'S'}</span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold truncate text-foreground">{profile?.full_name || 'Student'}</p>
            <div className="flex gap-1 items-center mt-0.5">
              {isPremium ? (
                <span className="text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                  <Crown size={8} /> Premium
                </span>
              ) : (
                <span className="text-[10px] bg-secondary-container text-on-secondary-container font-semibold px-1.5 py-0.5 rounded-full">
                  Free Member
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Nav links */}
        <nav className="flex-1 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-primary-container text-on-primary-container shadow-sm'
                    : 'text-on-surface-variant hover:bg-surface-variant/50 hover:text-foreground'
                }`}
              >
                <Icon size={20} className={item.premiumHighlight && !isPremium ? 'text-amber-500 animate-pulse' : ''} />
                <span>{item.name}</span>
                {item.premiumHighlight && isPremium && (
                  <span className="ml-auto w-1.5 h-1.5 bg-amber-500 rounded-full" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer controls: theme & logout */}
        <div className="pt-4 border-t border-outline-variant/50 space-y-1">
          <button
            onClick={toggleTheme}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium text-on-surface-variant hover:bg-surface-variant/50 hover:text-foreground transition-all duration-200"
          >
            {theme === 'dark' ? (
              <>
                <Sun size={20} className="text-amber-400" />
                <span>Light Mode</span>
              </>
            ) : (
              <>
                <Moon size={20} className="text-primary" />
                <span>Dark Mode</span>
              </>
            )}
          </button>
          
          <button
            onClick={signOut}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium text-red-500 hover:bg-red-500/10 transition-all duration-200"
          >
            <LogOut size={20} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* 2. MOBILE BOTTOM NAVIGATION */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-surface border-t border-outline-variant flex items-center justify-around px-2 pb-safe z-40 shadow-lg">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center flex-1 h-full py-1 text-[10px] font-medium transition-all duration-200 relative ${
                isActive ? 'text-primary' : 'text-on-surface-variant'
              }`}
            >
              <div className={`p-1.5 rounded-full transition-all duration-200 ${isActive ? 'bg-primary-container text-on-primary-container' : ''}`}>
                <Icon size={20} />
              </div>
              <span className="mt-0.5 leading-none">{item.name}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
};
