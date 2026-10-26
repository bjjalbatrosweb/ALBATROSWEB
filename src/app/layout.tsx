import type { Metadata, Viewport } from 'next'
import { publicSiteOrigin } from '@/lib/public-site'
import { Anton, Inter } from 'next/font/google'
import { Toaster } from "@/components/ui/toaster"
import { FirebaseClientProvider } from '@/firebase/client-provider'
import { PwaRegister } from '@/components/pwa-register'
import { ChunkRecovery } from '@/components/chunk-recovery'
import { ClientErrorReporter } from '@/components/client-error-reporter'
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

const siteOrigin = publicSiteOrigin();
export const metadata: Metadata = {
  ...(siteOrigin ? { metadataBase: new URL(siteOrigin) } : {}),
  openGraph: {title:'ALBATROS | Artes marciales en Mérida',description:'Jiu-Jitsu, Kick Boxing y MMA. Consulta nuestras sedes y reserva una clase de prueba gratis en MMA.',locale:'es_MX',type:'website',...(siteOrigin ? {images:[{url:`${siteOrigin}/Mibaner.webp`,width:1200,height:630,alt:'Academia Albatros'}]} : {})},
  twitter: {card:'summary_large_image',title:'ALBATROS | Artes marciales',description:'Disciplinas, horarios y clase de prueba en Albatros.',...(siteOrigin ? {images:[`${siteOrigin}/Mibaner.webp`]} : {})},
  title: 'ALBATROS | Centro de Alto Rendimiento',
  description: 'Jiu-Jitsu, Kick Boxing y MMA en Mérida. Consulta sedes, horarios y reserva tu primera clase gratis en MMA.',
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
      className={`${inter.variable} ${anton.variable} dark`}
      data-scroll-behavior="smooth"
      style={{ scrollBehavior: 'smooth' }}
    >
      <body className="bg-background font-body text-foreground antialiased">
        <FirebaseClientProvider>
          {children}
        </FirebaseClientProvider>
        <PwaRegister />
        <ChunkRecovery />
        <ClientErrorReporter />
        <Toaster />
      </body>
    </html>
  );
}
