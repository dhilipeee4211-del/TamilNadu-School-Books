'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/AuthProvider';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { 
  BookOpen, 
  Crown, 
  TrendingUp, 
  Award, 
  ArrowRight,
  BookMarked
} from 'lucide-react';

interface ProgressItem {
  id: string;
  last_page: number;
  total_pages: number;
  percentage_completed: number;
  updated_at: string;
  book: {
    id: string;
    title: string;
    class: number;
    subject: string;
    thumbnail_url: string | null;
  };
}

export default function Home() {
  const { user, profile, isPremium, loading } = useAuth();
  const router = useRouter();

  const [recentProgress, setRecentProgress] = useState<ProgressItem[]>([]);
  const [stats, setStats] = useState({
    booksActive: 0,
    booksFinished: 0,
    avgCompletion: 0
  });
  const [dbLoading, setDbLoading] = useState(true);

  // Auth Guard
  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [user, loading, router]);

  // Fetch progress stats
  useEffect(() => {
    if (!user) return;

    const fetchDashboardData = async () => {
      try {
        setDbLoading(true);

        // Fetch user reading progress with book details
        const { data, error } = await supabase
          .from('reading_progress')
          .select(`
            id,
            last_page,
            total_pages,
            percentage_completed,
            updated_at,
            book:book_id (
              id,
              title,
              class,
              subject,
              thumbnail_url
            )
          `)
          .eq('user_id', user.id)
          .order('updated_at', { ascending: false });

        if (error) {
          console.error('Error fetching dashboard stats:', error);
          return;
        }

        if (data) {
          const typedData = data as unknown as ProgressItem[];
          setRecentProgress(typedData);

          // Calculate stats
          const active = typedData.filter(item => item.percentage_completed < 100).length;
          const finished = typedData.filter(item => item.percentage_completed >= 100).length;
          const avg = typedData.length > 0 
            ? Math.round(typedData.reduce((acc, curr) => acc + Number(curr.percentage_completed), 0) / typedData.length)
            : 0;

          setStats({
            booksActive: active,
            booksFinished: finished,
            avgCompletion: avg
          });
        }
      } catch (err) {
        console.error('Error in dashboard fetch:', err);
      } finally {
        setDbLoading(false);
      }
    };

    fetchDashboardData();
  }, [user]);

  if (loading || !user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[75vh]">
        <div className="w-8 h-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  // Classes list 1 to 12
  const classesList = Array.from({ length: 12 }, (_, i) => i + 1);

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      
      {/* 1. WELCOME HERO SECTION */}
      <section className="bg-gradient-to-r from-primary via-primary/95 to-secondary-container/30 text-on-primary rounded-3xl p-6 sm:p-8 relative overflow-hidden shadow-lg shadow-primary/10">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 w-40 h-40 bg-white/5 rounded-full blur-2xl -mb-10 pointer-events-none" />
        
        <div className="relative z-10 max-w-2xl">
          <span className="text-[10px] sm:text-xs font-bold uppercase tracking-widest bg-white/20 text-white px-2.5 py-1 rounded-full">
            Tamilnadu School Book Portal
          </span>
          <h1 className="text-3xl sm:text-4xl font-extrabold mt-3 tracking-tight">
            Vanakam, {profile?.full_name || 'Student'}!
          </h1>
          <p className="mt-2 text-sm sm:text-base text-primary-container font-medium max-w-lg leading-relaxed">
            Ready to explore your school books? Open your dashboard, highlights, notes, and continue learning offline anywhere.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link 
              href="/library"
              className="bg-white text-primary font-bold text-xs sm:text-sm px-5 py-2.5 rounded-2xl shadow-md hover:bg-opacity-95 hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
              Browse Library
            </Link>
            {!isPremium && (
              <Link 
                href="/premium"
                className="bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs sm:text-sm px-5 py-2.5 rounded-2xl shadow-md flex items-center gap-1.5 hover:scale-[1.02] transition-all"
              >
                <Crown size={14} /> Unlock Premium
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* 2. STATS CARDS */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-surface border border-outline-variant p-5 rounded-3xl flex items-center gap-4 shadow-sm">
          <div className="p-3 bg-primary/10 text-primary rounded-2xl">
            <BookOpen size={24} />
          </div>
          <div>
            <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider block">In Progress</span>
            <span className="text-2xl font-extrabold text-foreground">{dbLoading ? '-' : stats.booksActive} Books</span>
          </div>
        </div>

        <div className="bg-surface border border-outline-variant p-5 rounded-3xl flex items-center gap-4 shadow-sm">
          <div className="p-3 bg-green-500/10 text-green-600 dark:text-green-400 rounded-2xl">
            <Award size={24} />
          </div>
          <div>
            <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider block">Completed</span>
            <span className="text-2xl font-extrabold text-foreground">{dbLoading ? '-' : stats.booksFinished} Books</span>
          </div>
        </div>

        <div className="bg-surface border border-outline-variant p-5 rounded-3xl flex items-center gap-4 shadow-sm">
          <div className="p-3 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-2xl">
            <TrendingUp size={24} />
          </div>
          <div>
            <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider block">Average Study Progress</span>
            <span className="text-2xl font-extrabold text-foreground">{dbLoading ? '-' : `${stats.avgCompletion}%`}</span>
          </div>
        </div>
      </section>

      {/* 3. CONTINUE READING */}
      {recentProgress.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <BookMarked size={20} className="text-primary" /> Continue Reading
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {recentProgress.slice(0, 2).map((item) => (
              <div 
                key={item.id} 
                className="bg-surface border border-outline-variant p-4 rounded-3xl flex gap-4 items-center shadow-sm relative overflow-hidden group hover:border-primary/40 transition-all duration-300"
              >
                {/* Book Thumbnail Placeholder */}
                <div className="w-16 h-20 bg-primary/5 rounded-xl border border-outline-variant flex items-center justify-center text-primary font-bold overflow-hidden shadow-inner flex-shrink-0">
                  {item.book.thumbnail_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.book.thumbnail_url} alt="Book" className="w-full h-full object-cover" />
                  ) : (
                    <BookOpen size={24} className="opacity-40" />
                  )}
                </div>

                {/* Progress Details */}
                <div className="min-w-0 flex-1">
                  <span className="text-[10px] font-bold bg-secondary-container text-on-secondary-container px-2 py-0.5 rounded-full">
                    Class {item.book.class} • {item.book.subject}
                  </span>
                  <h3 className="font-bold text-sm text-foreground truncate mt-1 group-hover:text-primary transition-colors">
                    {item.book.title}
                  </h3>
                  
                  {/* Progress Bar */}
                  <div className="mt-3">
                    <div className="flex justify-between text-[11px] font-semibold text-on-surface-variant mb-1">
                      <span>Page {item.last_page} of {item.total_pages}</span>
                      <span>{Math.round(item.percentage_completed)}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-outline-variant/35 rounded-full overflow-hidden">
                      <div 
                        className="bg-primary h-full rounded-full transition-all duration-300" 
                        style={{ width: `${item.percentage_completed}%` }}
                      />
                    </div>
                  </div>
                </div>

                <Link 
                  href={`/reader/${item.book.id}`}
                  className="absolute inset-0 z-10"
                  aria-label={`Continue reading ${item.book.title}`}
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 4. CLASS GRID SELECTION */}
      <section className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold text-foreground">Explore Classes (1–12)</h2>
          <Link href="/library" className="text-xs font-bold text-primary hover:underline flex items-center gap-0.5">
            View All Books <ArrowRight size={14} />
          </Link>
        </div>
        
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
          {classesList.map((cls) => (
            <Link
              key={cls}
              href={`/library?class=${cls}`}
              className="bg-surface border border-outline-variant hover:border-primary/40 hover:bg-surface-variant/20 hover:scale-[1.03] active:scale-[0.97] p-5 rounded-3xl flex flex-col items-center justify-center text-center shadow-sm transition-all duration-300 group"
            >
              <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary font-black text-lg flex items-center justify-center mb-3 group-hover:bg-primary group-hover:text-on-primary shadow-inner transition-all duration-300">
                {cls}
              </div>
              <span className="font-bold text-sm text-foreground">Class {cls}</span>
              <span className="text-[10px] text-on-surface-variant mt-0.5 font-semibold">Standard Bookset</span>
            </Link>
          ))}
        </div>
      </section>

    </div>
  );
}
