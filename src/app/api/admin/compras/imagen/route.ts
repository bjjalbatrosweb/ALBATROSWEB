import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import { requirePanelActorAccess, RequestAccessError } from '@/lib/server-access';
import type { Sede } from '@/lib/access-control';
export const runtime = 'nodejs';
export async function POST(request: Request) {
 try {
  const body = await request.json();
  const sede = String(body.sede || '') as Sede;
  if (!['MMA','CAUCEL','JUAN_PABLO'].includes(sede)) throw new RequestAccessError('Sede inválida.',400);
  const actor = await requirePanelActorAccess(request,sede);
  const id = String(body.productoId || '');
  const raw = typeof body.imagen === 'string' ? body.imagen : '';
  if (!/^[a-zA-Z0-9_-]{2,64}$/.test(id) || !raw.startsWith('data:image/jpeg;base64,') || raw.length > 250000) throw new RequestAccessError('La imagen debe ser JPEG de hasta 180 KB.',400);
  const data = Buffer.from(raw.slice(23),'base64');
  if (data.length > 184320 || data.length < 4 || data[0] !== 255 || data[1] !== 216 || data[2] !== 255) throw new RequestAccessError('Imagen JPEG inválida.',400);
  await adminDb.collection('FotosProductos').doc(`${sede}_${id}`).set({ imagen: raw, sede, productoId:id, actualizadoPor:actor.uid, actualizadaEn:FieldValue.serverTimestamp() });
  return NextResponse.json({ok:true,imagen:`/api/tienda/imagen?sede=${sede}&productoId=${id}&v=${Date.now()}`});
 } catch(error) {
  return NextResponse.json({ok:false,mensaje:error instanceof RequestAccessError ? error.message : 'No se pudo subir la imagen.'},{status:error instanceof RequestAccessError ? error.status : 500});
 }
}
