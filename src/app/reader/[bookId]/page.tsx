'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/components/providers/AuthProvider';
import { supabase } from '@/lib/supabase';
import { 
  ChevronLeft, 
  ChevronRight, 
  ZoomIn, 
  ZoomOut, 
  Search, 
  Bookmark, 
  Highlighter, 
  StickyNote, 
  Trash2, 
  Loader2, 
  Settings, 
  ArrowLeft,
  X,
  MessageSquarePlus,
  BookmarkCheck,
  BookOpen,
  DownloadCloud,
  CheckCircle2
} from 'lucide-react';
import * as pdfjs from 'pdfjs-dist';

// Set worker CDN matching the installed package
if (typeof window !== 'undefined') {
  pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs`;
}

interface Book {
  id: string;
  title: string;
  pdf_url: string;
  is_premium: boolean;
}

interface Highlight {
  id: string;
  page_number: number;
  rects: Array<{ left: number; top: number; width: number; height: number }>;
  text: string;
  color: string;
  notes: string | null;
}

interface BookmarkItem {
  id: string;
  page_number: number;
  label: string | null;
}

interface SearchResult {
  pageNum: number;
  snippet: string;
}

export default function ReaderPage() {
  const { bookId } = useParams() as { bookId: string };
  const { user, isPremium, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Route page search param
  const initialPage = searchParams.get('page');

  // Book data states
  const [book, setBook] = useState<Book | null>(null);
  const [pdfDoc, setPdfDoc] = useState<pdfjs.PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [zoomScale, setZoomScale] = useState(1.0);
  
  // UI Panels
  const [sidebarTab, setSidebarTab] = useState<'thumbnails' | 'search' | 'notes' | 'bookmarks'>('thumbnails');
  
  // Interactive reader states
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([]);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [readingProgressId, setReadingProgressId] = useState<string | null>(null);

  // Text selection highlight popup toolbar
  const [activeSelection, setActiveSelection] = useState<{
    text: string;
    rects: Array<{ left: number; top: number; width: number; height: number }>;
    position: { x: number; y: number };
  } | null>(null);
  const [selectedHighlightColor, setSelectedHighlightColor] = useState('#fbbf24'); // Default M3 Yellow
  const [noteInput, setNoteInput] = useState('');

  // Search PDF States
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [pdfTextCache, setPdfTextCache] = useState<Array<{ pageNum: number; text: string }>>([]);

  // Rendering loading indicator states
  const [pdfLoading, setPdfLoading] = useState(true);
  const [renderingPage, setRenderingPage] = useState(false);

  // Cache download progress tracking states
  const [isCachedOffline, setIsCachedOffline] = useState(false);
  const [downloadPercent, setDownloadPercent] = useState<number | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const textLayerRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const colors = [
    { name: 'Yellow', hex: '#fbbf24' },
    { name: 'Green', hex: '#4ade80' },
    { name: 'Blue', hex: '#60a5fa' },
    { name: 'Pink', hex: '#f472b6' },
  ];

  // 1. Guard & fetch book details
  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
      return;
    }

    const fetchBookDetails = async () => {
      try {
        const { data, error } = await supabase
          .from('books')
          .select('*')
          .eq('id', bookId)
          .single();

        if (error || !data) {
          console.error(error);
          alert('Book details could not be found.');
          router.replace('/library');
          return;
        }

        const bookData = data as Book;
        if (bookData.is_premium && !isPremium) {
          alert('This book is standard premium only. Please upgrade.');
          router.replace('/library');
          return;
        }

        setBook(bookData);
        await checkOfflineStatus(bookData.pdf_url);
      } catch (err) {
        console.error(err);
      }
    };

    if (user) {
      fetchBookDetails();
    }
  }, [user, bookId, isPremium, loading, router]);

  const checkOfflineStatus = async (url: string) => {
    if (typeof window === 'undefined' || !('caches' in window)) return;
    try {
      const cache = await caches.open('tn-school-book-pdf-cache-v1');
      const keys = await cache.keys();
      const cached = keys.some(req => {
        const decoded = decodeURIComponent(req.url);
        return req.url.includes(url) || url.includes(req.url) || decoded.includes(url);
      });
      setIsCachedOffline(cached);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDownloadReader = async () => {
    if (!book) return;
    if (downloadPercent !== null) return;

    try {
      setDownloadPercent(0);

      const proxyUrl = `/api/pdf-proxy?url=${encodeURIComponent(book.pdf_url)}`;
      const response = await fetch(proxyUrl);
      if (!response.ok) throw new Error('Response was not ok');

      const reader = response.body?.getReader();
      const contentLength = +(response.headers.get('Content-Length') || 0);

      let receivedLength = 0;
      const chunks = [];

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
          receivedLength += value.length;
          const percent = contentLength ? Math.round((receivedLength / contentLength) * 100) : 0;
          setDownloadPercent(percent);
        }
      }

      const blob = new Blob(chunks);
      const cacheResponse = new Response(blob, {
        headers: response.headers
      });

      const cache = await caches.open('tn-school-book-pdf-cache-v1');
      await cache.put(proxyUrl, cacheResponse);

      setIsCachedOffline(true);
      alert('Book saved for offline use!');
    } catch (err) {
      console.error(err);
      alert('Failed to download book for offline use.');
    } finally {
      setDownloadPercent(null);
    }
  };

  // 2. Fetch User Annotation States (bookmarks, highlights, reading progress)
  useEffect(() => {
    if (!user || !book) return;

    const fetchUserAnnotations = async () => {
      try {
        // Bookmarks
        const { data: bmData } = await supabase
          .from('bookmarks')
          .select('*')
          .eq('user_id', user.id)
          .eq('book_id', book.id);

        if (bmData) setBookmarks(bmData as BookmarkItem[]);

        // Highlights
        const { data: hlData } = await supabase
          .from('highlights')
          .select('*')
          .eq('user_id', user.id)
          .eq('book_id', book.id);

        if (hlData) setHighlights(hlData as Highlight[]);

        // Reading Progress
        const { data: progressData } = await supabase
          .from('reading_progress')
          .select('*')
          .eq('user_id', user.id)
          .eq('book_id', book.id)
          .single();

        if (progressData) {
          setReadingProgressId(progressData.id);
          // Set initial page from progress if not specified in URL query
          if (!initialPage) {
            setCurrentPage(progressData.last_page);
          }
        }
      } catch (err) {
        console.error('Failed to sync reader records:', err);
      }
    };

    fetchUserAnnotations();
  }, [user, book, initialPage]);

  // Set page from query search parameter if available
  useEffect(() => {
    if (initialPage) {
      const p = parseInt(initialPage);
      if (!isNaN(p) && p > 0) {
        setCurrentPage(p);
      }
    }
  }, [initialPage]);

  // Sync bookmark toggle state for current page
  useEffect(() => {
    const isBookmarkedHere = bookmarks.some(b => b.page_number === currentPage);
    setIsBookmarked(isBookmarkedHere);
  }, [bookmarks, currentPage]);

  // 3. Load PDF Document from URL
  useEffect(() => {
    if (!book) return;

    const loadPdfDoc = async () => {
      try {
        setPdfLoading(true);
        setPdfError(null);
        
        // Use proxy URL to bypass potential CORS restrictions
        const proxyUrl = `/api/pdf-proxy?url=${encodeURIComponent(book.pdf_url)}`;
        
        // pdfjs loading
        const loadingTask = pdfjs.getDocument({
          url: proxyUrl,
          withCredentials: false
        });

        const doc = await loadingTask.promise;
        setPdfDoc(doc);
        setNumPages(doc.numPages);
        setPdfLoading(false);

        // Warm up text cache in background for search engine capability
        cachePdfText(doc);
      } catch (err: unknown) {
        console.error('Failed to render PDF document:', err);
        const msg = err instanceof Error ? err.message : String(err);
        setPdfError(msg);
        setPdfLoading(false);
      }
    };

    loadPdfDoc();
  }, [book]);

  // 4. Render canvas page and overlay text layer
  const renderPdfPage = async () => {
    if (!pdfDoc || !canvasRef.current || renderingPage) return;

    setRenderingPage(true);
    try {
      const page = await pdfDoc.getPage(currentPage);
      
      const viewport = page.getViewport({ scale: zoomScale });
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      if (!context) return;

      canvas.height = viewport.height;
      canvas.width = viewport.width;

      // Render canvas
      const renderContext = {
        canvasContext: context,
        viewport: viewport,
        canvas: canvas
      };

      await page.render(renderContext).promise;

      // Render overlay text layer
      if (textLayerRef.current) {
        const textLayerDiv = textLayerRef.current;
        textLayerDiv.innerHTML = '';
        textLayerDiv.style.width = `${viewport.width}px`;
        textLayerDiv.style.height = `${viewport.height}px`;

        const textContent = await page.getTextContent();
        
        // Build text layer using modern constructor
        const textLayer = new pdfjs.TextLayer({
          textContentSource: textContent,
          container: textLayerDiv,
          viewport: viewport
        });
        await textLayer.render();
      }
    } catch (err) {
      console.error('Error drawing viewport canvas page:', err);
    } finally {
      setRenderingPage(false);
    }
  };

  // Redraw page on page navigation or zoom adjustments
  useEffect(() => {
    if (pdfDoc) {
      renderPdfPage();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdfDoc, currentPage, zoomScale]);

  // Update Reading Progress instantly in Supabase
  const syncReadingProgress = async (pageNum: number) => {
    if (!user || !book) return;

    try {
      const percentage = (pageNum / numPages) * 100;
      const payload = {
        user_id: user.id,
        book_id: book.id,
        last_page: pageNum,
        total_pages: numPages,
        percentage_completed: percentage,
        updated_at: new Date().toISOString()
      };

      if (readingProgressId) {
        await supabase
          .from('reading_progress')
          .update(payload)
          .eq('id', readingProgressId);
      } else {
        const { data } = await supabase
          .from('reading_progress')
          .upsert(payload)
          .select()
          .single();
        if (data) {
          setReadingProgressId((data as { id: string }).id);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleNextPage = () => {
    if (currentPage < numPages) {
      const nextPage = currentPage + 1;
      setCurrentPage(nextPage);
      syncReadingProgress(nextPage);
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      const prevPage = currentPage - 1;
      setCurrentPage(prevPage);
      syncReadingProgress(prevPage);
    }
  };

  // Text selection listener to spawn highlight popup tool
  const handleTextSelection = () => {
    if (typeof window === 'undefined') return;

    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !selection.toString().trim()) {
      setActiveSelection(null);
      return;
    }

    const range = selection.getRangeAt(0);
    const selectedText = selection.toString();

    // Verify selection is inside our container
    if (!containerRef.current || !containerRef.current.contains(range.commonAncestorContainer)) {
      return;
    }

    const pageContainer = containerRef.current;
    const pageRect = pageContainer.getBoundingClientRect();

    // Map selection client rects to scale-invariant relative percentages of the container
    const relativeRects = Array.from(range.getClientRects()).map((r) => ({
      left: ((r.left - pageRect.left) / pageRect.width) * 100,
      top: ((r.top - pageRect.top) / pageRect.height) * 100,
      width: (r.width / pageRect.width) * 100,
      height: (r.height / pageRect.height) * 100
    }));

    // Find position of popup tooltip near first rect
    const firstRect = range.getBoundingClientRect();
    setActiveSelection({
      text: selectedText,
      rects: relativeRects,
      position: {
        x: firstRect.left + firstRect.width / 2 - pageRect.left,
        y: firstRect.top - pageRect.top - 55 // 55px offset above first line selection
      }
    });
  };

  // Add highlight to Supabase
  const handleSaveHighlight = async () => {
    if (!user || !book || !activeSelection) return;

    try {
      const payload = {
        user_id: user.id,
        book_id: book.id,
        page_number: currentPage,
        rects: activeSelection.rects,
        text: activeSelection.text,
        color: selectedHighlightColor,
        notes: noteInput.trim() || null
      };

      const { data, error } = await supabase
        .from('highlights')
        .insert(payload)
        .select()
        .single();

      if (error) {
        alert(error.message);
      } else if (data) {
        setHighlights([...highlights, data as Highlight]);
        
        // Reset selections
        if (typeof window !== 'undefined') {
          window.getSelection()?.removeAllRanges();
        }
        setActiveSelection(null);
        setNoteInput('');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Delete highlight
  const handleDeleteHighlight = async (hlId: string) => {
    if (!confirm('Delete this highlight selection?')) return;

    try {
      const { error } = await supabase
        .from('highlights')
        .delete()
        .eq('id', hlId);

      if (error) {
        alert(error.message);
      } else {
        setHighlights(highlights.filter(h => h.id !== hlId));
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Toggle Bookmark state on current page
  const handleToggleBookmark = async () => {
    if (!user || !book) return;

    try {
      if (isBookmarked) {
        const itemToDelete = bookmarks.find(b => b.page_number === currentPage);
        if (itemToDelete) {
          const { error } = await supabase
            .from('bookmarks')
            .delete()
            .eq('id', itemToDelete.id);

          if (!error) {
            setBookmarks(bookmarks.filter(b => b.id !== itemToDelete.id));
          }
        }
      } else {
        const payload = {
          user_id: user.id,
          book_id: book.id,
          page_number: currentPage,
          label: `Bookmark Page ${currentPage}`
        };

        const { data, error } = await supabase
          .from('bookmarks')
          .insert(payload)
          .select()
          .single();

        if (data) {
          setBookmarks([...bookmarks, data as BookmarkItem]);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  // PDF Text Cache indexing for search bar
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cachePdfText = async (doc: any) => {
    try {
      const cache: Array<{ pageNum: number; text: string }> = [];
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        const textContent = await page.getTextContent();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const textItems = textContent.items.map((item: any) => item.str).join(' ');
        cache.push({ pageNum: i, text: textItems });
      }
      setPdfTextCache(cache);
    } catch (err) {
      console.error('Failed to pre-cache text content for PDF search:', err);
    }
  };

  // Search search query on the client-side text cache
  const handleSearchPdf = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    const results: SearchResult[] = [];
    
    pdfTextCache.forEach(item => {
      if (item.text.toLowerCase().includes(searchQuery.toLowerCase())) {
        // Extract a visual snippet
        const idx = item.text.toLowerCase().indexOf(searchQuery.toLowerCase());
        const start = Math.max(0, idx - 40);
        const end = Math.min(item.text.length, idx + searchQuery.length + 40);
        const snippet = '...' + item.text.slice(start, end).trim() + '...';

        results.push({
          pageNum: item.pageNum,
          snippet
        });
      }
    });

    setSearchResults(results);
    setIsSearching(false);
  };

  if (pdfError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] gap-4 p-6 bg-surface border border-outline-variant rounded-3xl max-w-md mx-auto text-center animate-fade-in">
        <div className="w-12 h-12 bg-red-500/10 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-2">
          <X className="w-6 h-6" />
        </div>
        <h3 className="font-extrabold text-foreground text-md">Failed to Load PDF</h3>
        <p className="text-xs text-on-surface-variant leading-relaxed">
          There was a problem loading the curriculum PDF document. Error: <span className="font-mono text-[10px] text-red-500 block mt-1 p-2 bg-red-500/5 rounded border border-red-500/10">{pdfError}</span>
        </p>
        <button
          onClick={() => {
            setPdfError(null);
            setPdfLoading(true);
            router.refresh();
          }}
          className="mt-2 px-4 py-2 bg-primary text-on-primary text-xs font-bold rounded-xl hover:bg-primary/95 transition-all shadow-sm"
        >
          Retry Loading
        </button>
      </div>
    );
  }

  if (loading || pdfLoading || !book) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] gap-4">
        <Loader2 className="w-12 h-12 animate-spin text-primary" />
        <p className="text-sm font-semibold text-on-surface-variant animate-pulse">Initializing PWA Reader engine...</p>
      </div>
    );
  }

  const currentHighlights = highlights.filter(h => h.page_number === currentPage);

  return (
    <div className="flex flex-col h-[85vh] bg-surface border border-outline-variant rounded-3xl overflow-hidden shadow-xl animate-fade-in">
      
      {/* 1. TOP READER BAR CONTROLS */}
      <header className="h-14 border-b border-outline-variant bg-surface px-4 flex items-center justify-between z-30">
        
        {/* Back and Title */}
        <div className="flex items-center gap-3 min-w-0">
          <button 
            onClick={() => router.push('/library')}
            className="p-2 hover:bg-surface-variant/40 rounded-full transition-all text-on-surface-variant"
            title="Back to library"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="min-w-0">
            <h1 className="font-extrabold text-xs sm:text-sm text-foreground truncate">{book.title}</h1>
            <p className="text-[10px] text-on-surface-variant font-medium">Page {currentPage} of {numPages}</p>
          </div>
        </div>

        {/* Zoom and Page controls */}
        <div className="flex items-center gap-2">
          
          {/* Zoom Buttons */}
          <div className="hidden sm:flex items-center gap-1 border border-outline-variant/60 rounded-xl px-2 py-1 bg-surface-variant/10 text-xs">
            <button 
              onClick={() => setZoomScale(Math.max(0.6, zoomScale - 0.15))}
              className="p-1 hover:bg-surface rounded text-on-surface-variant"
              title="Zoom out"
            >
              <ZoomOut size={14} />
            </button>
            <span className="font-bold px-1.5 min-w-[45px] text-center">{Math.round(zoomScale * 100)}%</span>
            <button 
              onClick={() => setZoomScale(Math.min(2.5, zoomScale + 0.15))}
              className="p-1 hover:bg-surface rounded text-on-surface-variant"
              title="Zoom in"
            >
              <ZoomIn size={14} />
            </button>
          </div>

          {/* Previous/Next */}
          <div className="flex items-center gap-1 border border-outline-variant/60 rounded-xl bg-surface-variant/10">
            <button 
              onClick={handlePrevPage}
              disabled={currentPage <= 1}
              className="p-1.5 hover:bg-surface rounded-l-xl text-on-surface-variant disabled:opacity-30"
              title="Previous Page"
            >
              <ChevronLeft size={16} />
            </button>
            <div className="px-2 text-xs font-bold min-w-[60px] text-center">
              {currentPage} / {numPages}
            </div>
            <button 
              onClick={handleNextPage}
              disabled={currentPage >= numPages}
              className="p-1.5 hover:bg-surface rounded-r-xl text-on-surface-variant disabled:opacity-30"
              title="Next Page"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Offline Cache Controls */}
          <div className="flex items-center">
            {downloadPercent !== null ? (
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 border border-primary/20 bg-primary/5 rounded-xl text-xs text-primary font-bold">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span className="text-[10px]">Saving {downloadPercent}%</span>
              </div>
            ) : isCachedOffline ? (
              <div 
                className="flex items-center gap-1 px-2.5 py-1.5 border border-green-500/20 bg-green-500/5 rounded-xl text-xs text-green-600 dark:text-green-400 font-bold"
                title="This book is cached and available for offline reading"
              >
                <CheckCircle2 size={14} />
                <span className="text-[10px] hidden sm:inline">Offline Ready</span>
              </div>
            ) : (
              <button
                onClick={handleDownloadReader}
                className="flex items-center gap-1 px-2.5 py-1.5 border border-outline-variant hover:border-primary/25 hover:bg-primary/5 rounded-xl text-xs text-on-surface-variant hover:text-primary transition-all font-bold"
                title="Download PDF to browser cache for offline use"
              >
                <DownloadCloud size={14} />
                <span className="text-[10px] hidden sm:inline">Save Offline</span>
              </button>
            )}
          </div>

          {/* Bookmark Switch */}
          <button
            onClick={handleToggleBookmark}
            className={`p-2.5 rounded-full transition-all border ${
              isBookmarked 
                ? 'bg-primary-container text-on-primary-container border-primary/20 shadow-sm' 
                : 'hover:bg-surface-variant/40 border-outline-variant text-on-surface-variant'
            }`}
            title={isBookmarked ? 'Remove bookmark' : 'Bookmark this page'}
          >
            {isBookmarked ? <BookmarkCheck size={18} /> : <Bookmark size={18} />}
          </button>

        </div>

      </header>

      {/* 2. BODY LAYOUT: LEFT SIDEBAR + CANVAS WORKSPACE */}
      <div className="flex-1 flex min-h-0 relative">
        
        {/* SIDEBAR */}
        <aside className="w-72 border-r border-outline-variant bg-surface flex flex-col z-20 min-h-0 hidden lg:flex">
          
          {/* Tabs header selector */}
          <div className="flex border-b border-outline-variant bg-surface-variant/10 text-[10px] font-bold">
            <button 
              onClick={() => setSidebarTab('thumbnails')}
              className={`flex-1 py-3 text-center border-b-2 transition-all ${sidebarTab === 'thumbnails' ? 'border-primary text-primary bg-surface' : 'border-transparent text-on-surface-variant hover:bg-surface-variant/15'}`}
            >
              Pages
            </button>
            <button 
              onClick={() => setSidebarTab('search')}
              className={`flex-1 py-3 text-center border-b-2 transition-all ${sidebarTab === 'search' ? 'border-primary text-primary bg-surface' : 'border-transparent text-on-surface-variant hover:bg-surface-variant/15'}`}
            >
              Search
            </button>
            <button 
              onClick={() => setSidebarTab('notes')}
              className={`flex-1 py-3 text-center border-b-2 transition-all ${sidebarTab === 'notes' ? 'border-primary text-primary bg-surface' : 'border-transparent text-on-surface-variant hover:bg-surface-variant/15'}`}
            >
              Notes ({highlights.length})
            </button>
            <button 
              onClick={() => setSidebarTab('bookmarks')}
              className={`flex-1 py-3 text-center border-b-2 transition-all ${sidebarTab === 'bookmarks' ? 'border-primary text-primary bg-surface' : 'border-transparent text-on-surface-variant hover:bg-surface-variant/15'}`}
            >
              Marks ({bookmarks.length})
            </button>
          </div>

          {/* Tabs contents */}
          <div className="flex-1 overflow-y-auto p-4 min-h-0">
            
            {/* THUMBNAILS TAB */}
            {sidebarTab === 'thumbnails' && (
              <div className="grid grid-cols-2 gap-3">
                {Array.from({ length: numPages }).map((_, idx) => {
                  const pNum = idx + 1;
                  const isCurrent = currentPage === pNum;
                  return (
                    <button
                      key={pNum}
                      onClick={() => {
                        setCurrentPage(pNum);
                        syncReadingProgress(pNum);
                      }}
                      className={`flex flex-col items-center p-2 rounded-2xl border text-center transition-all ${
                        isCurrent 
                          ? 'border-primary bg-primary/5 text-primary font-bold shadow-sm' 
                          : 'border-outline-variant/60 hover:border-primary/40 hover:bg-surface-variant/10 text-on-surface-variant'
                      }`}
                    >
                      <div className="w-full aspect-[3/4] bg-surface-variant/20 rounded-xl flex items-center justify-center mb-1.5 shadow-inner">
                        <BookOpen size={24} className="opacity-15" />
                      </div>
                      <span className="text-[10px]">Page {pNum}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* SEARCH TAB */}
            {sidebarTab === 'search' && (
              <div className="space-y-4">
                <form onSubmit={handleSearchPdf} className="flex gap-2">
                  <input 
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search inside PDF..."
                    className="flex-1 px-3 py-1.5 border border-outline-variant rounded-xl text-xs bg-surface-variant/20 text-foreground"
                  />
                  <button 
                    type="submit"
                    className="p-2 bg-primary text-on-primary rounded-xl"
                  >
                    <Search size={14} />
                  </button>
                </form>

                <div className="space-y-2">
                  {isSearching ? (
                    <Loader2 className="w-5 h-5 animate-spin mx-auto text-primary" />
                  ) : searchResults.length > 0 ? (
                    searchResults.map((res, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          setCurrentPage(res.pageNum);
                          syncReadingProgress(res.pageNum);
                        }}
                        className="w-full text-left p-3 rounded-2xl border border-outline-variant hover:border-primary/30 bg-surface-variant/5 hover:bg-surface-variant/15 transition-all text-xs"
                      >
                        <span className="font-bold text-primary block mb-0.5">Page {res.pageNum}</span>
                        <p className="text-[10px] text-on-surface-variant italic font-medium leading-relaxed">
                          {res.snippet}
                        </p>
                      </button>
                    ))
                  ) : searchQuery.trim() ? (
                    <p className="text-[10px] text-on-surface-variant text-center mt-4 font-semibold">No matches found for search.</p>
                  ) : (
                    <p className="text-[10px] text-on-surface-variant text-center mt-4">Type query to search PDF catalog.</p>
                  )}
                </div>
              </div>
            )}

            {/* NOTES TAB */}
            {sidebarTab === 'notes' && (
              <div className="space-y-3">
                {highlights.map((hl) => (
                  <div
                    key={hl.id}
                    onClick={() => {
                      setCurrentPage(hl.page_number);
                      syncReadingProgress(hl.page_number);
                    }}
                    className="p-3 rounded-2xl border border-outline-variant hover:border-primary/30 transition bg-surface-variant/10 text-xs text-left cursor-pointer relative group/hl"
                  >
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-extrabold text-primary">Page {hl.page_number}</span>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteHighlight(hl.id);
                        }}
                        className="text-on-surface-variant hover:text-red-500 transition opacity-0 group-hover/hl:opacity-100 p-0.5"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                    <div 
                      className="pl-2 border-l-2 italic text-[10px] text-on-surface mb-2 truncate"
                      style={{ borderLeftColor: hl.color }}
                    >
                      &ldquo;{hl.text}&rdquo;
                    </div>
                    {hl.notes && (
                      <p className="bg-surface p-1.5 rounded-lg text-[9px] font-semibold border border-outline-variant/30 text-on-surface-variant leading-relaxed">
                        {hl.notes}
                      </p>
                    )}
                  </div>
                ))}
                {highlights.length === 0 && (
                  <p className="text-[10px] text-on-surface-variant text-center mt-4">Highlight text to see annotations list.</p>
                )}
              </div>
            )}

            {/* BOOKMARKS TAB */}
            {sidebarTab === 'bookmarks' && (
              <div className="space-y-2">
                {bookmarks.map((bm) => (
                  <div
                    key={bm.id}
                    onClick={() => {
                      setCurrentPage(bm.page_number);
                      syncReadingProgress(bm.page_number);
                    }}
                    className="p-3 rounded-2xl border border-outline-variant hover:border-primary/30 transition bg-surface-variant/10 text-xs text-left cursor-pointer flex justify-between items-center"
                  >
                    <div>
                      <span className="font-extrabold text-foreground">Page {bm.page_number}</span>
                      <p className="text-[9px] text-on-surface-variant mt-0.5 font-medium">{bm.label}</p>
                    </div>
                    <button 
                      onClick={async (e) => {
                        e.stopPropagation();
                        const { error } = await supabase.from('bookmarks').delete().eq('id', bm.id);
                        if (!error) {
                          setBookmarks(bookmarks.filter(b => b.id !== bm.id));
                        }
                      }}
                      className="text-on-surface-variant hover:text-red-500 p-1"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
                {bookmarks.length === 0 && (
                  <p className="text-[10px] text-on-surface-variant text-center mt-4">Save bookmarks to tag reference pages.</p>
                )}
              </div>
            )}

          </div>

        </aside>

        {/* WORKSPACE AREA (CANVAS CONTAINER) */}
        <div className="flex-1 bg-surface-variant/30 overflow-auto p-4 md:p-6 flex justify-center items-start min-h-0 relative select-text">
          
          <div 
            ref={containerRef}
            onMouseUp={handleTextSelection}
            onKeyUp={handleTextSelection}
            className="relative bg-white border border-outline-variant/60 shadow-lg select-text"
            style={{
              width: canvasRef.current?.width ? `${canvasRef.current.width}px` : 'auto',
              height: canvasRef.current?.height ? `${canvasRef.current.height}px` : 'auto',
            }}
          >
            {/* The PDF.js Canvas element */}
            <canvas ref={canvasRef} className="block select-none" />

            {/* Invisible overlays of select-text HTML elements rendered by PDF.js */}
            <div ref={textLayerRef} className="textLayer select-text" />

            {/* highlights rendering overlay */}
            <div className="highlight-layer">
              {currentHighlights.map((hl) => (
                hl.rects.map((r, rIdx) => (
                  <div
                    key={`${hl.id}-${rIdx}`}
                    onClick={() => {
                      if (hl.notes) {
                        alert(`Note: ${hl.notes}`);
                      } else {
                        const newNote = prompt('Edit annotation note:', hl.notes || '');
                        if (newNote !== null) {
                          supabase
                            .from('highlights')
                            .update({ notes: newNote })
                            .eq('id', hl.id)
                            .then(() => {
                              setHighlights(highlights.map(h => h.id === hl.id ? { ...h, notes: newNote } : h));
                            });
                        }
                      }
                    }}
                    className="highlight-item"
                    style={{
                      left: `${r.left}%`,
                      top: `${r.top}%`,
                      width: `${r.width}%`,
                      height: `${r.height}%`,
                      backgroundColor: hl.color
                    }}
                    title={hl.notes || 'Click to annotate'}
                  />
                ))
              ))}
            </div>

            {/* TEXT SELECTION TOOLBAR TOOLTIP POPUP */}
            {activeSelection && (
              <div 
                className="absolute bg-surface border border-outline p-3 rounded-2xl shadow-xl flex flex-col gap-2.5 z-40 animate-fade-in w-64 select-none pointer-events-auto"
                style={{
                  left: `${activeSelection.position.x}px`,
                  top: `${activeSelection.position.y}px`,
                }}
                onClick={e => e.stopPropagation()}
              >
                <div className="flex justify-between items-center pb-1.5 border-b border-outline-variant/60">
                  <span className="text-[10px] font-bold text-on-surface-variant flex items-center gap-1">
                    <Highlighter size={12} className="text-primary" /> Select Color
                  </span>
                  <button 
                    onClick={() => setActiveSelection(null)}
                    className="text-on-surface-variant hover:text-foreground"
                  >
                    <X size={12} />
                  </button>
                </div>

                {/* Color swatches */}
                <div className="flex gap-2">
                  {colors.map((c) => (
                    <button
                      key={c.hex}
                      onClick={() => setSelectedHighlightColor(c.hex)}
                      className={`w-5 h-5 rounded-full border transition-all ${
                        selectedHighlightColor === c.hex 
                          ? 'border-foreground scale-110 shadow-sm' 
                          : 'border-transparent opacity-85 hover:opacity-100'
                      }`}
                      style={{ backgroundColor: c.hex }}
                      title={c.name}
                    />
                  ))}
                </div>

                {/* Annotation Note Input */}
                <div className="space-y-1">
                  <span className="text-[9px] font-bold text-on-surface-variant flex items-center gap-1">
                    <MessageSquarePlus size={10} /> Add Note (Optional)
                  </span>
                  <input
                    type="text"
                    value={noteInput}
                    onChange={(e) => setNoteInput(e.target.value)}
                    placeholder="Type note text..."
                    className="w-full px-2.5 py-1 border.5 border-outline rounded-xl text-[10px] bg-surface-variant/20 focus:outline-none"
                  />
                </div>

                <button
                  onClick={handleSaveHighlight}
                  className="w-full py-1.5 bg-primary hover:bg-primary/95 text-on-primary font-bold text-[10px] rounded-xl shadow-sm transition-all"
                >
                  Save Highlight
                </button>
              </div>
            )}

          </div>

        </div>

      </div>

    </div>
  );
}
