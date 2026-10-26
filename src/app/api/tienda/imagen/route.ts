import { adminDb } from '@/lib/firebase-admin';
export const runtime = 'nodejs';
export async function GET(request: Request) {
 const params = new URL(request.url).searchParams;
 const sede = params.get('sede') || '', id = params.get('productoId') || '';
 if (!['MMA','CAUCEL','JUAN_PABLO'].includes(sede) || !/^[a-zA-Z0-9_-]{2,64}$/.test(id)) return new Response(null,{status:404});
 try {
  const doc = await adminDb.collection('FotosProductos').doc(`${sede}_${id}`).get();
  const image = doc.data()?.imagen;
  if (typeof image !== 'string' || !image.startsWith('data:image/jpeg;base64,')) return new Response(null,{status:404});
  return new Response(Buffer.from(image.slice(23),'base64'),{headers:{'Content-Type':'image/jpeg','Cache-Control':'public, max-age=300, s-maxage=3600','X-Content-Type-Options':'nosniff'}});
 } catch { return new Response(null,{status:503}); }
}
