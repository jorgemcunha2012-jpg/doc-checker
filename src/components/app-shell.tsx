"use client";

import { useState, type ReactNode } from "react";
import { Building2, ChevronLeft, FileClock, FilePlus2, LayoutDashboard, Menu, ShieldAlert, Users, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { User } from "@/domain/validation";
import { LogoutButton } from "./logout-button";

const navigation = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/validation", label: "Nova conferência", icon: FilePlus2 },
  { href: "/history", label: "Histórico", icon: FileClock },
  { href: "/pending", label: "Pendências", icon: ShieldAlert },
  { href: "/developments", label: "Empreendimentos", icon: Building2 },
] as const;

export function AppShell({ user, children }: { user: User; children: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const items = user.role === "ADMIN"
    ? [...navigation, { href: "/admin" as const, label: "Usuários", icon: Users }]
    : navigation;

  return (
    <div className="min-h-screen bg-[#eef2f6] lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
      <button
        className="fixed left-4 top-4 z-40 flex h-10 w-10 items-center justify-center rounded-md bg-[#07192d] text-white shadow-lg lg:hidden"
        onClick={() => setOpen(true)}
        title="Abrir menu"
      >
        <Menu className="h-5 w-5" />
      </button>
      {open ? <button className="fixed inset-0 z-40 bg-slate-950/50 lg:hidden" onClick={() => setOpen(false)} aria-label="Fechar menu" /> : null}
      <aside className={`fixed inset-y-0 left-0 z-50 flex w-[248px] flex-col bg-[#07192d] px-4 py-5 text-white transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex items-start justify-between px-2">
          <Link href="/" className="block" onClick={() => setOpen(false)}>
            <div className="text-2xl font-bold tracking-normal">Confer<span className="text-[#2dd4bf]">IA</span></div>
            <div className="mt-1 text-xs leading-5 text-slate-400">Conferência documental imobiliária</div>
          </Link>
          <button className="mt-1 text-slate-400 lg:hidden" onClick={() => setOpen(false)} title="Fechar menu"><X className="h-5 w-5" /></button>
        </div>
        <nav className="mt-9 space-y-1">
          {items.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={{ pathname: item.href }}
                onClick={() => setOpen(false)}
                className={`flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-semibold transition ${active ? "bg-white/10 text-white shadow-inner ring-1 ring-white/5" : "text-slate-300 hover:bg-white/5 hover:text-white"}`}
              >
                <item.icon className={`h-4.5 w-4.5 ${active ? "text-[#2dd4bf]" : "text-slate-400"}`} />
                {item.label}
                {active ? <span className="ml-auto h-5 w-0.5 rounded-full bg-[#2dd4bf]" /> : null}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto border-t border-white/10 pt-4">
          <div className="flex items-center gap-3 rounded-md bg-white/5 p-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[#2dd4bf] text-sm font-bold text-[#07192d]">
              {user.name.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-bold">{user.name}</div>
              <div className="truncate text-[11px] text-slate-400">{user.email}</div>
            </div>
            <LogoutButton />
          </div>
        </div>
      </aside>
      <div className="min-w-0">
        <header className="flex min-h-16 items-center border-b border-slate-200 bg-white px-5 pl-16 lg:px-8">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-500">
            <ChevronLeft className="hidden h-4 w-4 lg:block" />
            {navigation.find((item) => item.href === (pathname === "/" ? "/" : `/${pathname.split("/")[1]}`))?.label ?? "ConferIA"}
          </div>
        </header>
        <div className="px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</div>
      </div>
    </div>
  );
}
