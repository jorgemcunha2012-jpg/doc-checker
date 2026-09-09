"use client";
import { useState } from "react";
import { Check, Eye, EyeOff, Loader2 } from "lucide-react";

export function ChangePasswordForm() {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const requirements = [
    ["12 caracteres", password.length >= 12],
    ["Letra maiúscula", /[A-Z]/.test(password)],
    ["Letra minúscula", /[a-z]/.test(password)],
    ["Número e símbolo", /\d/.test(password) && /[^A-Za-z0-9]/.test(password)],
  ] as const;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (password !== confirmation) return setError("As senhas não conferem.");
    setSubmitting(true);
    setError("");
    const response = await fetch("/api/auth/password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
    const payload = await response.json();
    if (!response.ok) {
      setSubmitting(false);
      return setError(payload.error);
    }
    window.location.assign("/");
  }

  return <form className="mt-8 space-y-5" onSubmit={submit}>
    <label className="block text-sm font-semibold text-slate-800">
      Nova senha
      <span className="relative mt-2 block">
        <input className="app-input w-full px-3.5 pr-12 font-normal" type={showPassword ? "text" : "password"} autoComplete="new-password" placeholder="Digite a nova senha" required minLength={12} value={password} onChange={(event) => setPassword(event.target.value)} />
        <button className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-slate-500 hover:text-[var(--navy)]" type="button" onClick={() => setShowPassword((visible) => !visible)} title={showPassword ? "Ocultar senha" : "Mostrar senha"} aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}>
          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </span>
    </label>
    <div className="grid grid-cols-2 gap-2 text-xs">
      {requirements.map(([label, met]) => <span className={met ? "flex items-center gap-1.5 text-emerald-700" : "flex items-center gap-1.5 text-slate-400"} key={label}><Check className="h-3.5 w-3.5" />{label}</span>)}
    </div>
    <label className="block text-sm font-semibold text-slate-800">
      Confirme a senha
      <input className="app-input mt-2 w-full px-3.5 font-normal" type={showPassword ? "text" : "password"} autoComplete="new-password" placeholder="Digite novamente" required minLength={12} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} />
    </label>
    {error ? <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm font-medium text-rose-700" role="alert">{error}</p> : null}
    <button className="app-button-primary flex min-h-12 w-full items-center justify-center gap-2 px-4 text-sm font-bold" disabled={submitting}>
      {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      {submitting ? "Salvando..." : "Salvar e continuar"}
    </button>
  </form>;
}
