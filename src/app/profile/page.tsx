'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/AuthProvider';
import { useTheme } from '@/components/providers/ThemeProvider';
import { supabase } from '@/lib/supabase';
import { 
  User, 
  Mail, 
  Crown, 
  Bookmark, 
  Highlighter, 
  StickyNote, 
  Moon, 
  Sun, 
  LogOut, 
  RefreshCw 
} from 'lucide-react';
import Link from 'next/link';

export default function ProfilePage() {
  const { user, profile, isPremium, refreshProfile, signOut, loading } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();

  const [stats, setStats] = useState({
    highlights: 0,
    notes: 0,
    bookmarks: 0,
  });
  const [statsLoading, setStatsLoading] = useState(true);

  // Guard
  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [user, loading, router]);

  // Fetch stats counts
  const fetchUserStats = async () => {
    if (!user) return;
    try {
      setStatsLoading(true);

      const [hlRes, notesRes, bmRes] = await Promise.all([
        supabase.from('highlights').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
        supabase.from('notes').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
        supabase.from('bookmarks').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
      ]);

      setStats({
        highlights: hlRes.count || 0,
        notes: notesRes.count || 0,
        bookmarks: bmRes.count || 0,
      });
    } catch (err) {
      console.error('Error fetching stats count:', err);
    } finally {
      setStatsLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchUserStats();
    }
  }, [user]);

  if (loading || !user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh]">
        <div className="w-8 h-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-12 animate-fade-in">
      
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-extrabold text-foreground tracking-tight">Your Profile</h1>
        <p className="text-sm text-on-surface-variant font-medium mt-1">Manage study parameters, visual theme, and active subscriptions</p>
      </div>

      {/* Main Profile Info Card */}
      <div className="bg-surface border border-outline-variant p-6 rounded-3xl shadow-sm space-y-6">
        
        {/* User Identity Details */}
        <div className="flex flex-col sm:flex-row items-center gap-5 pb-6 border-b border-outline-variant/60">
          <div className="w-20 h-20 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center overflow-hidden shadow-inner text-2xl font-black text-primary">
            {profile?.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.avatar_url} alt="Profile avatar" className="w-full h-full object-cover" />
            ) : (
              profile?.full_name?.charAt(0).toUpperCase() || 'S'
            )}
          </div>
          
          <div className="text-center sm:text-left space-y-1">
            <h2 className="text-xl font-bold text-foreground flex items-center justify-center sm:justify-start gap-2">
              {profile?.full_name || 'Student Name'}
              {isPremium && (
                <span className="bg-amber-500 text-white text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full flex items-center gap-0.5 shadow-sm">
                  <Crown size={8} /> Premium
                </span>
              )}
            </h2>
            <p className="text-xs text-on-surface-variant font-medium flex items-center justify-center sm:justify-start gap-1.5">
              <Mail size={14} /> {profile?.email || user.email}
            </p>
            <p className="text-[10px] text-on-surface-variant font-semibold">
              Role: <span className="uppercase text-primary font-bold">{profile?.role}</span>
            </p>
          </div>
        </div>

        {/* Counters / Stats Section */}
        <div>
          <h3 className="font-bold text-sm text-foreground mb-4">Study Achievements</h3>
          <div className="grid grid-cols-3 gap-4">
            
            <div className="bg-surface-variant/20 border border-outline-variant/50 p-4 rounded-2xl text-center space-y-1">
              <Highlighter className="w-5 h-5 mx-auto text-primary" />
              <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block">Highlights</span>
              <span className="text-lg font-extrabold text-foreground">
                {statsLoading ? <RefreshCw size={12} className="animate-spin mx-auto text-primary" /> : stats.highlights}
              </span>
            </div>

            <div className="bg-surface-variant/20 border border-outline-variant/50 p-4 rounded-2xl text-center space-y-1">
              <StickyNote className="w-5 h-5 mx-auto text-primary" />
              <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block">Notes</span>
              <span className="text-lg font-extrabold text-foreground">
                {statsLoading ? <RefreshCw size={12} className="animate-spin mx-auto text-primary" /> : stats.notes}
              </span>
            </div>

            <div className="bg-surface-variant/20 border border-outline-variant/50 p-4 rounded-2xl text-center space-y-1">
              <Bookmark className="w-5 h-5 mx-auto text-primary" />
              <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block">Bookmarks</span>
              <span className="text-lg font-extrabold text-foreground">
                {statsLoading ? <RefreshCw size={12} className="animate-spin mx-auto text-primary" /> : stats.bookmarks}
              </span>
            </div>

          </div>
        </div>

      </div>

      {/* App Configuration Settings */}
      <div className="bg-surface border border-outline-variant rounded-3xl overflow-hidden shadow-sm divider-y divider-outline-variant/40">
        
        {/* Theme Settings row */}
        <div className="flex justify-between items-center p-5 hover:bg-surface-variant/10 transition-colors">
          <div>
            <h3 className="font-bold text-sm text-foreground">Interface Theme</h3>
            <p className="text-[11px] text-on-surface-variant mt-0.5">Toggle between light and dark mode schemes</p>
          </div>
          <button 
            id="profile-theme-toggle"
            onClick={toggleTheme}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-2xl border border-outline-variant hover:bg-surface-variant/30 text-foreground transition-all"
          >
            {theme === 'dark' ? <Sun size={14} className="text-amber-400" /> : <Moon size={14} className="text-primary" />}
            Toggle
          </button>
        </div>

        {/* Subscription Settings row */}
        <div className="flex justify-between items-center p-5 hover:bg-surface-variant/10 transition-colors border-t border-outline-variant/60">
          <div>
            <h3 className="font-bold text-sm text-foreground">Premium Subscription</h3>
            <p className="text-[11px] text-on-surface-variant mt-0.5">
              {isPremium ? 'Your subscription is active.' : 'Unlock advanced book sets and cloud capabilities.'}
            </p>
          </div>
          {isPremium ? (
            <span className="text-xs bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold px-3 py-1 rounded-full flex items-center gap-1 border border-amber-500/20">
              <Crown size={12} /> Active
            </span>
          ) : (
            <Link 
              href="/premium"
              className="px-3.5 py-1.5 text-xs font-bold rounded-2xl bg-amber-500 hover:bg-amber-600 text-white transition-all shadow-sm"
            >
              Upgrade
            </Link>
          )}
        </div>

        {/* Sync Settings row */}
        <div className="flex justify-between items-center p-5 hover:bg-surface-variant/10 transition-colors border-t border-outline-variant/60">
          <div>
            <h3 className="font-bold text-sm text-foreground">Data Synchronization</h3>
            <p className="text-[11px] text-on-surface-variant mt-0.5">Force reload your cached subscription and user profiles</p>
          </div>
          <button 
            onClick={async () => {
              setStatsLoading(true);
              await refreshProfile();
              await fetchUserStats();
              alert('Profile and stats synchronized successfully.');
            }}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-2xl border border-outline-variant hover:bg-surface-variant/30 text-foreground transition-all"
          >
            <RefreshCw size={14} /> Sync
          </button>
        </div>

        {/* Sign out row */}
        <div className="flex justify-between items-center p-5 hover:bg-red-500/5 transition-colors border-t border-outline-variant/60">
          <div>
            <h3 className="font-bold text-sm text-red-500">Sign Out</h3>
            <p className="text-[11px] text-on-surface-variant mt-0.5">Terminate active session on this device</p>
          </div>
          <button 
            id="profile-signout-btn"
            onClick={signOut}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-2xl bg-red-500 hover:bg-red-600 text-white transition-all shadow-sm"
          >
            <LogOut size={14} /> Log Out
          </button>
        </div>

      </div>

    </div>
  );
}
