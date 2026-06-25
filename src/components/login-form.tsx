"use client";
import { useState } from "react";
import { Loader2, LogIn } from "lucide-react";
import { useRouter } from "next/navigation";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setLoading(true); setError("");
    const response = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
    const payload = await response.json(); setLoading(false);
    if (!response.ok) return setError(payload.error);
    router.push(payload.mustChangePassword ? "/change-password" : "/"); router.refresh();
  }
  return <form className="mt-8 space-y-4" onSubmit={submit}>
    <label className="block text-sm font-bold text-slate-700">Email<input className="mt-2 min-h-11 w-full rounded-md border border-slate-300 px-3 font-normal outline-none focus:border-blue-600" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
    <label className="block text-sm font-bold text-slate-700">Senha<input className="mt-2 min-h-11 w-full rounded-md border border-slate-300 px-3 font-normal outline-none focus:border-blue-600" type="password" required value={password} onChange={(event) => setPassword(event.target.value)} /></label>
    {error ? <p className="text-sm font-semibold text-rose-700">{error}</p> : null}
    <button className="flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-bold text-white hover:bg-blue-700 disabled:bg-slate-300" disabled={loading}>{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}Entrar</button>
  </form>;
}
