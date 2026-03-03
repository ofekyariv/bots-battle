import type { Metadata, Viewport } from 'next';
import './globals.css';
import ClientProviders from '@/components/ClientProviders';
import Navbar from '@/components/nav/Navbar';

export const metadata: Metadata = {
  title: 'Bots Battle',
  description:
    'A web-based strategy coding game. Write JavaScript algorithms that control pirate ships. Your code IS your strategy.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen antialiased flex flex-col bg-navy text-white">
        {/* Skip-to-content link for keyboard/screen-reader users */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[9999] focus:px-4 focus:py-2 focus:rounded-lg focus:bg-gold focus:text-navy focus:font-bold focus:text-sm focus:outline-none focus:shadow-lg"
        >
          Skip to content
        </a>
        <ClientProviders>
          <Navbar />
          <main id="main-content" className="flex-1">
            {children}
          </main>
        </ClientProviders>
      </body>
    </html>
  );
}
