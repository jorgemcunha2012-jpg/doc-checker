import { ArrowRight, LogIn } from "lucide-react";

export function LoginForm({ error }: { error?: string }) {
  return <form className="mt-8 space-y-5" action="/api/auth/login" method="post">
    <label className="block text-sm font-semibold text-slate-800">
      Email ou usuário
      <input className="app-input mt-2 w-full px-3.5 font-normal" name="email" type="text" autoComplete="username" placeholder="nome@empresa.com.br" required />
    </label>
    <label className="block text-sm font-semibold text-slate-800">
      Senha
      <input className="app-input mt-2 w-full px-3.5 font-normal" name="password" type="password" autoComplete="current-password" placeholder="Digite sua senha" required />
    </label>
    {error ? <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm font-medium text-rose-700" role="alert">{error}</p> : null}
    <button className="app-button-primary flex min-h-12 w-full items-center justify-center gap-2 px-4 text-sm font-bold">
      <LogIn className="h-4 w-4" />
      Entrar na plataforma
      <ArrowRight className="h-4 w-4" />
    </button>
  </form>;
}
