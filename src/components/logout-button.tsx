"use client";
import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
export function LogoutButton() {
  const router = useRouter();
  return <button title="Sair" className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100" onClick={async () => { await fetch("/api/auth/logout", { method: "POST" }); router.push("/login"); router.refresh(); }}><LogOut className="h-4 w-4" /></button>;
}
