'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/AuthProvider';
import { supabase } from '@/lib/supabase';
import { BookOpen, Search, Filter, Crown, Eye, Lock, RefreshCw } from 'lucide-react';
import Link from 'next/link';

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

const SUBJECTS = [
  'All Subjects',
  'Tamil',
  'English',
  'Mathematics',
  'Science',
  'Social Science',
  'Physics',
  'Chemistry',
  'Biology',
  'Computer Science'
];

function LibraryContent() {
  const { user, isPremium } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();

  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Read initial filter state from URL parameters
  const initialClassFilter = searchParams.get('class');
  const initialSubjectFilter = searchParams.get('subject');

  const [selectedClass, setSelectedClass] = useState<string>(initialClassFilter || 'All');
  const [selectedSubject, setSelectedSubject] = useState<string>(initialSubjectFilter || 'All Subjects');

  const [showPremiumDialog, setShowPremiumDialog] = useState(false);

  // Dynamically extract subjects to include custom uploaded ones
  const dynamicSubjects = ['All Subjects', ...Array.from(new Set([
    'Tamil',
    'English',
    'Mathematics',
    'Science',
    'Social Science',
    'Physics',
    'Chemistry',
    'Biology',
    'Computer Science',
    ...books.map(b => b.subject)
  ]))];

  // Sync URL search params to component state when they change
  useEffect(() => {
    if (initialClassFilter) setSelectedClass(initialClassFilter);
    if (initialSubjectFilter) setSelectedSubject(initialSubjectFilter);
  }, [initialClassFilter, initialSubjectFilter]);

  // Fetch books from Supabase
  const fetchBooks = async () => {
    try {
      setLoading(true);
      const query = supabase.from('books').select('*');

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching books:', error);
      } else if (data) {
        setBooks(data as Book[]);
      }
    } catch (err) {
      console.error('Failed to run books query:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBooks();
  }, []);

  // Filter books on client-side for rapid search/responsiveness
  const filteredBooks = books.filter((book) => {
    const matchesClass = selectedClass === 'All' || book.class.toString() === selectedClass;
    
    const matchesSubject = selectedSubject === 'All Subjects' || 
      book.subject.toLowerCase() === selectedSubject.toLowerCase();

    const matchesSearch = book.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (book.author && book.author.toLowerCase().includes(searchTerm.toLowerCase())) ||
      book.subject.toLowerCase().includes(searchTerm.toLowerCase());

    return matchesClass && matchesSubject && matchesSearch;
  });

  const handleReadBook = (book: Book) => {
    if (book.is_premium && !isPremium) {
      setShowPremiumDialog(true);
    } else {
      router.push(`/reader/${book.id}`);
    }
  };

  return (
    <div className="space-y-6 pb-12 animate-fade-in">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-foreground tracking-tight">Tamilnadu Book Library</h1>
          <p className="text-sm text-on-surface-variant font-medium mt-1">Browse school standard text books for Class 1 to 12</p>
        </div>
        <button 
          onClick={fetchBooks}
          className="flex items-center gap-1.5 px-4 py-2 border border-outline-variant hover:bg-surface-variant/30 text-xs font-semibold rounded-2xl transition-all"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh Catalog
        </button>
      </div>

      {/* Filter and Search Bar Container */}
      <div className="bg-surface border border-outline-variant p-4 rounded-3xl shadow-sm space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          
          {/* Text Search Input */}
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-on-surface-variant">
              <Search size={18} />
            </span>
            <input
              id="library-search-input"
              type="text"
              placeholder="Search books by title/subject..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full pl-10 pr-4 py-2.5 border.5 border-outline rounded-2xl text-xs bg-surface-variant/25 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            />
          </div>

          {/* Class Standard Filter */}
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-on-surface-variant">
              <Filter size={16} />
            </span>
            <select
              id="class-filter-select"
              value={selectedClass}
              onChange={(e) => {
                setSelectedClass(e.target.value);
                router.replace(`/library?class=${e.target.value}&subject=${selectedSubject}`);
              }}
              className="block w-full pl-10 pr-4 py-2.5 border.5 border-outline rounded-2xl text-xs bg-surface-variant/25 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all appearance-none cursor-pointer"
            >
              <option value="All">All Classes (1-12)</option>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((cls) => (
                <option key={cls} value={cls}>Class {cls}</option>
              ))}
            </select>
          </div>

          {/* Subject Filter */}
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-on-surface-variant">
              <BookOpen size={16} />
            </span>
            <select
              id="subject-filter-select"
              value={selectedSubject}
              onChange={(e) => {
                setSelectedSubject(e.target.value);
                router.replace(`/library?class=${selectedClass}&subject=${e.target.value}`);
              }}
              className="block w-full pl-10 pr-4 py-2.5 border.5 border-outline rounded-2xl text-xs bg-surface-variant/25 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all appearance-none cursor-pointer"
            >
              {dynamicSubjects.map((sub) => (
                <option key={sub} value={sub}>{sub}</option>
              ))}
            </select>
          </div>

        </div>
      </div>

      {/* Catalog Listing */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
          {Array.from({ length: 10 }).map((_, idx) => (
            <div key={idx} className="space-y-3 bg-surface border border-outline-variant p-4 rounded-3xl animate-pulse">
              <div className="aspect-[3/4] w-full bg-surface-variant/40 rounded-2xl" />
              <div className="h-4 bg-surface-variant/50 rounded w-3/4" />
              <div className="h-3 bg-surface-variant/40 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : filteredBooks.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
          {filteredBooks.map((book) => (
            <div 
              key={book.id} 
              className="bg-surface border border-outline-variant hover:border-primary/40 hover:shadow-md rounded-3xl p-4 flex flex-col justify-between group transition-all duration-300 relative"
            >
              
              {/* Premium Badge */}
              {book.is_premium && (
                <span className="absolute top-2.5 right-2.5 bg-amber-500 text-white p-1.5 rounded-full shadow z-10 flex items-center justify-center">
                  <Crown size={12} />
                </span>
              )}

              {/* Cover Image Container */}
              <div className="aspect-[3/4] w-full bg-primary/5 rounded-2xl border border-outline-variant/60 relative overflow-hidden flex items-center justify-center flex-shrink-0 shadow-inner">
                {book.thumbnail_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img 
                    src={book.thumbnail_url} 
                    alt={book.title} 
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" 
                  />
                ) : (
                  <BookOpen size={48} className="opacity-20 text-primary" />
                )}
                
                {/* Hover overlay button action */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <button 
                    onClick={() => handleReadBook(book)}
                    className="bg-white hover:bg-white/90 text-primary font-bold text-xs px-4 py-2 rounded-2xl shadow-lg flex items-center gap-1.5"
                  >
                    {book.is_premium && !isPremium ? <Lock size={12} /> : <Eye size={12} />}
                    Read Book
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
                <p className="text-[10px] text-on-surface-variant font-medium mt-0.5 truncate">
                  {book.author || 'Tamilnadu Textbook Board'}
                </p>
              </div>

              {/* Footer CTA */}
              <button
                onClick={() => handleReadBook(book)}
                className={`mt-4 w-full text-xs font-bold py-2 rounded-2xl flex items-center justify-center gap-1 transition-all ${
                  book.is_premium && !isPremium
                    ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20'
                    : 'bg-primary-container text-on-primary-container hover:bg-primary-container/80'
                }`}
              >
                {book.is_premium && !isPremium ? (
                  <>
                    <Lock size={12} /> Unlock Premium
                  </>
                ) : (
                  <>
                    Open Reader
                  </>
                )}
              </button>

            </div>
          ))}
        </div>
      ) : (
        <div className="bg-surface border border-outline-variant p-12 text-center rounded-3xl">
          <BookOpen size={48} className="mx-auto opacity-20 text-primary mb-3" />
          <h3 className="font-bold text-foreground text-md">No books found</h3>
          <p className="text-xs text-on-surface-variant mt-1">Try adapting your search parameters or check filters.</p>
        </div>
      )}

      {/* Premium Prompt Dialog Overlay */}
      {showPremiumDialog && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-surface border border-outline p-6 rounded-3xl max-w-sm w-full space-y-4 shadow-xl">
            <div className="w-12 h-12 bg-amber-500/10 text-amber-500 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
              <Crown size={28} />
            </div>
            <div className="text-center space-y-1">
              <h3 className="font-extrabold text-foreground text-lg">Premium Membership Needed</h3>
              <p className="text-xs text-on-surface-variant leading-relaxed">
                Class standards 10, 11, and 12 text books are locked under our Premium Plan. Subscribe now to unlock offline study packages, notes syncing, and highlight overrides.
              </p>
            </div>
            <div className="flex gap-3">
              <button 
                onClick={() => setShowPremiumDialog(false)}
                className="flex-1 py-2.5 text-xs font-semibold rounded-2xl border border-outline-variant hover:bg-surface-variant/35 text-foreground transition-all"
              >
                Go Back
              </button>
              <Link 
                href="/premium" 
                onClick={() => setShowPremiumDialog(false)}
                className="flex-1 py-2.5 text-xs font-bold rounded-2xl bg-amber-500 hover:bg-amber-600 text-white text-center transition-all shadow-md"
              >
                Subscribe Now
              </Link>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default function LibraryPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-8 h-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    }>
      <LibraryContent />
    </Suspense>
  );
}
