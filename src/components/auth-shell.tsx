import { Building2, LockKeyhole } from "lucide-react";

export function AuthShell({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-[var(--canvas)] p-3 sm:p-6 lg:p-8">
      <div className="mx-auto grid min-h-[calc(100vh-1.5rem)] max-w-6xl overflow-hidden rounded-xl border border-[var(--border)] bg-white shadow-[0_24px_70px_rgb(15_35_64_/_0.10)] sm:min-h-[calc(100vh-3rem)] lg:grid-cols-[0.9fr_1.1fr]">
        <section className="relative hidden flex-col justify-between overflow-hidden bg-[var(--navy-deep)] px-10 py-11 text-white lg:flex">
          <div className="absolute inset-x-0 top-0 h-1 bg-[var(--primary)]" />
          <Brand />
          <div className="max-w-sm">
            <LockKeyhole className="mb-6 h-7 w-7 text-blue-300" />
            <p className="text-3xl font-semibold leading-tight">Conferência documental com acesso protegido.</p>
            <p className="mt-4 text-sm leading-6 text-slate-300">Cada operação permanece vinculada à organização e ao usuário responsável.</p>
          </div>
          <p className="text-xs text-slate-400">ConferIA · Ambiente corporativo</p>
        </section>

        <section className="flex items-center px-6 py-10 sm:px-12 lg:px-20">
          <div className="mx-auto w-full max-w-md">
            <div className="mb-12 lg:hidden"><Brand dark /></div>
            <p className="text-sm font-semibold text-[var(--primary)]">{eyebrow}</p>
            <h1 className="mt-2 text-3xl font-semibold text-[var(--navy)]">{title}</h1>
            <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{description}</p>
            {children}
            <p className="mt-8 text-center text-xs text-slate-400">Acesso exclusivo para usuários autorizados</p>
          </div>
        </section>
      </div>
    </main>
  );
}

function Brand({ dark = false }: { dark?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-[var(--primary)] text-white shadow-[0_12px_28px_rgb(0_0_0_/_0.16)]">
        <Building2 className="h-5 w-5" />
      </div>
      <div className={`text-2xl font-bold ${dark ? "text-[var(--navy)]" : "text-white"}`}>Confer<span className={dark ? "text-[var(--primary)]" : "text-blue-300"}>IA</span></div>
    </div>
  );
}
