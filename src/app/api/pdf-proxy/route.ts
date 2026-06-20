import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const pdfUrl = searchParams.get('url');

  if (!pdfUrl) {
    return new NextResponse('Missing url parameter', { status: 400 });
  }

  try {
    const response = await fetch(pdfUrl);
    if (!response.ok) {
      return new NextResponse(`Failed to fetch PDF from source: ${response.statusText}`, { status: response.status });
    }

    const data = await response.arrayBuffer();
    
    return new NextResponse(data, {
      headers: {
        'Content-Type': 'application/pdf',
        'Cache-Control': 'public, max-age=31536000',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err: unknown) {
    console.error('PDF proxy error:', err);
    const msg = err instanceof Error ? err.message : String(err);
    return new NextResponse(`Internal Server Error: ${msg}`, { status: 500 });
  }
}
