'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/AuthProvider';
import { supabase } from '@/lib/supabase';
import { BookOpen, DownloadCloud, Eye, Trash2, WifiOff, Loader2 } from 'lucide-react';

interface Book {
  id: string;
  title: string;
  author: string | null;
  class: number;
  subject: string;
  pdf_url: string;
  thumbnail_url: string | null;
  is_premium: boolean;
}

export default function DownloadsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [downloadedBooks, setDownloadedBooks] = useState<Book[]>([]);
  const [dbLoading, setDbLoading] = useState(true);
  const [offline, setOffline] = useState(false);

  // Guard
  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [user, loading, router]);

  // Monitor network online/offline status
  useEffect(() => {
    setOffline(!navigator.onLine);
    const goOnline = () => setOffline(false);
    const goOffline = () => setOffline(true);

    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  const fetchDownloadedBooks = async () => {
    setDbLoading(true);
    try {
      // 1. Get cached requests from Service Worker Cache
      if (typeof window === 'undefined' || !('caches' in window)) {
        setDbLoading(false);
        return;
      }

      const PDF_CACHE_NAME = 'tn-school-book-pdf-cache-v1';
      const cacheExists = await caches.has(PDF_CACHE_NAME);
      if (!cacheExists) {
        setDownloadedBooks([]);
        setDbLoading(false);
        return;
      }

      const cache = await caches.open(PDF_CACHE_NAME);
      const keys = await cache.keys();
      const cachedUrls = keys.map(request => request.url);

      if (cachedUrls.length === 0) {
        setDownloadedBooks([]);
        setDbLoading(false);
        return;
      }

      // 2. Fetch all books from Supabase to match URLs
      let booksCatalog: Book[] = [];
      
      if (navigator.onLine) {
        const { data, error } = await supabase.from('books').select('*');
        if (!error && data) {
          booksCatalog = data as Book[];
          // Save a backup of the catalog in localStorage for offline session fallback
          localStorage.setItem('books_catalog_cache', JSON.stringify(booksCatalog));
        }
      } else {
        // Retrieve backup catalog from localStorage if offline
        const cachedCatalog = localStorage.getItem('books_catalog_cache');
        if (cachedCatalog) {
          booksCatalog = JSON.parse(cachedCatalog);
        }
      }

      // 3. Filter books matching cached URLs
      const matchedBooks = booksCatalog.filter(book => {
        // PDF URLs might be relative or absolute, normalize matching including proxied routes
        return cachedUrls.some(url => {
          const decoded = decodeURIComponent(url);
          return url.includes(book.pdf_url) || book.pdf_url.includes(url) || decoded.includes(book.pdf_url);
        });
      });

      setDownloadedBooks(matchedBooks);
    } catch (err) {
      console.error('Failed to sync downloads from cache storage:', err);
    } finally {
      setDbLoading(false);
    }
  };

  useEffect(() => {
    fetchDownloadedBooks();
  }, []);

  const handleDeleteDownload = async (book: Book, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Are you sure you want to remove offline download for ${book.title}?`)) return;

    try {
      const PDF_CACHE_NAME = 'tn-school-book-pdf-cache-v1';
      const cache = await caches.open(PDF_CACHE_NAME);
      
      // Delete cached requests containing the pdf url (handling proxy URLs)
      const keys = await cache.keys();
      let deleted = false;
      for (const req of keys) {
        const decoded = decodeURIComponent(req.url);
        if (req.url.includes(book.pdf_url) || book.pdf_url.includes(req.url) || decoded.includes(book.pdf_url)) {
          await cache.delete(req);
          deleted = true;
        }
      }

      if (deleted) {
        setDownloadedBooks(downloadedBooks.filter(b => b.id !== book.id));
        alert('Offline download cache removed.');
      } else {
        alert('Could not find cached file.');
      }
    } catch (err) {
      console.error(err);
      alert('Failed to delete file from cache.');
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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-foreground tracking-tight flex items-center gap-2">
            <DownloadCloud className="text-primary" /> Offline Downloads
          </h1>
          <p className="text-sm text-on-surface-variant font-medium mt-1">Manage school book PDFs saved locally on your device for offline reading</p>
        </div>
        {offline && (
          <span className="bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1.5 border border-amber-500/15">
            <WifiOff size={14} /> Offline Mode Active
          </span>
        )}
      </div>

      {dbLoading ? (
        <div className="flex flex-col items-center justify-center py-16 gap-2">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <span className="text-xs font-semibold text-on-surface-variant">Scanning device cache...</span>
        </div>
      ) : downloadedBooks.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
          {downloadedBooks.map((book) => (
            <div 
              key={book.id} 
              className="bg-surface border border-outline-variant hover:border-primary/40 hover:shadow-md rounded-3xl p-4 flex flex-col justify-between group transition-all duration-300 relative"
            >
              
              {/* Cover Image Container */}
              <div className="aspect-[3/4] w-full bg-primary/5 rounded-2xl border border-outline-variant/60 relative overflow-hidden flex items-center justify-center flex-shrink-0 shadow-inner">
                {book.thumbnail_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img 
                    src={book.thumbnail_url} 
                    alt={book.title} 
                    className="w-full h-full object-cover" 
                  />
                ) : (
                  <BookOpen size={48} className="opacity-20 text-primary" />
                )}
                
                {/* Hover overlay button action */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <button 
                    onClick={() => router.push(`/reader/${book.id}`)}
                    className="bg-white hover:bg-white/90 text-primary font-bold text-xs px-4 py-2 rounded-2xl shadow-lg flex items-center gap-1.5"
                  >
                    <Eye size={12} />
                    Open Reader
                  </button>
                </div>
              </div>

              {/* Book Details */}
              <div className="mt-3.5 flex-grow">
                <span className="text-[9px] font-bold uppercase bg-secondary-container text-on-secondary-container px-2 py-0.5 rounded-full block w-max">
                  Class {book.class} • {book.subject}
                </span>
                <h3 className="font-extrabold text-xs sm:text-sm text-foreground truncate mt-1.5 group-hover:text-primary transition-colors">
                  {book.title}
                </h3>
              </div>

              {/* Footer CTA */}
              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => router.push(`/reader/${book.id}`)}
                  className="flex-1 text-xs font-bold py-2 rounded-2xl bg-primary-container text-on-primary-container hover:bg-primary-container/80 flex items-center justify-center gap-1 transition-all"
                >
                  <Eye size={12} /> Open
                </button>
                <button
                  onClick={(e) => handleDeleteDownload(book, e)}
                  className="p-2 text-on-surface-variant hover:text-red-500 hover:bg-red-500/10 rounded-2xl border border-outline-variant transition-all"
                  title="Delete from offline storage"
                >
                  <Trash2 size={14} />
                </button>
              </div>

            </div>
          ))}
        </div>
      ) : (
        <div className="bg-surface border border-outline-variant p-12 text-center rounded-3xl max-w-lg mx-auto">
          <DownloadCloud size={48} className="mx-auto opacity-20 text-primary mb-3" />
          <h3 className="font-bold text-foreground text-md">No books saved offline</h3>
          <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">
            Books you read in the application are automatically saved locally in the browser cache. Open any textbook in the reader while online, and it will be available here when you have no network.
          </p>
        </div>
      )}

    </div>
  );
}
