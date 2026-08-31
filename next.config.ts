import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Genkit y OpenTelemetry son dependencias exclusivamente de servidor.
  // Externalizarlas evita incluir su carga dinámica en los bundles de rutas.
  serverExternalPackages: [
    'genkit',
    '@genkit-ai/core',
    '@opentelemetry/instrumentation',
    '@opentelemetry/sdk-node',
  ],
  // Autoriza la URL pública del Preview de Firebase Studio durante el desarrollo.
  allowedDevOrigins: [
    '9000-firebase-studio-1773681397639.cluster-lr6dwlc2lzbcctqhqorax5zmro.cloudworkstations.dev',
    '9010-firebase-studio-1773681397639.cluster-lr6dwlc2lzbcctqhqorax5zmro.cloudworkstations.dev',
    '9002-firebase-studio-1773681397639.cluster-lr6dwlc2lzbcctqhqorax5zmro.cloudworkstations.dev',
  ],
  // Evita que otro package-lock.json del perfil de Windows haga que Next
  // trace archivos fuera del proyecto durante App Hosting.
  outputFileTracingRoot: process.cwd(),
  async headers() {
    const frameAncestors = process.env.NODE_ENV === 'development'
      ? [
          "frame-ancestors 'self'",
          'https://monospace.corp.google.com',
          'https://monospace-dev.corp.google.com',
          'https://monospace-staging.corp.google.com',
          'https://monospace-autopush.corp.google.com',
          'https://msm.sandbox.google.com',
          'https://monospace.sandbox.google.com',
          'https://monospace.google.com',
          'https://idx.google.com',
          'https://idx.sandbox.google.com',
          'https://*.firebase.google.com',
          'https://*.sslproxy.corp.google.com',
          'https://*.vscode-cdn.net',
          'https://localhost.corp.google.com:10443',
          'https://*.cloudworkstations.googleusercontent.com',
          'https://firebase-studio-1773681397639.cluster-lr6dwlc2lzbcctqhqorax5zmro.cloudworkstations.dev',
          'https://80-firebase-studio-1773681397639.cluster-lr6dwlc2lzbcctqhqorax5zmro.cloudworkstations.dev',
          'https://8090-firebase-studio-1773681397639.cluster-lr6dwlc2lzbcctqhqorax5zmro.cloudworkstations.dev',
        ].join(' ')
      : "frame-ancestors 'none'";
    const contentSecurityPolicy = [
      "default-src 'self'",
      "base-uri 'self'",
      frameAncestors,
      "form-action 'self'",
      "object-src 'none'",
      "script-src 'self' 'unsafe-inline' https://www.gstatic.com https://apis.google.com https://accounts.google.com https://www.youtube.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      "img-src 'self' data: blob: https:",
      "connect-src 'self' https://accounts.google.com https://*.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com",
      "media-src 'self' blob: https://firebasestorage.googleapis.com",
      "frame-src 'self' https://www.google.com https://www.youtube.com https://www.youtube-nocookie.com https://accounts.google.com",
      "worker-src 'self' blob:",
      "manifest-src 'self'",
      "upgrade-insecure-requests",
    ].join('; ');
    return [
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
      {
        source: '/admin/:path*',
        headers: [
          { key: 'Cache-Control', value: 'private, no-cache, no-store, must-revalidate' },
        ],
      },
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-DNS-Prefetch-Control', value: 'off' },
          { key: 'Content-Security-Policy', value: contentSecurityPolicy },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
          {
            key: 'Permissions-Policy',
            // Replay técnico, multimedia y mapa usan estos permisos únicamente
            // desde la propia aplicación; terceros continúan bloqueados.
            value: 'camera=(self), microphone=(self), geolocation=(self)',
          },
        ],
      },
    ];
  },
  images: {
    qualities: [72, 75],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
      },
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
      },
      {
        protocol: 'https',
        hostname: 'i.ytimg.com',
      },
    ],
  },
};

export default nextConfig;
