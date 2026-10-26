import { PUBLIC_ACADEMY_SITES, publicSiteOrigin } from '@/lib/public-site';
export function GET(request: Request) {
 const origin=publicSiteOrigin(new URL(request.url).origin)!;
 const paths=['/','/clase-prueba','/reglas',...PUBLIC_ACADEMY_SITES.map(site=>`/sedes/${site.slug}`)];
 const escape=(value:string)=>value.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
 return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${paths.map(path=>`<url><loc>${escape(origin+path)}</loc></url>`).join('')}</urlset>`,{headers:{'Content-Type':'application/xml','Cache-Control':'public, max-age=3600'}});
}
