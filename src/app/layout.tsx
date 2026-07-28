import type { Metadata, Viewport } from 'next'
import { Toaster } from "@/components/ui/toaster"
import { FirebaseClientProvider } from '@/firebase/client-provider'
import { PwaRegister } from '@/components/pwa-register'
import './globals.css'

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
    icon: '/milogo.png',
    apple: '/milogo.png',
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
      data-scroll-behavior="smooth"
      style={{ scrollBehavior: 'smooth' }}
    >
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Anton&family=Inter:wght@400;700;900&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased">
        <FirebaseClientProvider>
          {children}
        </FirebaseClientProvider>
        <PwaRegister />
        <Toaster />
      </body>
    </html>
  );
}
