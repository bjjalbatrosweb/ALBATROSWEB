import type { Metadata, Viewport } from 'next'
import { Anton, Inter } from 'next/font/google'
import { Toaster } from "@/components/ui/toaster"
import { FirebaseClientProvider } from '@/firebase/client-provider'
import { PwaRegister } from '@/components/pwa-register'
import { ChunkRecovery } from '@/components/chunk-recovery'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const anton = Anton({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-anton',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'ALBATROS | Centro de Alto Rendimiento',
  description: 'Entrenamiento, administración y rendimiento para atletas Albatros.',
  applicationName: 'Albatros',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Albatros',
  },
  icons: {
    icon: [
      { url: '/icon-192.png?v=albatros-logo-4', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png?v=albatros-logo-4', sizes: '512x512', type: 'image/png' },
    ],
    shortcut: '/icon-192.png?v=albatros-logo-4',
    apple: '/apple-touch-icon.png?v=albatros-logo-4',
  },
};

export const viewport: Viewport = {
  themeColor: '#08090d',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es-MX"
      className={`${inter.variable} ${anton.variable}`}
      data-scroll-behavior="smooth"
      style={{ scrollBehavior: 'smooth' }}
    >
      <body className="font-body antialiased">
        <FirebaseClientProvider>
          {children}
        </FirebaseClientProvider>
        <PwaRegister />
        <ChunkRecovery />
        <Toaster />
      </body>
    </html>
  );
}
