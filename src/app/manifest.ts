import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'ALBATROS Centro de Alto Rendimiento',
    short_name: 'ALBATROS',
    description:
      'Entrenamiento, administración y rendimiento para atletas Albatros.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    background_color: '#08090d',
    theme_color: '#08090d',
    categories: ['sports', 'fitness', 'business'],
    lang: 'es-MX',
    icons: [
      {
        src: '/milogo.png',
        sizes: 'any',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/milogo.png',
        sizes: 'any',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
