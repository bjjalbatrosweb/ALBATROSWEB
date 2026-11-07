import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import { requirePanelActorAccess, RequestAccessError } from '@/lib/server-access';
import { TRIAL_CLASS_SITE } from '@/lib/trial-class-request';
import { normalizeAvailability } from '@/lib/trial-availability';
const configRef=()=>adminDb.collection('DisponibilidadClasePrueba').doc(TRIAL_CLASS_SITE);
function fail(error:unknown){return NextResponse.json({ok:false,mensaje:error instanceof RequestAccessError?error.message:'No se pudo realizar la operación.'},{status:error instanceof RequestAccessError?error.status:500});}
export async function GET(request:Request){try{await requirePanelActorAccess(request,TRIAL_CLASS_SITE);const snapshot=await configRef().get();return NextResponse.json({ok:true,...normalizeAvailability(snapshot.data())},{headers:{'Cache-Control':'no-store'}});}catch(error){return fail(error);}}
export async function PATCH(request:Request){try{
 const actor=await requirePanelActorAccess(request,TRIAL_CLASS_SITE),body=await request.json();
 if(!Array.isArray(body.fechas)||body.fechas.length>1000||!Array.isArray(body.diasSemana)||body.diasSemana.length>7)throw new RequestAccessError('Calendario inválido.',400);
 const config=normalizeAvailability(body);
 if(config.fechas.length!==new Set(body.fechas).size || config.diasSemana.length!==new Set(body.diasSemana).size || config.fechas.some(day=>!Number.isFinite(Date.parse(day+'T12:00:00Z')) || new Date(day+'T12:00:00Z').toISOString().slice(0,10)!==day))throw new RequestAccessError('Fechas o días inválidos.',400);
 await configRef().set({...config,actualizadoPor:actor.uid,actualizadoEn:FieldValue.serverTimestamp()});
 return NextResponse.json({ok:true,...config});
 }catch(error){return fail(error);}}
export async function DELETE(request:Request){try{
 const params=new URL(request.url).searchParams;const site=params.get('sede')||TRIAL_CLASS_SITE;
 if(!['MMA','CAUCEL','JUAN_PABLO'].includes(site))throw new RequestAccessError('Sede inválida.',400);
 const actor=await requirePanelActorAccess(request,site as import('@/lib/access-control').Sede);const id=params.get('id')||'';
 if(actor.profile.rol!=="admin")throw new RequestAccessError('Solo un administrador puede eliminar solicitudes.',403);
 if(!/^[A-Za-z0-9_-]{1,160}$/.test(id))throw new RequestAccessError('Solicitud inválida.',400);
 await adminDb.runTransaction(async tx=>{
  const ref=adminDb.collection('SolicitudesClasePrueba').doc(id),pass=adminDb.collection('PasesInvitados').doc('trial_'+id);
  const [snapshot,guestPass]=await Promise.all([tx.get(ref),tx.get(pass)]);
  if(!snapshot.exists)throw new RequestAccessError('La solicitud ya no existe.',404);
  if(snapshot.data()?.sede!==site)throw new RequestAccessError('No puedes eliminar solicitudes de esta sede.',403);
  if(guestPass.exists)tx.update(pass,{active:false,updatedAt:FieldValue.serverTimestamp(),revocadoPor:actor.uid});
  tx.create(adminDb.collection("AuditoriaClasesPrueba").doc(),{accion:"eliminar",solicitudId:id,sede:site,actorUid:actor.uid,creadoEn:FieldValue.serverTimestamp()});
  tx.delete(ref);
 });return NextResponse.json({ok:true});
 }catch(error){return fail(error);}}
