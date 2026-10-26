import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PUBLIC_ACADEMY_SITES, publicSiteOrigin } from '@/lib/public-site';
import { TRIAL_CLASS_SCHEDULES } from '@/lib/trial-class-request';
export function generateStaticParams() { return PUBLIC_ACADEMY_SITES.map(site=>({sede:site.slug})); }
export async function generateMetadata({params}:{params:Promise<{sede:string}>}):Promise<Metadata> {
 const {sede}=await params;const site=PUBLIC_ACADEMY_SITES.find(site=>site.slug===sede);if(!site)return {};
 const origin=publicSiteOrigin();
 return {title:`Sede ${site.name} | ALBATROS`,description:site.description,...(origin?{alternates:{canonical:`${origin}/sedes/${site.slug}`}}:{}),openGraph:{title:`ALBATROS · Sede ${site.name}`,description:site.description,type:'website',locale:'es_MX',...(origin?{images:[{url:`${origin}/Mibaner.webp`,alt:'Academia Albatros'}]}:{})}};
}
export default async function SitePage({params}:{params:Promise<{sede:string}>}) {
 const {sede}=await params;const site=PUBLIC_ACADEMY_SITES.find(site=>site.slug===sede);if(!site)notFound();
 const whatsapp=`https://wa.me/529901443886?text=${encodeURIComponent(`Hola, quiero información de ubicación, horarios, precios y clase de prueba de la sede ${site.name}.`)}`;
 const origin=publicSiteOrigin();
 const schema={'@context':'https://schema.org','@type':'SportsActivityLocation',name:`ALBATROS · ${site.name}`,description:site.description,telephone:'+529901443886',...(origin?{url:`${origin}/sedes/${site.slug}`}:{})};
 return <main className="mx-auto min-h-screen max-w-5xl px-5 py-12 text-white"><script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(schema).replace(/</g,'\\u003c')}}/><Link href="/" className="text-red-300 underline">← Volver a Albatros</Link><p className="mt-12 text-sm uppercase tracking-widest text-red-300">Centro de alto rendimiento</p><h1 className="mt-3 text-5xl font-black">Sede {site.name}</h1><p className="mt-6 max-w-2xl text-lg text-slate-300">{site.description}</p>
 {site.trial && <section className="mt-8"><h2 className="text-2xl font-bold">Horarios de clase de prueba · $0 MXN</h2><div className="mt-5 grid gap-4 md:grid-cols-3">{TRIAL_CLASS_SCHEDULES.map(discipline=><article key={discipline.discipline} className="rounded-2xl border border-white/15 p-5"><h3 className="font-bold">{discipline.discipline}</h3><ul className="mt-4 space-y-3 text-sm text-slate-300">{discipline.times.map(time=><li key={time}>{time}</li>)}</ul></article>)}</div><Link href="/clase-prueba" className="mt-6 inline-block rounded-xl bg-red-600 px-6 py-3 font-bold">Reservar clase gratis</Link></section>}
 <a href={whatsapp} className="mt-6 inline-block rounded-xl border border-white/20 px-6 py-3 font-bold">Consultar esta sede por WhatsApp</a><p className="mt-5 text-sm text-slate-400">Confirma con la academia la dirección exacta y los horarios antes de acudir.</p><nav aria-label="Otras sedes" className="mt-12 flex flex-wrap gap-5">{PUBLIC_ACADEMY_SITES.filter(other=>other.slug!==site.slug).map(other=><Link href={`/sedes/${other.slug}`} key={other.slug} className="underline">Sede {other.name}</Link>)}</nav></main>;
}
