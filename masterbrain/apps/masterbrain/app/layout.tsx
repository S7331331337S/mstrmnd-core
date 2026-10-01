import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'MASTERBRAIN',
  description: 'The Council of Twelve as an operating system.',
};

export const viewport: Viewport = {
  themeColor: '#0B0B0F',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
