"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useSidebar } from "@/context/SidebarContext";

type NavigationItem = { label: string; href: string; icon: ReactNode };

function Icon({ type }: { type: "overview" | "forms" | "responses" | "settings" }) {
  const paths = {
    overview: <><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></>,
    forms: <><path d="M7 3.75h7.5L19 8.25v12H7a2 2 0 0 1-2-2v-12a2 2 0 0 1 2-2.5Z"/><path d="M14.5 3.75v4.5H19M8.5 12h7M8.5 16h5" strokeLinecap="round" strokeLinejoin="round"/></>,
    responses: <><path d="M8.25 18.75a6.75 6.75 0 1 0 0-13.5 6.75 6.75 0 0 0 0 13.5ZM15.75 18.75h1.5a3.75 3.75 0 1 0-1.85-7.01M3.75 20.25c.69-2.43 2.25-3.75 4.5-3.75s3.81 1.32 4.5 3.75" strokeLinecap="round" strokeLinejoin="round"/></>,
    settings: <><circle cx="12" cy="12" r="3.25"/><path d="M19.4 13.4a1.7 1.7 0 0 0 .34 1.88l.06.06-1.96 1.96-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56v.09h-2.77v-.09a1.7 1.7 0 0 0-1.03-1.56 1.7 1.7 0 0 0-1.88.34l-.06.06-1.96-1.96.06-.06a1.7 1.7 0 0 0 .34-1.88 1.7 1.7 0 0 0-1.56-1.03h-.09V9.6h.09A1.7 1.7 0 0 0 8.65 8.57a1.7 1.7 0 0 0-.34-1.88l-.06-.06 1.96-1.96.06.06a1.7 1.7 0 0 0 1.88.34 1.7 1.7 0 0 0 1.03-1.56v-.09h2.77v.09a1.7 1.7 0 0 0 1.03 1.56 1.7 1.7 0 0 0 1.88-.34l.06-.06 1.96 1.96-.06.06a1.7 1.7 0 0 0-.34 1.88 1.7 1.7 0 0 0 1.56 1.03h.09v2.77h-.09a1.7 1.7 0 0 0-1.56 1.03Z" strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round"/></>,
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="size-5" stroke="currentColor" strokeWidth="1.8">{paths[type]}</svg>;
}

const navigationItems: NavigationItem[] = [
  { label: "Overview", href: "/admin", icon: <Icon type="overview" /> },
  { label: "Forms", href: "/admin/forms", icon: <Icon type="forms" /> },
  { label: "Responses", href: "/admin/responses", icon: <Icon type="responses" /> },
  { label: "Clinic settings", href: "/admin/clinic-settings", icon: <Icon type="settings" /> },
];

export default function AppSidebar() {
  const { isExpanded, isHovered, isMobileOpen, setIsHovered } = useSidebar();
  const pathname = usePathname();
  const isOpen = isExpanded || isHovered || isMobileOpen;

  return <aside className={`fixed inset-y-0 left-0 z-50 flex h-screen flex-col border-r border-slate-200 bg-white px-4 transition-[width,transform] duration-300 dark:border-gray-800 dark:bg-gray-900 ${isOpen ? "w-[280px]" : "w-[88px]"} ${isMobileOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0`} onMouseEnter={() => !isExpanded && setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}>
    <div className={`flex h-20 items-center ${isOpen ? "px-2" : "justify-center"}`}><Link href="/admin" className="flex min-w-0 items-center gap-3" aria-label="CareFlow clinic workspace"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-500 text-lg font-bold text-white shadow-theme-sm">C</span>{isOpen && <span className="truncate text-lg font-bold tracking-tight text-gray-900 dark:text-white">CareFlow</span>}</Link></div>
    {isOpen && <div className="mb-7 rounded-xl border border-brand-100 bg-brand-50 p-3 dark:border-brand-500/20 dark:bg-brand-500/10"><div className="flex items-center gap-2"><span className="grid size-7 place-items-center rounded-lg bg-white text-xs font-bold text-brand-600 shadow-theme-xs dark:bg-gray-900">EM</span><div className="min-w-0"><p className="truncate text-xs font-semibold text-gray-800 dark:text-white">Empowered Minds Clinic</p><p className="mt-0.5 text-[11px] text-gray-500">Clinic workspace</p></div></div></div>}
    <nav aria-label="Clinic administration" className="flex flex-1 flex-col">{isOpen && <p className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-400">Workspace</p>}<ul className="space-y-1">{navigationItems.map((item) => { const active = item.href === "/" ? pathname === "/" : pathname === item.href || pathname.startsWith(`${item.href}/`) || (item.href === "/forms" && pathname.startsWith("/questionnaires")); return <li key={item.href}><Link href={item.href} title={!isOpen ? item.label : undefined} className={`flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors ${active ? "bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300" : "text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-white"} ${!isOpen ? "justify-center px-0" : ""}`}><span className="shrink-0">{item.icon}</span>{isOpen && <span>{item.label}</span>}</Link></li>; })}</ul></nav>
    <div className="mb-5 border-t border-slate-100 pt-4 dark:border-gray-800"><Link href="/admin/clinic-settings" title={!isOpen ? "Clinic plan" : undefined} className={`flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-3 text-sm dark:bg-white/[0.04] ${!isOpen ? "justify-center px-0" : ""}`}><span className="grid size-7 shrink-0 place-items-center rounded-lg bg-success-100 text-success-700 dark:bg-success-500/15 dark:text-success-300">✓</span>{isOpen && <span className="min-w-0"><span className="block font-semibold text-gray-800 dark:text-white">Clinic plan</span><span className="block text-xs text-gray-500">Configuration ready</span></span>}</Link></div>
  </aside>;
}
