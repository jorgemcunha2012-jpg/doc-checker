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
    <main className="flex min-h-screen flex-col bg-[#f7f8fa]">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center px-5 sm:px-8">
          <Brand />
        </div>
      </header>

      <section className="flex flex-1 items-center justify-center px-5 py-12 sm:px-8">
        <div className="w-full max-w-[420px]">
          <div className="mb-7">
            <p className="text-xs font-semibold uppercase text-[var(--primary)]">{eyebrow}</p>
            <h1 className="mt-2 text-[28px] font-semibold leading-tight text-[var(--navy)]">{title}</h1>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{description}</p>
          </div>
          <div className="border-t border-slate-200 pt-1">
            {children}
          </div>
          <p className="mt-7 text-xs text-slate-400">Acesso restrito a usuários autorizados.</p>
        </div>
      </section>
    </main>
  );
}

function Brand() {
  return (
    <div className="text-lg font-bold text-[var(--navy)]">Confer<span className="text-[var(--primary)]">IA</span></div>
  );
}
