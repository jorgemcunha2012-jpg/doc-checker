"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export function ChangePasswordForm() {
  const router = useRouter(); const [password, setPassword] = useState(""); const [confirmation, setConfirmation] = useState(""); const [error, setError] = useState("");
  async function submit(event: React.FormEvent) { event.preventDefault(); if (password !== confirmation) return setError("As senhas não conferem."); const response = await fetch("/api/auth/password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) }); const payload = await response.json(); if (!response.ok) return setError(payload.error); router.push("/"); router.refresh(); }
  return <form className="mt-6 space-y-4" onSubmit={submit}><input className="min-h-11 w-full rounded-md border border-slate-300 px-3" type="password" placeholder="Nova senha (mínimo 10 caracteres)" required minLength={10} value={password} onChange={(event) => setPassword(event.target.value)} /><input className="min-h-11 w-full rounded-md border border-slate-300 px-3" type="password" placeholder="Confirmar nova senha" required value={confirmation} onChange={(event) => setConfirmation(event.target.value)} />{error ? <p className="text-sm text-rose-700">{error}</p> : null}<button className="min-h-11 w-full rounded-md bg-blue-600 px-4 text-sm font-bold text-white">Atualizar senha</button></form>;
}
