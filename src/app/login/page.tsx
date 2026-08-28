import { Building2, FileCheck2, ShieldCheck } from "lucide-react";
import { LoginForm } from "@/components/login-form";
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="min-h-screen bg-[#f4f7f5] p-4 sm:p-6 lg:p-8">
      <div className="mx-auto grid min-h-[calc(100vh-2rem)] max-w-6xl overflow-hidden rounded-[14px] border border-[var(--border)] bg-white shadow-[0_24px_70px_rgb(15_35_64_/_0.10)] lg:grid-cols-[1.04fr_0.96fr]">
        <section className="relative flex flex-col justify-between overflow-hidden bg-[#102a3a] px-7 py-8 text-white sm:px-10 sm:py-11">
          <div className="absolute inset-x-0 top-0 h-1 bg-[#4d7fe4]" />
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#315fc5] shadow-[0_12px_28px_rgb(0_0_0_/_0.16)]"><Building2 className="h-5 w-5" /></div>
              <div className="text-2xl font-bold tracking-tight">Confer<span className="text-[#8eb4ff]">IA</span></div>
            </div>
            <div className="mt-16 max-w-md lg:mt-28">
              <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[#aecaFF]">Conferência documental</p>
              <h1 className="mt-4 text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">Acesso à operação imobiliária.</h1>
              <p className="mt-5 max-w-sm text-base leading-7 text-slate-300">Entre com suas credenciais para continuar o trabalho da sua equipe.</p>
            </div>
          </div>
          <div className="mt-14 grid gap-3 sm:grid-cols-2 lg:mt-0 lg:grid-cols-1">
            <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-slate-200"><ShieldCheck className="h-5 w-5 shrink-0 text-[#8eb4ff]" />Acesso protegido por usuário</div>
            <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-slate-200"><FileCheck2 className="h-5 w-5 shrink-0 text-[#8eb4ff]" />Ambiente de conferência</div>
          </div>
        </section>
        <section className="flex items-center px-6 py-10 sm:px-12 lg:px-16">
          <div className="mx-auto w-full max-w-md">
            <p className="text-sm font-semibold text-[var(--primary)]">Acesso da organização</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-[#102a3a]">Entrar no ConferIA</h2>
            <p className="mt-3 text-sm leading-6 text-slate-500">Use o email ou usuário cadastrado pela sua organização.</p>
            <LoginForm error={error} />
            <p className="mt-8 text-center text-xs leading-5 text-slate-400">ConferIA · Conferência documental imobiliária</p>
          </div>
        </section>
      </div>
    </main>
  );
}
