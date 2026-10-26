export function publicSiteOrigin(fallback?: string) {
 const value = process.env.NEXT_PUBLIC_SITE_URL || fallback;
 if (!value) return undefined;
 try { const url = new URL(value); return ['http:','https:'].includes(url.protocol) ? url.origin : undefined; } catch { return undefined; }
}
export const PUBLIC_ACADEMY_SITES = [
 {slug:'mma',name:'MMA',description:'Reserva en línea tu primera clase sin costo de Jiu-Jitsu, Kick Boxing o MMA.',trial:true},
 {slug:'caucel',name:'Cd. Caucel',description:'Clases de Jiu-Jitsu, Kick Boxing y MMA en Cd. Caucel, Mérida, Yucatán. Mensualidad individual publicada: $600 MXN.',trial:false},
 {slug:'juan-pablo',name:'Juan Pablo',description:'Contacta a la academia para confirmar disciplinas, horarios, ubicación y cuotas vigentes en esta sede.',trial:false},
] as const;
