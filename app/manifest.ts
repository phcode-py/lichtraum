import type { MetadataRoute } from 'next';

// Lets the site be added to the iPhone Home Screen and open full-screen, like an app.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'lichtraum zürich',
    short_name: 'lichtraum',
    description: 'Walk together. Notice the light. Keep what reflects.',
    start_url: '/',
    display: 'standalone',
    background_color: '#f5f3ed',
    theme_color: '#f5f3ed',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  };
}
