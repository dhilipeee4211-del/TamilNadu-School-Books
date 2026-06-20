'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/AuthProvider';
import { supabase } from '@/lib/supabase';
import { Bookmark, BookOpen, Trash2, Loader2, ArrowRight } from 'lucide-react';
import Link from 'next/link';

interface BookmarkedItem {
  id: string;
  page_number: number;
  label: string | null;
  created_at: string;
  book: {
    id: string;
    title: string;
    class: number;
    subject: string;
    thumbnail_url: string | null;
  };
}

export default function BookmarksPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [bookmarks, setBookmarks] = useState<BookmarkedItem[]>([]);
  const [dbLoading, setDbLoading] = useState(true);

  // Guard
  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [user, loading, router]);

  const fetchBookmarks = async () => {
    if (!user) return;
    try {
      setDbLoading(true);
      const { data, error } = await supabase
        .from('bookmarks')
        .select(`
          id,
          page_number,
          label,
          created_at,
          book:book_id (
            id,
            title,
            class,
            subject,
            thumbnail_url
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching bookmarks:', error);
      } else if (data) {
        setBookmarks(data as unknown as BookmarkedItem[]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setDbLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchBookmarks();
    }
  }, [user]);

  const handleDeleteBookmark = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Avoid triggering navigation to reader
    if (!confirm('Are you sure you want to delete this bookmark?')) return;

    try {
      const { error } = await supabase
        .from('bookmarks')
        .delete()
        .eq('id', id);

      if (error) {
        alert(error.message);
      } else {
        setBookmarks(bookmarks.filter(b => b.id !== id));
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (loading || !user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh]">
        <div className="w-8 h-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12 animate-fade-in">
      
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-extrabold text-foreground tracking-tight">Your Bookmarks</h1>
        <p className="text-sm text-on-surface-variant font-medium mt-1">Quickly access pages you tagged in school books</p>
      </div>

      {dbLoading ? (
        <div className="flex flex-col items-center justify-center py-16 gap-2">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <span className="text-xs font-semibold text-on-surface-variant">Syncing bookmarks...</span>
        </div>
      ) : bookmarks.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {bookmarks.map((item) => (
            <div 
              key={item.id}
              onClick={() => router.push(`/reader/${item.book.id}?page=${item.page_number}`)}
              className="bg-surface border border-outline-variant p-4 rounded-3xl flex gap-4 items-center justify-between shadow-sm relative overflow-hidden group hover:border-primary/40 cursor-pointer transition-all duration-300"
            >
              
              {/* Thumbnail and Title info */}
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-12 h-16 bg-primary/5 rounded-xl border border-outline-variant flex items-center justify-center text-primary font-bold overflow-hidden shadow-inner flex-shrink-0">
                  {item.book.thumbnail_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.book.thumbnail_url} alt="Book cover" className="w-full h-full object-cover" />
                  ) : (
                    <BookOpen size={20} className="opacity-45" />
                  )}
                </div>

                <div className="min-w-0">
                  <span className="text-[9px] font-bold uppercase bg-secondary-container text-on-secondary-container px-2 py-0.5 rounded-full block w-max">
                    Class {item.book.class} • {item.book.subject}
                  </span>
                  <h3 className="font-extrabold text-sm text-foreground truncate mt-1 group-hover:text-primary transition-colors">
                    {item.book.title}
                  </h3>
                  <p className="text-[11px] text-primary font-bold mt-0.5">
                    Bookmarked Page: <span className="underline">{item.page_number}</span>
                  </p>
                  {item.label && (
                    <p className="text-[10px] text-on-surface-variant italic truncate mt-1 font-medium bg-surface-variant/20 px-2 py-0.5 rounded-lg border border-outline-variant/30">
                      &quot;{item.label}&quot;
                    </p>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                <button
                  onClick={(e) => handleDeleteBookmark(item.id, e)}
                  className="p-2 text-on-surface-variant hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all relative z-20"
                  title="Remove bookmark"
                >
                  <Trash2 size={16} />
                </button>
                <div className="p-2 text-primary group-hover:translate-x-1 transition-transform">
                  <ArrowRight size={16} />
                </div>
              </div>

            </div>
          ))}
        </div>
      ) : (
        <div className="bg-surface border border-outline-variant p-12 text-center rounded-3xl">
          <Bookmark size={48} className="mx-auto opacity-20 text-primary mb-3" />
          <h3 className="font-bold text-foreground text-md">No bookmarks set</h3>
          <p className="text-xs text-on-surface-variant mt-1">Open a school book and save specific pages to view them here.</p>
        </div>
      )}

    </div>
  );
}
