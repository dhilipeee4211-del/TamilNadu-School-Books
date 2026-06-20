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
  ArrowLeft,
  X,
  MessageSquarePlus,
  BookmarkCheck,
  BookOpen,
  DownloadCloud,
  CheckCircle2,
  Hand,
  Pencil,
  Grid,
  Eraser,
  Moon,
  Sun
} from 'lucide-react';
import * as pdfjs from 'pdfjs-dist';

// Set worker CDN matching the installed package
if (typeof window !== 'undefined') {
  pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@6.0.227/build/pdf.worker.min.mjs`;
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

interface StrokePoint {
  x: number;
  y: number;
}

interface Stroke {
  id: string;
  color: string;
  width: number;
  points: StrokePoint[];
}

interface SearchResult {
  pageNum: number;
  snippet: string;
}

// child component to render a single page container lazily
interface PageSlotProps {
  pageNum: number;
  pdfDoc: pdfjs.PDFDocumentProxy;
  zoomScale: number;
  theme: 'light' | 'dark' | 'sepia';
  isPenActive: boolean;
  penColor: string;
  penWidth: number;
  pageHighlights: Highlight[];
  pageDrawings: Stroke[];
  onSaveDrawing: (pageNum: number, strokes: Stroke[]) => void;
  onTextSelected: (
    rects: Array<{ left: number; top: number; width: number; height: number }>, 
    text: string, 
    position: { x: number; y: number }, 
    pageNum: number
  ) => void;
  onPageIntersect: (pageNum: number) => void;
}

const PageSlot: React.FC<PageSlotProps> = ({
  pageNum,
  pdfDoc,
  zoomScale,
  theme,
  isPenActive,
  penColor,
  penWidth,
  pageHighlights,
  pageDrawings,
  onSaveDrawing,
  onTextSelected,
  onPageIntersect
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const textLayerRef = useRef<HTMLDivElement | null>(null);
  const drawCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const [isVisible, setIsVisible] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 595, height: 842 }); // Standard A4 default
  const [strokes, setStrokes] = useState<Stroke[]>(pageDrawings);
  const [isDrawing, setIsDrawing] = useState(false);

  const activeStrokeRef = useRef<Stroke | null>(null);

  // Sync drawings when parent props change
  useEffect(() => {
    setStrokes(pageDrawings || []);
  }, [pageDrawings]);

  // Redraw pencil strokes on size adjustment
  useEffect(() => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    strokes.forEach((stroke) => {
      if (stroke.points.length < 2) return;
      ctx.beginPath();
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.width * zoomScale; // Scale stroke width with zoom
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      const first = stroke.points[0];
      ctx.moveTo((first.x / 100) * canvas.width, (first.y / 100) * canvas.height);
      for (let i = 1; i < stroke.points.length; i++) {
        const pt = stroke.points[i];
        ctx.lineTo((pt.x / 100) * canvas.width, (pt.y / 100) * canvas.height);
      }
      ctx.stroke();
    });
  }, [strokes, dimensions, zoomScale]);

  // Observer to lazily load page slot content
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            onPageIntersect(pageNum);
          } else {
            setIsVisible(false);
          }
        });
      },
      { rootMargin: '400px 0px 400px 0px', threshold: 0.15 }
    );

    observer.observe(container);
    return () => observer.disconnect();
  }, [pageNum, onPageIntersect]);

  // Render canvas & text layer viewport
  useEffect(() => {
    if (!isVisible || !pdfDoc) return;
    let active = true;

    const renderPage = async () => {
      try {
        setRendering(true);
        const page = await pdfDoc.getPage(pageNum);
        const viewport = page.getViewport({ scale: zoomScale });

        if (!active) return;
        setDimensions({ width: viewport.width, height: viewport.height });

        // Setup rendering canvas
        const canvas = canvasRef.current;
        if (canvas) {
          canvas.height = viewport.height;
          canvas.width = viewport.width;
          const context = canvas.getContext('2d');
          if (context) {
            await page.render({
              canvasContext: context,
              viewport: viewport,
              canvas: canvas
            }).promise;
          }
        }

        // Setup overlays
        if (textLayerRef.current) {
          const textLayerDiv = textLayerRef.current;
          textLayerDiv.innerHTML = '';
          textLayerDiv.style.width = `${viewport.width}px`;
          textLayerDiv.style.height = `${viewport.height}px`;

          const textContent = await page.getTextContent();
          const textLayer = new pdfjs.TextLayer({
            textContentSource: textContent,
            container: textLayerDiv,
            viewport: viewport
          });
          await textLayer.render();
        }

        // Setup draw canvas dimensions
        const drawCanvas = drawCanvasRef.current;
        if (drawCanvas) {
          drawCanvas.width = viewport.width;
          drawCanvas.height = viewport.height;
        }

        setRendering(false);
      } catch (err) {
        console.error('Failed page slot load:', pageNum, err);
        setRendering(false);
      }
    };

    renderPage();
    return () => {
      active = false;
    };
  }, [isVisible, pdfDoc, pageNum, zoomScale]);

  // Selection handler for dynamic text markup popup
  const handleTextSelection = () => {
    if (isPenActive) return;
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !selection.toString().trim()) return;

    const range = selection.getRangeAt(0);
    const container = containerRef.current;
    if (!container || !container.contains(range.commonAncestorContainer)) return;

    const rect = container.getBoundingClientRect();
    const relativeRects = Array.from(range.getClientRects()).map((r) => ({
      left: ((r.left - rect.left) / rect.width) * 100,
      top: ((r.top - rect.top) / rect.height) * 100,
      width: (r.width / rect.width) * 100,
      height: (r.height / rect.height) * 100
    }));

    const firstRect = range.getBoundingClientRect();
    onTextSelected(
      relativeRects,
      selection.toString(),
      {
        x: firstRect.left + firstRect.width / 2 - rect.left,
        y: firstRect.top - rect.top - 55
      },
      pageNum
    );
  };

  // Pencil event handlers
  const handleDrawStart = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isPenActive) return;
    const canvas = drawCanvasRef.current;
    if (!canvas) return;

    setIsDrawing(true);
    const rect = canvas.getBoundingClientRect();
    let clientX = 0;
    let clientY = 0;

    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const x = ((clientX - rect.left) / rect.width) * 100;
    const y = ((clientY - rect.top) / rect.height) * 100;

    activeStrokeRef.current = {
      id: Math.random().toString(36).substring(2, 9),
      color: penColor,
      width: penWidth,
      points: [{ x, y }]
    };
  };

  const handleDrawMove = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !activeStrokeRef.current) return;
    const canvas = drawCanvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    let clientX = 0;
    let clientY = 0;

    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const x = ((clientX - rect.left) / rect.width) * 100;
    const y = ((clientY - rect.top) / rect.height) * 100;

    const currentPoints = [...activeStrokeRef.current.points, { x, y }];
    activeStrokeRef.current = {
      ...activeStrokeRef.current,
      points: currentPoints
    };

    // Real-time local drawing updates
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.beginPath();
      ctx.strokeStyle = penColor;
      ctx.lineWidth = penWidth * zoomScale;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      const prev = currentPoints[currentPoints.length - 2];
      ctx.moveTo((prev.x / 100) * canvas.width, (prev.y / 100) * canvas.height);
      ctx.lineTo((x / 100) * canvas.width, (y / 100) * canvas.height);
      ctx.stroke();
    }
  };

  const handleDrawEnd = () => {
    if (!isDrawing || !activeStrokeRef.current) return;
    setIsDrawing(false);

    const newStrokes = [...strokes, activeStrokeRef.current];
    setStrokes(newStrokes);
    onSaveDrawing(pageNum, newStrokes);
    activeStrokeRef.current = null;
  };

  const getThemeFilterStyle = () => {
    if (theme === 'dark') return { filter: 'invert(1) hue-rotate(180deg)' };
    if (theme === 'sepia') return { filter: 'sepia(0.6) contrast(0.9) brightness(0.95)' };
    return {};
  };

  return (
    <div 
      id={`page-slot-${pageNum}`}
      ref={containerRef}
      className="relative bg-white shadow-md mx-auto select-text border border-outline-variant/35"
      style={{
        width: `${dimensions.width}px`,
        height: `${dimensions.height}px`,
        ...getThemeFilterStyle()
      }}
      onMouseUp={handleTextSelection}
      onTouchEnd={handleTextSelection}
    >
      {!isVisible && (
        <div className="absolute inset-0 flex items-center justify-center bg-surface-variant/15 text-xs text-on-surface-variant font-medium">
          Loading Page {pageNum}...
        </div>
      )}

      {isVisible && (
        <>
          <canvas ref={canvasRef} className="absolute inset-0 z-0" />
          
          <div 
            ref={textLayerRef} 
            className="textLayer absolute inset-0 z-10 opacity-35 select-text pointer-events-auto" 
            style={{ mixBlendMode: 'multiply' }}
          />

          {/* highlights and markup layer */}
          <div className="absolute inset-0 z-20 pointer-events-none">
            {pageHighlights.map((hl) => {
              const isUnderline = hl.color.startsWith('underline:');
              const isStrikeout = hl.color.startsWith('strikeout:');
              const colorValue = (isUnderline || isStrikeout) ? hl.color.split(':')[1] : hl.color;

              return hl.rects.map((r, idx) => (
                <div
                  key={`${hl.id}-${idx}`}
                  className="absolute"
                  style={{
                    left: `${r.left}%`,
                    top: `${r.top}%`,
                    width: `${r.width}%`,
                    height: `${r.height}%`,
                    backgroundColor: (isUnderline || isStrikeout) ? 'transparent' : `${colorValue}35`,
                    borderBottom: isUnderline ? `2.5px solid ${colorValue}` : 'none',
                    backgroundImage: isStrikeout 
                      ? `linear-gradient(to bottom, transparent 48%, ${colorValue} 48%, ${colorValue} 52%, transparent 52%)`
                      : 'none',
                  }}
                  title={hl.notes || undefined}
                />
              ));
            })}
          </div>

          {/* Pencil freehand drawing layer */}
          <canvas
            ref={drawCanvasRef}
            className={`absolute inset-0 z-30 ${isPenActive ? 'cursor-crosshair pointer-events-auto' : 'pointer-events-none'}`}
            onMouseDown={handleDrawStart}
            onMouseMove={handleDrawMove}
            onMouseUp={handleDrawEnd}
            onTouchStart={handleDrawStart}
            onTouchMove={handleDrawMove}
            onTouchEnd={handleDrawEnd}
          />

          {rendering && (
            <div className="absolute top-2 right-2 bg-surface/85 backdrop-blur shadow border border-outline-variant p-1 rounded text-[8px] font-semibold text-on-surface-variant z-40">
              Rendering...
            </div>
          )}

          <div className="absolute bottom-2 right-4 text-[9px] font-bold text-on-surface-variant/40 select-none z-40">
            Page {pageNum}
          </div>
        </>
      )}
    </div>
  );
};

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
  const [zoomScale, setZoomScale] = useState(1.1);
  
  // UI Panels
  const [sidebarTab, setSidebarTab] = useState<'thumbnails' | 'search' | 'notes' | 'bookmarks'>('thumbnails');
  const [showSettings, setShowSettings] = useState(false);
  const [showThumbnailGrid, setShowThumbnailGrid] = useState(false);

  // Active toolbar parameters
  const [themeMode, setThemeMode] = useState<'light' | 'dark' | 'sepia'>('light');
  const [activeTool, setActiveTool] = useState<'pan' | 'pen'>('pan');
  const [activePenColor, setActivePenColor] = useState('#ff0000');
  const [activePenWidth, setActivePenWidth] = useState(3);

  // Interactive reader states
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([]);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [readingProgressId, setReadingProgressId] = useState<string | null>(null);
  const [drawingsMap, setDrawingsMap] = useState<Record<number, Stroke[]>>({});

  // Text selection highlight popup toolbar
  const [activeSelection, setActiveSelection] = useState<{
    text: string;
    rects: Array<{ left: number; top: number; width: number; height: number }>;
    position: { x: number; y: number };
    pageNum: number;
  } | null>(null);
  const [selectedHighlightColor, setSelectedHighlightColor] = useState('#fbbf24'); // Default Yellow
  const [noteInput, setNoteInput] = useState('');

  // Search PDF States
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [pdfTextCache, setPdfTextCache] = useState<Array<{ pageNum: number; text: string }>>([]);

  // Rendering loading indicator states
  const [pdfLoading, setPdfLoading] = useState(true);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [isCachedOffline, setIsCachedOffline] = useState(false);
  const [downloadPercent, setDownloadPercent] = useState<number | null>(null);

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  const colors = [
    { name: 'Yellow', hex: '#fbbf24' },
    { name: 'Green', hex: '#4ade80' },
    { name: 'Blue', hex: '#60a5fa' },
    { name: 'Pink', hex: '#f472b6' },
    { name: 'Red', hex: '#ef4444' },
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

  // 2. Fetch User Annotation States (bookmarks, highlights, reading progress, drawings)
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

        // Drawings
        const { data: drawData } = await supabase
          .from('drawings')
          .select('*')
          .eq('user_id', user.id)
          .eq('book_id', book.id);

        if (drawData) {
          const map: Record<number, Stroke[]> = {};
          drawData.forEach((row) => {
            map[row.page_number] = row.strokes;
          });
          setDrawingsMap(map);
        }

        // Reading Progress
        const { data: progressData } = await supabase
          .from('reading_progress')
          .select('*')
          .eq('user_id', user.id)
          .eq('book_id', book.id)
          .single();

        if (progressData) {
          setReadingProgressId(progressData.id);
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

  // Scroll to initialPage on document load
  useEffect(() => {
    if (pdfDoc && initialPage) {
      setTimeout(() => {
        scrollToPage(parseInt(initialPage));
      }, 500);
    }
  }, [pdfDoc, initialPage]);

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

  const scrollToPage = (pageNum: number) => {
    if (pageNum < 1 || pageNum > numPages) return;
    const el = document.getElementById(`page-slot-${pageNum}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

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
      scrollToPage(currentPage + 1);
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      scrollToPage(currentPage - 1);
    }
  };

  // Add highlight or markup to Supabase
  const handleSaveHighlight = async (type: 'highlight' | 'underline' | 'strikeout') => {
    if (!user || !book || !activeSelection) return;

    let finalColor = selectedHighlightColor;
    if (type === 'underline') {
      finalColor = `underline:${selectedHighlightColor}`;
    } else if (type === 'strikeout') {
      finalColor = `strikeout:${selectedHighlightColor}`;
    }

    try {
      const payload = {
        user_id: user.id,
        book_id: book.id,
        page_number: activeSelection.pageNum,
        rects: activeSelection.rects,
        text: activeSelection.text,
        color: finalColor,
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
    if (!confirm('Delete this annotation?')) return;

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

  // Save Pencil drawings to Database
  const handleSaveDrawing = async (pageNum: number, strokes: Stroke[]) => {
    if (!user || !book) return;

    try {
      setDrawingsMap((prev) => ({
        ...prev,
        [pageNum]: strokes
      }));

      await supabase
        .from('drawings')
        .upsert({
          user_id: user.id,
          book_id: book.id,
          page_number: pageNum,
          strokes: strokes,
          updated_at: new Date().toISOString()
        });
    } catch (err) {
      console.error('Failed to sync drawings:', err);
    }
  };

  const handleClearDrawing = async (pageNum: number) => {
    if (!confirm(`Clear all pencil drawings on page ${pageNum}?`)) return;
    await handleSaveDrawing(pageNum, []);
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
  const cachePdfText = async (doc: pdfjs.PDFDocumentProxy) => {
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

  // Search inside PDF cache
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

  return (
    <div className="fixed inset-0 z-50 h-screen w-screen flex flex-col bg-surface-variant/15 text-foreground overflow-hidden">
      
      {/* 1. TOP MAIN HEADER */}
      <header className="h-14 border-b border-outline-variant bg-surface px-4 flex items-center justify-between z-30 flex-shrink-0">
        
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

        {/* Action Toolbar */}
        <div className="flex items-center gap-2">
          
          {/* Zoom Buttons */}
          <div className="hidden md:flex items-center gap-1 border border-outline-variant/60 rounded-xl px-2 py-1 bg-surface-variant/10 text-xs">
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
            <div className="px-2 text-xs font-bold min-w-[60px] text-center select-none">
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

          {/* Thumbnail Grid Trigger */}
          <button
            onClick={() => setShowThumbnailGrid(true)}
            className="p-2.5 rounded-full border border-outline-variant hover:bg-surface-variant/40 text-on-surface-variant transition-all"
            title="Browse thumbnail grid"
          >
            <Grid size={18} />
          </button>

        </div>

      </header>

      {/* 2. DEDICATED XODO TOOLBAR (Pen/Pan tools, Theme picker) */}
      <div className="h-11 border-b border-outline-variant/60 bg-surface/95 px-4 flex items-center justify-between z-30 flex-shrink-0 text-xs">
        
        {/* Tool modes toggle */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveTool('pan')}
            className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-all border ${
              activeTool === 'pan' 
                ? 'bg-primary text-on-primary border-primary shadow-sm' 
                : 'hover:bg-surface-variant/30 border-outline-variant text-on-surface-variant'
            }`}
          >
            <Hand size={14} /> Pan / Select
          </button>
          
          <button
            onClick={() => setActiveTool('pen')}
            className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-all border ${
              activeTool === 'pen' 
                ? 'bg-primary text-on-primary border-primary shadow-sm' 
                : 'hover:bg-surface-variant/30 border-outline-variant text-on-surface-variant'
            }`}
          >
            <Pencil size={14} /> Pencil Draw
          </button>
        </div>

        {/* Pencil config customization */}
        {activeTool === 'pen' && (
          <div className="flex items-center gap-3 animate-fade-in border-l border-outline-variant/50 pl-3">
            
            {/* Stroke Colors */}
            <div className="flex items-center gap-1">
              {['#ef4444', '#3b82f6', '#10b981', '#fbbf24', '#000000'].map((color) => (
                <button
                  key={color}
                  onClick={() => setActivePenColor(color)}
                  className={`w-4 h-4 rounded-full border transition-transform ${
                    activePenColor === color ? 'scale-125 border-primary shadow-sm ring-1 ring-primary/20' : 'border-outline-variant/40 hover:scale-110'
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>

            {/* Stroke Widths */}
            <div className="flex items-center gap-1.5 text-[10px]">
              <span className="font-semibold text-on-surface-variant">Size:</span>
              {[2, 4, 6].map((width) => (
                <button
                  key={width}
                  onClick={() => setActivePenWidth(width)}
                  className={`px-2 py-0.5 rounded border font-bold ${
                    activePenWidth === width ? 'bg-primary/10 text-primary border-primary/20' : 'border-outline-variant/40 hover:bg-surface-variant/20'
                  }`}
                >
                  {width}px
                </button>
              ))}
            </div>

            {/* Eraser button for current page */}
            <button
              onClick={() => handleClearDrawing(currentPage)}
              className="p-1 hover:bg-red-500/10 text-red-500 rounded-lg border border-red-500/20 hover:border-red-500/35 transition-all flex items-center gap-1 text-[10px] font-bold"
              title="Clear draws on page"
            >
              <Eraser size={12} /> Clear Page
            </button>

          </div>
        )}

        {/* Reader Theme switcher selector */}
        <div className="flex items-center gap-1 border border-outline-variant/60 rounded-xl p-0.5 bg-surface-variant/10">
          <button
            onClick={() => setThemeMode('light')}
            className={`p-1.5 rounded-lg transition-all ${
              themeMode === 'light' ? 'bg-surface text-primary shadow-sm' : 'text-on-surface-variant hover:bg-surface-variant/25'
            }`}
            title="Light Theme"
          >
            <Sun size={13} />
          </button>
          
          <button
            onClick={() => setThemeMode('sepia')}
            className={`px-2 py-0.5 text-[9px] rounded-lg transition-all font-bold ${
              themeMode === 'sepia' ? 'bg-[#f4ebd0] text-[#5b4636] shadow-sm border border-[#d6c7a1]' : 'text-on-surface-variant hover:bg-surface-variant/25'
            }`}
            title="Sepia Comfort Theme"
          >
            Sepia
          </button>

          <button
            onClick={() => setThemeMode('dark')}
            className={`p-1.5 rounded-lg transition-all ${
              themeMode === 'dark' ? 'bg-zinc-800 text-yellow-400 shadow-sm' : 'text-on-surface-variant hover:bg-surface-variant/25'
            }`}
            title="Night Mode"
          >
            <Moon size={13} />
          </button>
        </div>

      </div>

      {/* 3. MAIN WORKSPACE: SIDEBAR + SCROLL VIEWPORT */}
      <div className="flex-1 flex min-h-0 relative">
        
        {/* SIDEBAR NAVIGATION UTILITY */}
        <aside className="w-72 border-r border-outline-variant bg-surface flex flex-col z-20 min-h-0 hidden lg:flex flex-shrink-0">
          
          <div className="flex border-b border-outline-variant bg-surface-variant/10 text-[10px] font-bold select-none">
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

          <div className="flex-1 overflow-y-auto p-4 min-h-0">
            
            {sidebarTab === 'thumbnails' && (
              <div className="grid grid-cols-2 gap-3">
                {Array.from({ length: numPages }).map((_, idx) => {
                  const pNum = idx + 1;
                  const isCurrent = currentPage === pNum;
                  return (
                    <button
                      key={pNum}
                      onClick={() => {
                        scrollToPage(pNum);
                        syncReadingProgress(pNum);
                      }}
                      className={`flex flex-col items-center p-2 rounded-2xl border text-center transition-all ${
                        isCurrent 
                          ? 'border-primary bg-primary/5 text-primary font-bold shadow-sm' 
                          : 'border-outline-variant/60 hover:border-primary/40 hover:bg-surface-variant/10 text-on-surface-variant'
                      }`}
                    >
                      <div className="w-full aspect-[3/4] bg-surface-variant/20 rounded-xl flex items-center justify-center mb-1.5 shadow-inner select-none">
                        <BookOpen size={24} className="opacity-15" />
                      </div>
                      <span className="text-[10px]">Page {pNum}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {sidebarTab === 'search' && (
              <div className="space-y-4">
                <form onSubmit={handleSearchPdf} className="flex gap-2">
                  <input 
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search inside PDF..."
                    className="flex-1 px-3 py-1.5 border border-outline-variant rounded-xl text-xs bg-surface-variant/20 text-foreground focus:outline-none"
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
                          scrollToPage(res.pageNum);
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
                    <p className="text-[10px] text-on-surface-variant text-center mt-4 font-semibold">No matches found.</p>
                  ) : (
                    <p className="text-[10px] text-on-surface-variant text-center mt-4">Type query to search PDF contents.</p>
                  )}
                </div>
              </div>
            )}

            {sidebarTab === 'notes' && (
              <div className="space-y-3">
                {highlights.map((hl) => {
                  const isUnderline = hl.color.startsWith('underline:');
                  const isStrikeout = hl.color.startsWith('strikeout:');
                  const cleanColor = (isUnderline || isStrikeout) ? hl.color.split(':')[1] : hl.color;

                  return (
                    <div
                      key={hl.id}
                      onClick={() => {
                        scrollToPage(hl.page_number);
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
                        className={`pl-2 border-l-2 italic text-[10px] text-on-surface mb-2 truncate ${isStrikeout ? 'line-through' : ''}`}
                        style={{ borderLeftColor: cleanColor }}
                      >
                        &ldquo;{hl.text}&rdquo;
                      </div>
                      {isUnderline && <span className="text-[8px] font-bold text-on-surface-variant block mb-1">Underline Markup</span>}
                      {isStrikeout && <span className="text-[8px] font-bold text-on-surface-variant block mb-1">Strikeout Markup</span>}
                      {hl.notes && (
                        <p className="bg-surface p-1.5 rounded-lg text-[9px] font-semibold border border-outline-variant/30 text-on-surface-variant leading-relaxed">
                          {hl.notes}
                        </p>
                      )}
                    </div>
                  );
                })}
                {highlights.length === 0 && (
                  <p className="text-[10px] text-on-surface-variant text-center mt-4">Select text on pages to highlight.</p>
                )}
              </div>
            )}

            {sidebarTab === 'bookmarks' && (
              <div className="space-y-2">
                {bookmarks.map((bm) => (
                  <div
                    key={bm.id}
                    onClick={() => {
                      scrollToPage(bm.page_number);
                      syncReadingProgress(bm.page_number);
                    }}
                    className="p-3 rounded-2xl border border-outline-variant hover:border-primary/30 transition bg-surface-variant/10 text-xs flex justify-between items-center cursor-pointer"
                  >
                    <div>
                      <span className="font-extrabold text-foreground block">Page {bm.page_number}</span>
                      <span className="text-[9px] text-on-surface-variant font-semibold block">{bm.label || 'User Bookmark'}</span>
                    </div>
                    <BookmarkCheck size={16} className="text-primary" />
                  </div>
                ))}
                {bookmarks.length === 0 && (
                  <p className="text-[10px] text-on-surface-variant text-center mt-4">Bookmark pages to show index list.</p>
                )}
              </div>
            )}

          </div>

        </aside>

        {/* DYNAMIC SCROLL CONTAINER: RENDERING ALL PAGES CONTINUOUSLY */}
        <div 
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto p-6 space-y-8 relative bg-surface-variant/15 flex flex-col select-text"
          onScroll={() => {
            if (!scrollContainerRef.current || !pdfDoc) return;
            const container = scrollContainerRef.current;
            const children = Array.from(container.children);
            
            // Find page that has highest intersection visibility
            let maxVisiblePage = 1;
            let maxVisibleHeight = 0;
            const containerTop = container.getBoundingClientRect().top;
            const containerHeight = container.clientHeight;

            children.forEach((child) => {
              const pageNumAttr = child.getAttribute('id');
              if (pageNumAttr && pageNumAttr.startsWith('page-slot-')) {
                const pNum = parseInt(pageNumAttr.split('-')[2]);
                const rect = child.getBoundingClientRect();
                
                // Calculate visible overlap
                const visibleTop = Math.max(rect.top, containerTop);
                const visibleBottom = Math.min(rect.bottom, containerTop + containerHeight);
                const overlap = Math.max(0, visibleBottom - visibleTop);
                
                if (overlap > maxVisibleHeight) {
                  maxVisibleHeight = overlap;
                  maxVisiblePage = pNum;
                }
              }
            });

            if (maxVisiblePage !== currentPage) {
              setCurrentPage(maxVisiblePage);
              syncReadingProgress(maxVisiblePage);
            }
          }}
        >
          {pdfDoc && Array.from({ length: numPages }).map((_, idx) => {
            const pNum = idx + 1;
            return (
              <PageSlot
                key={pNum}
                pageNum={pNum}
                pdfDoc={pdfDoc}
                zoomScale={zoomScale}
                theme={themeMode}
                isPenActive={activeTool === 'pen'}
                penColor={activePenColor}
                penWidth={activePenWidth}
                pageHighlights={highlights.filter(h => h.page_number === pNum)}
                pageDrawings={drawingsMap[pNum] || []}
                onSaveDrawing={handleSaveDrawing}
                onPageIntersect={(pageNum) => {
                  if (pageNum !== currentPage) {
                    setCurrentPage(pageNum);
                    syncReadingProgress(pageNum);
                  }
                }}
                onTextSelected={(rects, text, pos, pageNum) => {
                  setActiveSelection({
                    rects,
                    text,
                    position: {
                      x: pos.x,
                      y: pos.y + (document.getElementById(`page-slot-${pageNum}`)?.offsetTop || 0)
                    },
                    pageNum
                  });
                }}
              />
            );
          })}
        </div>

      </div>

      {/* 4. TEXT MARKUP / SELECTION POPUP TOOLBAR */}
      {activeSelection && (
        <div 
          className="absolute z-40 bg-surface border border-outline shadow-xl rounded-2xl p-2.5 flex flex-col gap-2.5 animate-fade-in max-w-[280px]"
          style={{ 
            left: `${activeSelection.position.x}px`, 
            top: `${activeSelection.position.y - 120}px` // Lift tooltip up to fit additions
          }}
          onMouseDown={(e) => e.stopPropagation()} // Prevent selection resets
        >
          {/* Colors palette dots */}
          <div className="flex justify-between items-center gap-1.5">
            <span className="text-[9px] font-bold uppercase text-on-surface-variant">Color:</span>
            <div className="flex gap-1">
              {colors.map((c) => (
                <button
                  key={c.name}
                  onClick={() => setSelectedHighlightColor(c.hex)}
                  className={`w-4 h-4 rounded-full border cursor-pointer transition-transform ${
                    selectedHighlightColor === c.hex ? 'scale-125 border-primary shadow-sm' : 'border-outline-variant/60'
                  }`}
                  style={{ backgroundColor: c.hex }}
                />
              ))}
            </div>
            <button 
              onClick={() => setActiveSelection(null)}
              className="text-on-surface-variant hover:text-foreground p-0.5 rounded-full hover:bg-surface-variant/30"
            >
              <X size={12} />
            </button>
          </div>

          {/* Action markup modes row */}
          <div className="flex gap-1 bg-surface-variant/20 rounded-xl p-0.5">
            <button
              onClick={() => handleSaveHighlight('highlight')}
              className="flex-1 py-1 text-[10px] font-bold hover:bg-surface hover:text-primary rounded-lg transition-all border border-transparent shadow-sm flex items-center justify-center gap-0.5 text-on-surface-variant"
            >
              <Highlighter size={10} /> Highlight
            </button>
            <button
              onClick={() => handleSaveHighlight('underline')}
              className="flex-1 py-1 text-[10px] font-bold hover:bg-surface hover:text-primary rounded-lg transition-all border border-transparent shadow-sm flex items-center justify-center gap-0.5 text-on-surface-variant"
            >
              <span className="underline decoration-2">U</span> Underline
            </button>
            <button
              onClick={() => handleSaveHighlight('strikeout')}
              className="flex-1 py-1 text-[10px] font-bold hover:bg-surface hover:text-primary rounded-lg transition-all border border-transparent shadow-sm flex items-center justify-center gap-0.5 text-on-surface-variant"
            >
              <span className="line-through decoration-2">S</span> Strikeout
            </button>
          </div>

          {/* Note Input area */}
          <div className="space-y-1 bg-surface-variant/10 p-1.5 rounded-xl border border-outline-variant/40">
            <label className="text-[8px] font-bold uppercase text-on-surface-variant flex items-center gap-0.5">
              <StickyNote size={8} /> Annotation Notes:
            </label>
            <input
              type="text"
              placeholder="Add thoughts/reminders..."
              value={noteInput}
              onChange={(e) => setNoteInput(e.target.value)}
              className="block w-full px-2 py-1 text-[10px] border border-outline-variant bg-surface text-foreground rounded-lg focus:outline-none"
            />
          </div>

        </div>
      )}

      {/* 5. FULL SCREEN THUMBNAIL GRID OVERLAY */}
      {showThumbnailGrid && (
        <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-md p-6 overflow-y-auto animate-fade-in flex flex-col">
          <div className="flex justify-between items-center mb-6 max-w-7xl mx-auto w-full">
            <div>
              <h2 className="text-xl font-black text-foreground flex items-center gap-1.5">
                <Grid className="text-primary" /> Visual Pages Index
              </h2>
              <p className="text-xs text-on-surface-variant font-medium mt-0.5">Click any thumbnail preview to jump to the text page</p>
            </div>
            <button 
              onClick={() => setShowThumbnailGrid(false)}
              className="p-2 bg-surface hover:bg-surface-variant/40 rounded-full border border-outline-variant/50 text-on-surface-variant hover:text-foreground transition-all shadow-sm"
              title="Close index"
            >
              <X size={20} />
            </button>
          </div>
          
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4 max-w-7xl mx-auto w-full pb-12">
            {Array.from({ length: numPages }).map((_, idx) => {
              const pNum = idx + 1;
              return (
                <button
                  key={pNum}
                  onClick={() => {
                    scrollToPage(pNum);
                    setShowThumbnailGrid(false);
                  }}
                  className={`p-2 border rounded-2xl bg-surface hover:border-primary hover:scale-[1.02] shadow-sm transition-all text-center group flex flex-col items-center ${
                    currentPage === pNum ? 'border-primary ring-2 ring-primary/20' : 'border-outline-variant/60'
                  }`}
                >
                  <div className="w-full aspect-[3/4] bg-surface-variant/20 rounded-xl flex items-center justify-center mb-2 text-xs opacity-50 shadow-inner select-none group-hover:bg-primary/5 transition-colors">
                    <BookOpen size={20} className="opacity-15" />
                  </div>
                  <span className="text-[10px] font-bold text-foreground">Page {pNum}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
}
