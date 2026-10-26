import Link from 'next/link';
const actions = [
 {href:'/admin/recepcion',label:'Registrar asistencia',detail:'Entrada y atención en recepción'},
 {href:'/admin/dia-de-pago',label:'Pagos pendientes',detail:'Revisar mensualidades y cobros'},
 {href:'/admin/compras',label:'Pedidos de tienda',detail:'Preparar, entregar y gestionar productos'},
 {href:'/admin/centro-operativo',label:'Alertas de operación',detail:'Revisar incidencias y pendientes'},
];
export function OperationalShortcuts() {
 return <nav aria-label="Tareas frecuentes" className="my-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">{actions.map(action=><Link key={action.href} href={action.href} className="rounded-2xl border border-red-500/25 bg-[#17151b] p-4 text-white transition hover:border-red-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-400"><span className="block text-sm font-bold">{action.label} →</span><span className="mt-2 block text-xs text-slate-300">{action.detail}</span></Link>)}</nav>;
}
