import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'lichtraum zürich — atlas',
  description: 'Walk together through Zürich. Photograph light and reflections, share a light atlas, and exchange ideas in Working notes.',
  icons: { icon: '/favicon.svg', apple: '/apple-touch-icon.png' },
  appleWebApp: { capable: true, title: 'lichtraum', statusBarStyle: 'default' },
};

// viewport-fit=cover lets the walk screen reach under the notch and home bar (padded with safe-area insets).
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#f5f3ed' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en" suppressHydrationWarning><body>{children}</body></html>;
}
