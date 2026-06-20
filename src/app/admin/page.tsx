'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/AuthProvider';
import { supabase } from '@/lib/supabase';
import { 
  ShieldAlert, 
  Upload, 
  Trash2, 
  BookOpen, 
  Check, 
  Plus, 
  Loader2, 
  FileText, 
  Image as ImageIcon 
} from 'lucide-react';

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

export default function AdminPage() {
  const { user, profile, isAdmin, loading } = useAuth();
  const router = useRouter();

  const [books, setBooks] = useState<Book[]>([]);
  const [dbLoading, setDbLoading] = useState(true);

  // Form States
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [classNum, setClassNum] = useState(1);
  const [subjectList, setSubjectList] = useState(SUBJECTS);
  const [subject, setSubject] = useState(SUBJECTS[0]);
  const [newSubjectInput, setNewSubjectInput] = useState('');
  const [showAddSubject, setShowAddSubject] = useState(false);
  const [isPremiumToggle, setIsPremiumToggle] = useState(false);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);

  const [actionLoading, setActionLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Guard
  useEffect(() => {
    if (!loading && (!user || !isAdmin)) {
      router.replace('/');
    }
  }, [user, isAdmin, loading, router]);

  const fetchBooks = async () => {
    try {
      setDbLoading(true);
      const { data, error } = await supabase
        .from('books')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching admin books:', error);
      } else if (data) {
        setBooks(data as Book[]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setDbLoading(false);
    }
  };

  useEffect(() => {
    if (user && isAdmin) {
      fetchBooks();
    }
  }, [user, isAdmin]);

  const handleUploadFile = async (file: File, folder: string): Promise<string> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${folder}/${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
    
    const { data, error } = await supabase.storage
      .from('books')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      throw error;
    }

    // Get Public URL
    const { data: { publicUrl } } = supabase.storage
      .from('books')
      .getPublicUrl(fileName);

    return publicUrl;
  };

  const handleAddBook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !pdfFile) {
      setFeedback({ type: 'error', text: 'Title and PDF File are required.' });
      return;
    }

    setActionLoading(true);
    setFeedback(null);

    try {
      // 1. Upload PDF
      const pdfUrl = await handleUploadFile(pdfFile, 'pdfs');

      // 2. Upload Thumbnail (Optional)
      let thumbnailUrl = null;
      if (imageFile) {
        thumbnailUrl = await handleUploadFile(imageFile, 'thumbnails');
      }

      // 3. Insert Book Record into Database
      const { error } = await supabase
        .from('books')
        .insert({
          title,
          author: author || 'Tamilnadu Textbook Board',
          class: classNum,
          subject,
          pdf_url: pdfUrl,
          thumbnail_url: thumbnailUrl,
          is_premium: isPremiumToggle
        });

      if (error) {
        setFeedback({ type: 'error', text: error.message });
      } else {
        setFeedback({ type: 'success', text: 'Book uploaded and listed successfully!' });
        // Reset form
        setTitle('');
        setAuthor('');
        setClassNum(1);
        setSubject(SUBJECTS[0]);
        setIsPremiumToggle(false);
        setPdfFile(null);
        setImageFile(null);
        // Refresh catalog
        await fetchBooks();
      }
    } catch (err: unknown) {
      console.error(err);
      const errMsg = err instanceof Error ? err.message : 'Error uploading files to storage bucket.';
      setFeedback({ type: 'error', text: errMsg });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteBook = async (book: Book) => {
    if (!confirm(`Are you sure you want to delete ${book.title}?`)) return;

    setActionLoading(true);
    setFeedback(null);

    try {
      // 1. Delete from database (Cascade deletes bookmarks, highlights etc)
      const { error } = await supabase
        .from('books')
        .delete()
        .eq('id', book.id);

      if (error) {
        setFeedback({ type: 'error', text: error.message });
      } else {
        setFeedback({ type: 'success', text: 'Book deleted successfully!' });
        await fetchBooks();
      }
    } catch (err: unknown) {
      console.error(err);
      setFeedback({ type: 'error', text: 'Failed to delete book.' });
    } finally {
      setActionLoading(false);
    }
  };

  if (loading || !user || !isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
        <p className="text-sm font-semibold text-on-surface-variant">Checking administrative authorization credentials...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12 animate-fade-in">
      
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-extrabold text-foreground tracking-tight flex items-center gap-2">
          <ShieldAlert className="text-primary" /> Admin Board
        </h1>
        <p className="text-sm text-on-surface-variant font-medium mt-1">Upload new PDF curricula and moderate existing educational libraries</p>
      </div>

      {feedback && (
        <div className={`p-4 rounded-2xl text-xs font-semibold border ${
          feedback.type === 'success' 
            ? 'bg-primary-container/10 border-primary/20 text-primary' 
            : 'bg-error-container/10 border-error/20 text-error'
        }`}>
          {feedback.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* LEFT COLUMN: UPLOAD FORM */}
        <div className="bg-surface border border-outline-variant p-6 rounded-3xl shadow-sm h-fit">
          <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
            <Plus size={18} className="text-primary" /> Upload New Book
          </h2>

          <form onSubmit={handleAddBook} className="space-y-4">
            
            <div>
              <label className="text-[10px] font-bold text-on-surface-variant block mb-1">Book Title *</label>
              <input
                id="admin-book-title"
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. 10th Standard Mathematics"
                className="block w-full px-3 py-2 border border-outline-variant rounded-xl text-xs bg-surface-variant/25 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-on-surface-variant block mb-1">Author / Publisher</label>
              <input
                id="admin-book-author"
                type="text"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder="e.g. Tamilnadu Textbook Board"
                className="block w-full px-3 py-2 border border-outline-variant rounded-xl text-xs bg-surface-variant/25 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-bold text-on-surface-variant block mb-1">Class Standard *</label>
                <select
                  id="admin-book-class"
                  value={classNum}
                  onChange={(e) => setClassNum(Number(e.target.value))}
                  className="block w-full px-3 py-2 border border-outline-variant rounded-xl text-xs bg-surface-variant/25 text-foreground cursor-pointer focus:outline-none focus:ring-2"
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((cls) => (
                    <option key={cls} value={cls}>Class {cls}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-on-surface-variant block mb-1">Subject Category *</label>
                <div className="flex gap-2">
                  <select
                    id="admin-book-subject"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="flex-1 px-3 py-2 border border-outline-variant rounded-xl text-xs bg-surface-variant/25 text-foreground cursor-pointer focus:outline-none focus:ring-2 min-w-0"
                  >
                    {subjectList.map((sub) => (
                      <option key={sub} value={sub}>{sub}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setShowAddSubject(!showAddSubject)}
                    className="px-2.5 py-2 bg-primary/10 text-primary text-xs font-bold rounded-xl border border-primary/20 hover:bg-primary/20 transition-all flex-shrink-0"
                    title="Add dynamic subject"
                  >
                    <Plus size={16} />
                  </button>
                </div>

                {showAddSubject && (
                  <div className="flex gap-2 mt-2 animate-fade-in">
                    <input
                      type="text"
                      placeholder="Add new subject name..."
                      value={newSubjectInput}
                      onChange={(e) => setNewSubjectInput(e.target.value)}
                      className="flex-1 px-3 py-1.5 border border-outline-variant rounded-xl text-xs bg-surface-variant/20 text-foreground focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const trimmed = newSubjectInput.trim();
                        if (trimmed) {
                          if (!subjectList.some(s => s.toLowerCase() === trimmed.toLowerCase())) {
                            setSubjectList([...subjectList, trimmed]);
                          }
                          setSubject(trimmed);
                          setNewSubjectInput('');
                          setShowAddSubject(false);
                        }
                      }}
                      className="px-3 py-1.5 bg-primary text-on-primary text-xs font-bold rounded-xl hover:bg-primary/95 shadow-sm transition-all"
                    >
                      Add
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Premium toggle */}
            <div className="flex items-center justify-between p-3 bg-surface-variant/25 rounded-2xl border border-outline-variant/60">
              <div>
                <h3 className="font-bold text-xs text-foreground">Premium Book</h3>
                <p className="text-[9px] text-on-surface-variant">Requires subscription to access</p>
              </div>
              <input
                id="admin-book-premium-toggle"
                type="checkbox"
                checked={isPremiumToggle}
                onChange={(e) => setIsPremiumToggle(e.target.checked)}
                className="w-4 h-4 text-primary bg-surface border-outline-variant rounded focus:ring-primary cursor-pointer"
              />
            </div>

            {/* PDF file picker */}
            <div>
              <label className="text-[10px] font-bold text-on-surface-variant block mb-1">Upload PDF File *</label>
              <div className="border border-dashed border-outline-variant hover:border-primary rounded-2xl p-4 text-center cursor-pointer relative bg-surface-variant/10 group transition-all">
                <input
                  id="admin-book-pdf"
                  type="file"
                  accept=".pdf"
                  required
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setPdfFile(e.target.files[0]);
                    }
                  }}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
                <div className="space-y-1.5">
                  <FileText className="w-6 h-6 mx-auto text-on-surface-variant group-hover:text-primary transition-colors" />
                  <span className="text-[10px] text-foreground font-semibold block">
                    {pdfFile ? pdfFile.name : 'Select curriculum PDF'}
                  </span>
                  <span className="text-[8px] text-on-surface-variant block">PDF maximum 50MB</span>
                </div>
              </div>
            </div>

            {/* Cover image picker */}
            <div>
              <label className="text-[10px] font-bold text-on-surface-variant block mb-1">Cover Image (Optional)</label>
              <div className="border border-dashed border-outline-variant hover:border-primary rounded-2xl p-4 text-center cursor-pointer relative bg-surface-variant/10 group transition-all">
                <input
                  id="admin-book-thumbnail"
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setImageFile(e.target.files[0]);
                    }
                  }}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
                <div className="space-y-1.5">
                  <ImageIcon className="w-6 h-6 mx-auto text-on-surface-variant group-hover:text-primary transition-colors" />
                  <span className="text-[10px] text-foreground font-semibold block">
                    {imageFile ? imageFile.name : 'Select JPEG or PNG cover'}
                  </span>
                  <span className="text-[8px] text-on-surface-variant block">Image maximum 5MB</span>
                </div>
              </div>
            </div>

            <button
              id="submit-book-btn"
              type="submit"
              disabled={actionLoading}
              className="w-full py-2.5 bg-primary hover:bg-primary/95 text-on-primary font-bold text-xs rounded-2xl flex items-center justify-center gap-1.5 shadow-md disabled:opacity-50 transition-all"
            >
              {actionLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Uploading assets...
                </>
              ) : (
                <>
                  <Upload size={14} /> Submit New Book
                </>
              )}
            </button>

          </form>

        </div>

        {/* RIGHT COLUMN: BOOK MANAGER LIST */}
        <div className="bg-surface border border-outline-variant p-6 rounded-3xl shadow-sm lg:col-span-2">
          <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
            <BookOpen size={18} className="text-primary" /> Active Library Catalog
          </h2>

          {dbLoading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2 text-on-surface-variant">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <span className="text-xs font-semibold">Refreshing list...</span>
            </div>
          ) : books.length > 0 ? (
            <div className="overflow-x-auto rounded-2xl border border-outline-variant">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-variant/40 border-b border-outline-variant text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">
                    <th className="p-3">Standard</th>
                    <th className="p-3">Title</th>
                    <th className="p-3">Subject</th>
                    <th className="p-3">Premium</th>
                    <th className="p-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/40 text-xs">
                  {books.map((book) => (
                    <tr key={book.id} className="hover:bg-surface-variant/15 transition-colors">
                      <td className="p-3 font-semibold text-primary">Class {book.class}</td>
                      <td className="p-3 font-bold text-foreground truncate max-w-[150px] sm:max-w-[200px]" title={book.title}>
                        {book.title}
                      </td>
                      <td className="p-3 font-medium text-on-surface-variant">{book.subject}</td>
                      <td className="p-3">
                        {book.is_premium ? (
                          <span className="bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold px-2 py-0.5 rounded-full text-[9px] border border-amber-500/10">
                            Locked
                          </span>
                        ) : (
                          <span className="bg-green-500/10 text-green-600 dark:text-green-400 font-bold px-2 py-0.5 rounded-full text-[9px] border border-green-500/10">
                            Free
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => handleDeleteBook(book)}
                          disabled={actionLoading}
                          className="p-1.5 text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
                          title="Delete book"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-12 text-center text-on-surface-variant space-y-2 border border-dashed border-outline-variant rounded-2xl bg-surface-variant/5">
              <BookOpen size={36} className="mx-auto opacity-20" />
              <span className="text-xs font-semibold block">The library is currently empty.</span>
            </div>
          )}

        </div>

      </div>

    </div>
  );
}
