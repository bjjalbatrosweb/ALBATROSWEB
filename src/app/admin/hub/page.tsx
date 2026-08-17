"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  ChevronDown,
  LayoutGrid,
  List,
  Search,
  Sparkles,
  X,
} from "lucide-react";

import {
  ADMIN_GROUP_TONE_STYLES,
  ADMIN_PRIMARY_LINKS,
  ADMIN_TOOL_COUNT,
  ADMIN_TOOL_GROUPS,
} from "@/lib/admin-navigation";

function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export default function AdminHubPage() {
  const [query, setQuery] = useState("");
  const [activeGroup, setActiveGroup] = useState("all");
  const [viewMode, setViewMode] = useState<"complete" | "simple">("complete");
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const normalizedQuery = normalizeSearch(query);

  const visibleGroups = useMemo(
    () =>
      ADMIN_TOOL_GROUPS.filter(
        (group) => activeGroup === "all" || group.id === activeGroup,
      )
        .map((group) => {
          const groupMatches = normalizeSearch(
            `${group.label} ${group.description}`,
          ).includes(normalizedQuery);
          const items = normalizedQuery
            ? group.items.filter((item) =>
                normalizeSearch(
                  `${item.label} ${item.description} ${item.section || ""}`,
                ).includes(normalizedQuery),
              )
            : group.items;
          return {
            ...group,
            items: groupMatches ? group.items : items,
          };
        })
        .filter((group) => group.items.length > 0),
    [activeGroup, normalizedQuery],
  );

  const visibleToolCount = visibleGroups.reduce(
    (total, group) => total + group.items.length,
    0,
  );
  const quickLinks = ADMIN_PRIMARY_LINKS.filter(
    (item) => item.href !== "/admin/hub",
  );
  const expandedSimpleGroup = visibleGroups.find(
    (group) => group.id === expandedGroup,
  );

  return (
    <div className="relative mx-auto w-full max-w-[1680px] overflow-hidden pb-12 text-white">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[38rem] overflow-hidden rounded-[2.5rem]"
      >
        <div className="absolute -left-32 -top-40 h-[32rem] w-[32rem] animate-pulse rounded-full bg-red-600/15 blur-[110px] motion-reduce:animate-none" />
        <div className="absolute -right-32 top-12 h-[28rem] w-[28rem] animate-pulse rounded-full bg-violet-600/10 blur-[120px] [animation-delay:900ms] motion-reduce:animate-none" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.025)_1px,transparent_1px)] bg-[size:42px_42px] [mask-image:linear-gradient(to_bottom,black,transparent_92%)]" />
      </div>

      <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(239,68,68,.2),transparent_35%),linear-gradient(135deg,rgba(26,17,20,.96),rgba(11,13,18,.94))] p-5 shadow-[0_30px_100px_rgba(0,0,0,.45)] sm:p-8 lg:p-10">
        <div className="relative grid gap-8 xl:grid-cols-[1fr_auto] xl:items-end">
          <div className="max-w-4xl">
            <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.24em] text-red-300">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-red-500/15 ring-1 ring-red-400/20">
                <Sparkles className="h-4 w-4" />
              </span>
              Centro de navegación
            </p>
            <h1 className="mt-5 text-4xl font-black uppercase italic tracking-[-0.055em] sm:text-6xl lg:text-7xl">
              Hub <span className="text-red-500">Albatros</span>
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-relaxed text-slate-300 sm:text-base">
              Todo el panel organizado por flujo de trabajo. Encuentra una
              herramienta, entra a una categoría o salta directamente a tu
              operación más frecuente.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:min-w-72">
            <div className="rounded-2xl border border-white/10 bg-black/30 p-4 backdrop-blur">
              <span className="block text-3xl font-black text-white">
                {ADMIN_TOOL_GROUPS.length}
              </span>
              <span className="mt-1 block text-[9px] font-black uppercase tracking-[0.16em] text-slate-400">
                Categorías
              </span>
            </div>
            <div className="rounded-2xl border border-red-400/20 bg-red-500/10 p-4 backdrop-blur">
              <span className="block text-3xl font-black text-red-200">
                {ADMIN_TOOL_COUNT}
              </span>
              <span className="mt-1 block text-[9px] font-black uppercase tracking-[0.16em] text-red-200/60">
                Herramientas
              </span>
            </div>
          </div>
        </div>

        <div className="relative mt-8 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
          <label className="group/search relative block">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500 transition-colors group-focus-within/search:text-red-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar módulo, función o categoría…"
              className="min-h-14 w-full rounded-2xl border border-white/10 bg-black/40 pl-12 pr-12 text-sm font-semibold text-white outline-none transition-all placeholder:text-slate-500 focus:border-red-400/45 focus:bg-black/55 focus:ring-4 focus:ring-red-500/10"
              aria-label="Buscar en el Hub"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-3 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-white"
                aria-label="Limpiar búsqueda"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </label>
          <div className="flex items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] px-5 text-xs font-black uppercase tracking-[0.14em] text-slate-300">
            {viewMode === "complete"
              ? `${visibleToolCount} resultados`
              : `${visibleGroups.length} categorías`}
          </div>
        </div>
      </section>

      <section className="mt-5 grid gap-3 sm:grid-cols-3">
        {quickLinks.map((item, index) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                animationDelay: `${index * 80}ms`,
                animationFillMode: "both",
              }}
              className="group/quick animate-in fade-in slide-in-from-bottom-3 rounded-2xl border border-white/10 bg-[#12151b]/90 p-4 shadow-lg transition-all duration-300 hover:-translate-y-1 hover:border-red-400/30 hover:bg-[#181b22] hover:shadow-[0_18px_40px_rgba(0,0,0,.3)] motion-reduce:animate-none motion-reduce:transform-none"
            >
              <span className="flex items-center gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/[0.06] text-slate-200 ring-1 ring-white/10 transition-colors group-hover/quick:bg-red-500/15 group-hover/quick:text-red-300">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-black uppercase tracking-wide text-white">
                    {item.label}
                  </span>
                  <span className="mt-1 block truncate text-[11px] text-slate-500">
                    {item.description}
                  </span>
                </span>
                <ArrowUpRight className="h-4 w-4 text-slate-600 transition-all group-hover/quick:-translate-y-0.5 group-hover/quick:translate-x-0.5 group-hover/quick:text-red-300" />
              </span>
            </Link>
          );
        })}
      </section>

      <section className="mt-7 flex flex-col gap-3 rounded-2xl border border-white/10 bg-[#101218]/90 p-2 shadow-lg sm:flex-row sm:items-center sm:justify-between">
        <div className="px-3 py-2">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white">
            Vista del Hub
          </p>
          <p className="mt-1 text-[10px] text-slate-500">
            Cambia entre el detalle completo y la navegación por categorías.
          </p>
        </div>
        <div
          className="grid grid-cols-2 rounded-xl border border-white/10 bg-black/35 p-1"
          role="group"
          aria-label="Cambiar vista del Hub"
        >
          <button
            type="button"
            onClick={() => setViewMode("complete")}
            aria-pressed={viewMode === "complete"}
            className={`flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-[10px] font-black uppercase tracking-[0.12em] transition-all duration-300 ${
              viewMode === "complete"
                ? "bg-red-500 text-white shadow-lg shadow-red-950/40"
                : "text-slate-500 hover:bg-white/[0.05] hover:text-white"
            }`}
          >
            <LayoutGrid className="h-4 w-4" /> Completa
          </button>
          <button
            type="button"
            onClick={() => {
              setViewMode("simple");
              setActiveGroup("all");
            }}
            aria-pressed={viewMode === "simple"}
            className={`flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-[10px] font-black uppercase tracking-[0.12em] transition-all duration-300 ${
              viewMode === "simple"
                ? "bg-red-500 text-white shadow-lg shadow-red-950/40"
                : "text-slate-500 hover:bg-white/[0.05] hover:text-white"
            }`}
          >
            <List className="h-4 w-4" /> Simple
          </button>
        </div>
      </section>

      {viewMode === "complete" && (
        <nav
          className="mt-5 flex gap-2 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          aria-label="Filtrar categorías del Hub"
        >
          <button
            type="button"
            onClick={() => setActiveGroup("all")}
            className={`flex min-h-10 shrink-0 items-center gap-2 rounded-full border px-4 text-[10px] font-black uppercase tracking-[0.12em] transition-all ${
              activeGroup === "all"
                ? "border-red-400/40 bg-red-500 text-white shadow-lg shadow-red-950/30"
                : "border-white/10 bg-white/[0.035] text-slate-400 hover:border-white/20 hover:text-white"
            }`}
          >
            <LayoutGrid className="h-3.5 w-3.5" /> Todos
          </button>
          {ADMIN_TOOL_GROUPS.map((group) => {
            const Icon = group.icon;
            const tone = ADMIN_GROUP_TONE_STYLES[group.tone];
            const active = activeGroup === group.id;
            return (
              <button
                key={group.id}
                type="button"
                onClick={() => setActiveGroup(group.id)}
                className={`flex min-h-10 shrink-0 items-center gap-2 rounded-full border px-4 text-[10px] font-black uppercase tracking-[0.12em] transition-all ${
                  active
                    ? tone.active
                    : "border-white/10 bg-white/[0.035] text-slate-400 hover:border-white/20 hover:text-white"
                }`}
              >
                <Icon className="h-3.5 w-3.5" /> {group.label}
              </button>
            );
          })}
        </nav>
      )}

      {visibleGroups.length > 0 ? (
        viewMode === "complete" ? (
          <section className="mt-4 grid grid-cols-1 items-stretch gap-4 md:grid-cols-2 xl:grid-cols-3">
            {visibleGroups.map((group, groupIndex) => {
              const GroupIcon = group.icon;
              const tone = ADMIN_GROUP_TONE_STYLES[group.tone];
              return (
                <article
                  key={group.id}
                  style={{
                    animationDelay: `${groupIndex * 75}ms`,
                    animationFillMode: "both",
                  }}
                  className={`group/card relative flex h-full min-h-0 animate-in flex-col overflow-hidden rounded-[1.75rem] border bg-[#101218]/95 shadow-xl fade-in slide-in-from-bottom-4 duration-500 motion-reduce:animate-none ${tone.border}`}
                >
                  <div
                    aria-hidden="true"
                    className={`pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b ${tone.glow} to-transparent opacity-60`}
                  />
                  <header className="relative flex items-start gap-4 border-b border-white/[0.07] p-5 sm:p-6">
                    <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ring-1 ${tone.icon}`}>
                      <GroupIcon className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg font-black uppercase italic tracking-tight text-white">
                          {group.label}
                        </h2>
                        <span className={`rounded-full border px-2 py-1 text-[8px] font-black uppercase tracking-wider ${tone.chip}`}>
                          {group.items.length} opciones
                        </span>
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-slate-400">
                        {group.description}
                      </p>
                    </div>
                  </header>

                  <div className="relative grid flex-1 content-start gap-2 p-3 sm:p-4">
                    {group.items.map((item, itemIndex) => {
                      const ItemIcon = item.icon;
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          style={{
                            animationDelay: `${groupIndex * 70 + itemIndex * 35}ms`,
                            animationFillMode: "both",
                          }}
                          className="group/item animate-in fade-in slide-in-from-bottom-2 rounded-xl border border-white/[0.07] bg-white/[0.025] p-3 transition-all duration-300 hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.075] hover:shadow-lg motion-reduce:animate-none motion-reduce:transform-none"
                        >
                          <span className="flex items-start gap-3">
                            <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ring-1 transition-transform duration-300 group-hover/item:scale-105 ${tone.icon}`}>
                              <ItemIcon className="h-4 w-4" />
                            </span>
                            <span className="min-w-0 flex-1">
                              {item.section && (
                                <span className={`mb-1 block text-[7px] font-black uppercase tracking-[0.2em] ${tone.text}`}>
                                  {item.section}
                                </span>
                              )}
                              <span className="flex items-center justify-between gap-2 text-[11px] font-black uppercase tracking-wide text-white">
                                {item.label}
                                <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-slate-600 transition-all group-hover/item:-translate-y-0.5 group-hover/item:translate-x-0.5 group-hover/item:text-white" />
                              </span>
                              <span className="mt-1 block text-[10px] leading-relaxed text-slate-500 transition-colors group-hover/item:text-slate-400">
                                {item.description}
                              </span>
                            </span>
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                </article>
              );
            })}
          </section>
        ) : (
          <>
            <section className="mt-4 grid grid-cols-1 items-stretch gap-4 md:grid-cols-2 xl:grid-cols-3">
              {visibleGroups.map((group, groupIndex) => {
                const GroupIcon = group.icon;
                const tone = ADMIN_GROUP_TONE_STYLES[group.tone];
                const isExpanded = expandedGroup === group.id;
                return (
                  <button
                    key={group.id}
                    type="button"
                    onClick={() =>
                      setExpandedGroup(isExpanded ? null : group.id)
                    }
                    aria-expanded={isExpanded}
                    aria-controls={`hub-simple-${group.id}`}
                    style={{
                      animationDelay: `${groupIndex * 65}ms`,
                      animationFillMode: "both",
                    }}
                    className={`group/category relative flex min-h-44 animate-in items-center overflow-hidden rounded-[1.75rem] border bg-[#101218]/95 p-5 text-left shadow-xl fade-in slide-in-from-bottom-4 transition-all duration-300 hover:-translate-y-1 hover:bg-[#151820] hover:shadow-[0_22px_55px_rgba(0,0,0,.35)] motion-reduce:animate-none motion-reduce:transform-none sm:p-6 ${
                      isExpanded ? `${tone.border} ring-1 ring-white/10` : "border-white/10"
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`pointer-events-none absolute inset-x-0 top-0 h-full bg-gradient-to-br ${tone.glow} via-transparent to-transparent transition-opacity duration-300 ${
                        isExpanded ? "opacity-90" : "opacity-45"
                      }`}
                    />
                    <span className="relative flex w-full items-center gap-4">
                      <span className={`grid h-14 w-14 shrink-0 place-items-center rounded-2xl ring-1 transition-transform duration-300 group-hover/category:scale-105 ${tone.icon}`}>
                        <GroupIcon className="h-6 w-6" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-lg font-black uppercase italic tracking-tight text-white">
                          {group.label}
                        </span>
                        <span className="mt-2 block text-xs leading-relaxed text-slate-400">
                          {group.description}
                        </span>
                        <span className={`mt-3 inline-flex rounded-full border px-2.5 py-1 text-[8px] font-black uppercase tracking-wider ${tone.chip}`}>
                          {group.items.length} opciones
                        </span>
                      </span>
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/10 bg-black/25 text-slate-300">
                        <ChevronDown
                          className={`h-4 w-4 transition-transform duration-300 ${
                            isExpanded ? "rotate-180" : ""
                          }`}
                        />
                      </span>
                    </span>
                  </button>
                );
              })}
            </section>

            {expandedSimpleGroup && (() => {
              const GroupIcon = expandedSimpleGroup.icon;
              const tone = ADMIN_GROUP_TONE_STYLES[expandedSimpleGroup.tone];
              return (
                <section
                  id={`hub-simple-${expandedSimpleGroup.id}`}
                  key={expandedSimpleGroup.id}
                  className={`relative mt-4 animate-in overflow-hidden rounded-[1.75rem] border bg-[#0d1015]/95 shadow-[0_25px_70px_rgba(0,0,0,.4)] fade-in slide-in-from-top-3 duration-300 motion-reduce:animate-none ${tone.border}`}
                >
                  <div
                    aria-hidden="true"
                    className={`pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b ${tone.glow} to-transparent opacity-70`}
                  />
                  <header className="relative flex flex-col gap-4 border-b border-white/[0.07] p-5 sm:flex-row sm:items-center sm:p-6">
                    <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ring-1 ${tone.icon}`}>
                      <GroupIcon className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <h2 className="text-xl font-black uppercase italic tracking-tight text-white">
                        {expandedSimpleGroup.label}
                      </h2>
                      <p className="mt-1 text-xs leading-relaxed text-slate-400">
                        {expandedSimpleGroup.description}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setExpandedGroup(null)}
                      className="min-h-10 rounded-xl border border-white/10 bg-black/25 px-4 text-[9px] font-black uppercase tracking-[0.14em] text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-white"
                    >
                      Cerrar opciones
                    </button>
                  </header>

                  <div className="relative grid gap-3 p-4 sm:grid-cols-2 sm:p-6 xl:grid-cols-3">
                    {expandedSimpleGroup.items.map((item, itemIndex) => {
                      const ItemIcon = item.icon;
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          style={{
                            animationDelay: `${itemIndex * 45}ms`,
                            animationFillMode: "both",
                          }}
                          className="group/item animate-in rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4 shadow-lg fade-in slide-in-from-bottom-2 transition-all duration-300 hover:-translate-y-1 hover:border-white/20 hover:bg-white/[0.08] motion-reduce:animate-none motion-reduce:transform-none"
                        >
                          <span className="flex items-start gap-3">
                            <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ring-1 transition-transform duration-300 group-hover/item:scale-105 ${tone.icon}`}>
                              <ItemIcon className="h-4 w-4" />
                            </span>
                            <span className="min-w-0 flex-1">
                              {item.section && (
                                <span className={`mb-1 block text-[7px] font-black uppercase tracking-[0.2em] ${tone.text}`}>
                                  {item.section}
                                </span>
                              )}
                              <span className="flex items-center justify-between gap-2 text-[11px] font-black uppercase tracking-wide text-white">
                                {item.label}
                                <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-slate-600 transition-all group-hover/item:-translate-y-0.5 group-hover/item:translate-x-0.5 group-hover/item:text-white" />
                              </span>
                              <span className="mt-1.5 block text-[10px] leading-relaxed text-slate-500 transition-colors group-hover/item:text-slate-400">
                                {item.description}
                              </span>
                            </span>
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                </section>
              );
            })()}
          </>
        )
      ) : (
        <div className="mt-8 rounded-[1.75rem] border border-dashed border-white/15 bg-white/[0.025] px-6 py-16 text-center">
          <Search className="mx-auto h-8 w-8 text-slate-600" />
          <h2 className="mt-4 text-lg font-black uppercase text-white">
            Sin coincidencias
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            Prueba con otra palabra o selecciona una categoría diferente.
          </p>
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setActiveGroup("all");
              setExpandedGroup(null);
            }}
            className="mt-5 rounded-xl bg-red-500 px-5 py-3 text-xs font-black uppercase text-white hover:bg-red-400"
          >
            Mostrar todo
          </button>
        </div>
      )}
    </div>
  );
}
