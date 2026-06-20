'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/AuthProvider';
import { supabase } from '@/lib/supabase';
import { StickyNote, BookOpen, Trash2, Edit3, Save, X, Loader2, ArrowRight } from 'lucide-react';

interface HighlightItem {
  id: string;
  page_number: number;
  text: string;
  color: string;
  notes: string | null;
  created_at: string;
  book: {
    id: string;
    title: string;
    class: number;
    subject: string;
    thumbnail_url: string | null;
  };
}

export default function NotesPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [highlights, setHighlights] = useState<HighlightItem[]>([]);
  const [dbLoading, setDbLoading] = useState(true);

  // Note Editing States
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editedNoteText, setEditedNoteText] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Guard
  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [user, loading, router]);

  const fetchHighlights = async () => {
    if (!user) return;
    try {
      setDbLoading(true);
      const { data, error } = await supabase
        .from('highlights')
        .select(`
          id,
          page_number,
          text,
          color,
          notes,
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
        console.error('Error fetching highlights:', error);
      } else if (data) {
        setHighlights(data as unknown as HighlightItem[]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setDbLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchHighlights();
    }
  }, [user]);

  const handleDeleteHighlight = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this highlight and note?')) return;

    try {
      const { error } = await supabase
        .from('highlights')
        .delete()
        .eq('id', id);

      if (error) {
        alert(error.message);
      } else {
        setHighlights(highlights.filter(h => h.id !== id));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const startEditNote = (item: HighlightItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(item.id);
    setEditedNoteText(item.notes || '');
  };

  const cancelEditNote = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(null);
    setEditedNoteText('');
  };

  const handleSaveNote = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setActionLoading(true);

    try {
      const { error } = await supabase
        .from('highlights')
        .update({ notes: editedNoteText })
        .eq('id', id);

      if (error) {
        alert(error.message);
      } else {
        setHighlights(highlights.map(h => h.id === id ? { ...h, notes: editedNoteText } : h));
        setEditingId(null);
        setEditedNoteText('');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
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
        <h1 className="text-3xl font-extrabold text-foreground tracking-tight">Notes &amp; Highlights</h1>
        <p className="text-sm text-on-surface-variant font-medium mt-1">Review text highlights and annotations across standard modules</p>
      </div>

      {dbLoading ? (
        <div className="flex flex-col items-center justify-center py-16 gap-2">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <span className="text-xs font-semibold text-on-surface-variant">Gathering notes catalog...</span>
        </div>
      ) : highlights.length > 0 ? (
        <div className="space-y-4">
          {highlights.map((item) => (
            <div 
              key={item.id}
              onClick={() => router.push(`/reader/${item.book.id}?page=${item.page_number}`)}
              className="bg-surface border border-outline-variant hover:border-primary/45 rounded-3xl p-5 shadow-sm relative overflow-hidden group cursor-pointer transition-all duration-300 flex flex-col md:flex-row gap-5 justify-between items-start"
            >
              
              {/* Highlight and note description */}
              <div className="space-y-3 flex-1 min-w-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-12 bg-primary/5 rounded-lg border border-outline-variant flex items-center justify-center text-primary font-bold overflow-hidden shadow-inner flex-shrink-0">
                    {item.book.thumbnail_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.book.thumbnail_url} alt="Cover" className="w-full h-full object-cover" />
                    ) : (
                      <BookOpen size={16} className="opacity-45" />
                    )}
                  </div>
                  <div>
                    <span className="text-[9px] font-bold uppercase bg-secondary-container text-on-secondary-container px-2 py-0.5 rounded-full block w-max">
                      Class {item.book.class} • {item.book.subject}
                    </span>
                    <h3 className="font-extrabold text-sm text-foreground truncate mt-1 group-hover:text-primary transition-colors">
                      {item.book.title}
                    </h3>
                  </div>
                </div>

                {/* Highlighted text snippet */}
                <div 
                  className="pl-3 border-l-4 rounded text-xs font-medium text-foreground py-1 bg-surface-variant/20 italic"
                  style={{ borderLeftColor: item.color }}
                >
                  &ldquo;{item.text}&rdquo;
                </div>

                {/* User Notes Annotation */}
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-on-surface-variant flex items-center gap-1">
                    <StickyNote size={12} /> Student Annotation:
                  </span>
                  {editingId === item.id ? (
                    <div className="flex gap-2 items-center mt-1 relative z-20" onClick={e => e.stopPropagation()}>
                      <input 
                        type="text"
                        value={editedNoteText}
                        onChange={(e) => setEditedNoteText(e.target.value)}
                        className="flex-1 px-3 py-1.5 border.5 border-outline rounded-xl text-xs bg-surface-variant/25 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                        placeholder="Write note here..."
                      />
                      <button 
                        onClick={(e) => handleSaveNote(item.id, e)}
                        disabled={actionLoading}
                        className="p-1.5 bg-green-500 text-white rounded-xl hover:bg-green-600 transition shadow-sm"
                      >
                        <Save size={14} />
                      </button>
                      <button 
                        onClick={cancelEditNote}
                        className="p-1.5 bg-outline-variant/40 text-foreground rounded-xl hover:bg-outline-variant/65 transition"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <p className="text-xs text-on-surface-variant bg-surface-variant/10 border border-outline-variant/30 p-2.5 rounded-2xl font-semibold">
                      {item.notes ? item.notes : <span className="text-on-surface-variant/45 italic font-medium">No note text added yet.</span>}
                    </p>
                  )}
                </div>
              </div>

              {/* Action column */}
              <div className="flex flex-row md:flex-col justify-end gap-2 w-full md:w-auto relative z-20" onClick={e => e.stopPropagation()}>
                <div className="flex gap-1">
                  <button
                    onClick={(e) => startEditNote(item, e)}
                    className="p-2 text-on-surface-variant hover:text-primary hover:bg-primary/10 rounded-xl transition-all"
                    title="Edit annotation"
                  >
                    <Edit3 size={16} />
                  </button>
                  <button
                    onClick={(e) => handleDeleteHighlight(item.id, e)}
                    className="p-2 text-on-surface-variant hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
                    title="Delete highlight"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                <button
                  onClick={() => router.push(`/reader/${item.book.id}?page=${item.page_number}`)}
                  className="ml-auto md:ml-0 flex items-center gap-1 px-3 py-1.5 rounded-xl bg-primary-container text-on-primary-container font-bold text-[10px] hover:bg-primary-container/85"
                >
                  Jump to Page {item.page_number} <ArrowRight size={10} />
                </button>
              </div>

            </div>
          ))}
        </div>
      ) : (
        <div className="bg-surface border border-outline-variant p-12 text-center rounded-3xl">
          <StickyNote size={48} className="mx-auto opacity-20 text-primary mb-3" />
          <h3 className="font-bold text-foreground text-md">No highlights or notes</h3>
          <p className="text-xs text-on-surface-variant mt-1">Open school texts, select sentences to highlight, and add your study notes.</p>
        </div>
      )}

    </div>
  );
}
