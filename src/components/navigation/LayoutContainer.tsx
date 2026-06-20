'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/components/providers/AuthProvider';
import { Navbar } from './Navbar';
import { Loader2 } from 'lucide-react';

export const LayoutContainer = ({ children }: { children: React.ReactNode }) => {
  const pathname = usePathname();
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-background text-foreground gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
        <p className="text-sm font-semibold animate-pulse text-on-surface-variant">Syncing with school library...</p>
      </div>
    );
  }

  const isLoginPage = pathname === '/login';
  const showNav = user && !isLoginPage;

  return (
    <div className="flex min-h-screen bg-background text-foreground transition-all duration-300">
      <Navbar />
      <main className={`flex-1 flex flex-col min-h-screen transition-all duration-300 ${
        showNav 
          ? 'md:pl-64 pb-16 md:pb-0' 
          : ''
      }`}>
        <div className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {children}
        </div>
      </main>
    </div>
  );
};
