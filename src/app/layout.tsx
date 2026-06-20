import type { Metadata } from 'next';
import { Outfit } from 'next/font/google';
import { ThemeProvider } from '@/components/providers/ThemeProvider';
import { AuthProvider } from '@/components/providers/AuthProvider';
import { LayoutContainer } from '@/components/navigation/LayoutContainer';
import { ServiceWorkerRegister } from '@/components/providers/ServiceWorkerRegister';
import './globals.css';

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-outfit',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Tamilnadu School Book | PWA Educational Portal',
  description:
    'Read, highlight, take notes, and track your study progress offline for all Tamilnadu State Board School Books (Classes 1-12). Sync instantly across devices.',
  manifest: '/manifest.json',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover',
  themeColor: '#6750A4',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'TN School Book',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={outfit.variable}>
      <head>
        <link rel="icon" href="/icons/icon-192.png" />
      </head>
      <body className="antialiased">
        <ThemeProvider>
          <AuthProvider>
            <LayoutContainer>
              {children}
            </LayoutContainer>
            <ServiceWorkerRegister />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
