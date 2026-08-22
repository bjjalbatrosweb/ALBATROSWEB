"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, CalendarCheck, Home, ShieldCheck, UserRound } from "lucide-react";
const items=[{href:"/dashboard",label:"Inicio",icon:Home},{href:"/mi-academia",label:"Academia",icon:ShieldCheck},{href:"/estado-fisico",label:"Progreso",icon:Activity},{href:"/reservas",label:"Reservar",icon:CalendarCheck},{href:"/perfil",label:"Perfil",icon:UserRound}];
export function AthleteMobileNav(){const pathname=usePathname();return <nav className="fixed inset-x-3 bottom-3 z-40 grid grid-cols-5 rounded-[1.35rem] border border-white/10 bg-[#111318]/90 p-1.5 shadow-[0_18px_50px_rgba(0,0,0,.65)] backdrop-blur-xl md:hidden" aria-label="Navegación principal del atleta">{items.map(item=>{const Icon=item.icon,active=pathname===item.href;return <Link key={item.href} href={item.href} aria-current={active?"page":undefined} className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-2xl text-[9px] font-black transition ${active?'bg-amber-300 text-slate-950':'text-slate-400'}`}><Icon className="h-4 w-4"/><span>{item.label}</span></Link>})}</nav>}
