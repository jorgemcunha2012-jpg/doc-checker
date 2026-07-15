"use client";

import { useState, type ReactNode } from "react";
import { FileClock, FilePlus2, LayoutDashboard, Menu, ShieldAlert, Users, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { User } from "@/domain/validation";
import { LogoutButton } from "./logout-button";

const navigation = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/validation", label: "Nova conferência", icon: FilePlus2 },
  { href: "/history", label: "Histórico", icon: FileClock },
  { href: "/pending", label: "Pendências", icon: ShieldAlert },
] as const;

export function AppShell({ user, children }: { user: User; children: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const items = user.role === "ADMIN"
    ? [...navigation, { href: "/admin" as const, label: "Usuários", icon: Users }]
    : navigation;

  return (
    <div className="min-h-screen bg-[var(--canvas)] lg:grid lg:grid-cols-[224px_minmax(0,1fr)]">
      <button
        className="fixed left-4 top-3 z-40 flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--navy)] text-white shadow-lg lg:hidden"
        onClick={() => setOpen(true)}
        title="Abrir menu"
      >
        <Menu className="h-5 w-5" />
      </button>
      {open ? <button className="fixed inset-0 z-40 bg-slate-950/50 lg:hidden" onClick={() => setOpen(false)} aria-label="Fechar menu" /> : null}
      <aside className={`fixed inset-y-0 left-0 z-50 flex w-[224px] flex-col bg-[var(--navy-deep)] px-3 py-5 text-white transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex items-start justify-between px-2">
          <Link href="/" className="block" onClick={() => setOpen(false)}>
            <div className="text-[22px] font-semibold tracking-[-0.03em]">Confer<span className="text-[#62d4c9]">IA</span></div>
          </Link>
          <button className="mt-1 text-slate-400 lg:hidden" onClick={() => setOpen(false)} title="Fechar menu"><X className="h-5 w-5" /></button>
        </div>
        <Link href="/validation" onClick={() => setOpen(false)} className="mt-8 flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#62d4c9] px-3 text-sm font-semibold text-[var(--navy-deep)] transition hover:bg-[#82dfd6]">
          <FilePlus2 className="h-4 w-4" /> Nova conferência
        </Link>
        <div className="mb-2 mt-8 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Área de trabalho</div>
        <nav className="space-y-1">
          {items.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={{ pathname: item.href }}
                onClick={() => setOpen(false)}
                className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition ${active ? "bg-white/11 text-white" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}
              >
                <item.icon className={`h-4.5 w-4.5 ${active ? "text-[#62d4c9]" : "text-slate-500"}`} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto border-t border-white/10 pt-4">
          <div className="flex items-center gap-3 rounded-xl bg-white/5 p-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#62d4c9] text-sm font-semibold text-[var(--navy-deep)]">
              {user.name.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">{user.name}</div>
              <div className="truncate text-[11px] text-slate-400">{user.email}</div>
            </div>
            <LogoutButton />
          </div>
        </div>
      </aside>
      <div className="min-w-0">
        <header className="flex min-h-16 items-center border-b border-[var(--border)] bg-white/90 px-5 pl-16 backdrop-blur lg:px-8">
          <div className="text-sm font-medium text-[var(--muted)]">
            {navigation.find((item) => item.href === (pathname === "/" ? "/" : `/${pathname.split("/")[1]}`))?.label ?? "ConferIA"}
          </div>
        </header>
        <div className="px-4 py-6 sm:px-6 lg:px-9 lg:py-9">{children}</div>
      </div>
    </div>
  );
}
