import { publicSiteOrigin } from '@/lib/public-site';
export function GET(request: Request) {
 const origin=publicSiteOrigin(new URL(request.url).origin);
 return new Response(`User-agent: *\nAllow: /\nDisallow: /admin/\nDisallow: /api/\nDisallow: /login\nDisallow: /signup\nDisallow: /perfil\nDisallow: /emergencia/\nDisallow: /solicitud-pago/\nDisallow: /pase-invitado/\nDisallow: /ipad\nSitemap: ${origin}/sitemap.xml\n`,{headers:{'Content-Type':'text/plain','Cache-Control':'public, max-age=3600'}});
}
