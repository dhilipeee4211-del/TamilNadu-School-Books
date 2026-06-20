import { createClient } from '@supabase/supabase-js';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

// Mock DOMMatrix for pdfjs-dist in Node environment
global.DOMMatrix = class DOMMatrix {
  constructor() {
    this.a = 1; this.b = 0; this.c = 0; this.d = 1; this.e = 0; this.f = 0;
  }
};

const supabaseUrl = 'https://fvtewfryfnluqacmkrli.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ2dGV3ZnJ5Zm5sdXFhY21rcmxpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE5MzYyMzMsImV4cCI6MjA5NzUxMjIzM30.wKks-7Jk1I_eW_HojrKx54Ssi8fmrd819z2f0Yi-R9Y';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  try {
    const { data, error } = await supabase
      .from('books')
      .select('*')
      .eq('id', 'edef3364-0d5c-4a73-aad8-684bcb12d4b0')
      .single();

    if (error) throw error;
    console.log('Book title:', data.title);
    console.log('PDF URL:', data.pdf_url);

    console.log('Loading PDF...');
    const loadingTask = pdfjs.getDocument({
      url: data.pdf_url,
      disableFontFace: true
    });
    const doc = await loadingTask.promise;
    console.log('Number of pages:', doc.numPages);

    const page = await doc.getPage(1);
    const viewport = page.getViewport({ scale: 1.0 });
    console.log('Page 1 Viewport width:', viewport.width, 'height:', viewport.height);
    console.log('Aspect ratio (height / width):', viewport.height / viewport.width);
  } catch (err) {
    console.error('Error:', err);
  }
}

run();
