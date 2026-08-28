import { LogIn } from "lucide-react";

export function LoginForm({ error }: { error?: string }) {
  return <form className="mt-8 space-y-4" action="/api/auth/login" method="post">
    <label className="block text-sm font-bold text-slate-700">Email ou usuário<input className="mt-2 min-h-11 w-full rounded-md border border-slate-300 px-3 font-normal outline-none focus:border-blue-600" name="email" type="text" autoComplete="username" required /></label>
    <label className="block text-sm font-bold text-slate-700">Senha<input className="mt-2 min-h-11 w-full rounded-md border border-slate-300 px-3 font-normal outline-none focus:border-blue-600" name="password" type="password" autoComplete="current-password" required /></label>
    {error ? <p className="text-sm font-semibold text-rose-700" role="alert">{error}</p> : null}
    <button className="flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-bold text-white hover:bg-blue-700"><LogIn className="h-4 w-4" />Entrar</button>
  </form>;
}
