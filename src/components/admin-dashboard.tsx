"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Copy, KeyRound, Loader2, Plus, Power, RefreshCw, Users } from "lucide-react";
import Link from "next/link";

type ManagedUser = { id: string; name: string; email: string; role: string; active: boolean; must_change_password: boolean };
type ManagedProcess = { id: string; final_status: string; started_at: string; completed_at: string | null; profiles: { name: string } | null; process_documents: Array<{ name: string }> };
type AuditEvent = {
  id: string;
  event_type: string;
  entity_type: string;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  profiles: { name: string } | null;
};

export function AdminDashboard({ isMasterAdmin }: { isMasterAdmin: boolean }) {
  const [users, setUsers] = useState<ManagedUser[]>([]); const [processes, setProcesses] = useState<ManagedProcess[]>([]);
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true); const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null); const [filter, setFilter] = useState("ALL");
  const load = useCallback(async () => {
    setLoading(true);
    const requests: Promise<Response>[] = [fetch("/api/admin/users")];
    if (isMasterAdmin) requests.push(fetch("/api/processes"), fetch("/api/admin/audit"));
    const [u, p, a] = await Promise.all(requests);
    if (u.ok) setUsers((await u.json()).users);
    if (p?.ok) setProcesses((await p.json()).processes);
    if (a?.ok) setEvents((await a.json()).events);
    setLoading(false);
  }, [isMasterAdmin]);
  useEffect(() => { void load(); const timer = window.setInterval(load, 15000); return () => window.clearInterval(timer); }, [load]);
  const visible = useMemo(() => filter === "ALL" ? processes : processes.filter((process) => process.final_status === filter), [filter, processes]);
  const count = (status: string) => processes.filter((process) => process.final_status === status).length;
  const inProgressProcesses = processes.filter((process) => process.final_status === "IN_PROGRESS");
  const finishedProcesses = processes.filter((process) => process.final_status !== "IN_PROGRESS");
  const documentsInProgress = inProgressProcesses.reduce((total, process) => total + process.process_documents.length, 0);
  const documentsAnalyzed = finishedProcesses.reduce((total, process) => total + process.process_documents.length, 0);
  const documentsTotal = processes.reduce((total, process) => total + process.process_documents.length, 0);
  async function createUser(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); const response = await fetch("/api/admin/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: form.get("name"), email: form.get("email") }) }); const payload = await response.json(); if (response.ok) { setTemporaryPassword(payload.temporaryPassword); event.currentTarget.reset(); await load(); } }
  async function userAction(id: string, action: string) { const response = await fetch(`/api/admin/users/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) }); const payload = await response.json(); if (payload.temporaryPassword) setTemporaryPassword(payload.temporaryPassword); await load(); }
  return <main className="min-h-screen bg-slate-50">
    <header className="border-b border-slate-200 bg-white"><div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4"><div><div className="text-lg font-bold">ConferIA Admin</div><div className="text-xs text-slate-500">Gestão operacional</div></div><div className="flex items-center gap-4"><Link href="/change-password" className="text-sm font-bold text-slate-600">Alterar minha senha</Link><Link href="/" className="text-sm font-bold text-blue-600">Nova conferência</Link></div></div></header>
    <div className="mx-auto max-w-7xl space-y-8 px-5 py-8">
      {isMasterAdmin ? <section><div className="flex items-center justify-between"><div><h1 className="text-2xl font-bold">Visão geral</h1><p className="mt-1 text-sm text-slate-500">Atividades e resultados da equipe.</p></div><button title="Atualizar" onClick={load} className="rounded-md border border-slate-200 bg-white p-2"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /></button></div><div className="mt-5 grid gap-3 sm:grid-cols-4"><Metric label="Documentos analisados" value={documentsAnalyzed} /><Metric label="Documentos em análise" value={documentsInProgress} /><Metric label="Documentos cadastrados" value={documentsTotal} /><Metric label="Processos em andamento" value={count("IN_PROGRESS")} /></div><div className="mt-3 grid gap-3 sm:grid-cols-4"><Metric label="Com pendências" value={count("PENDING_REVIEW")} /><Metric label="Conferidos" value={count("FULLY_CHECKED")} /><Metric label="Falhas" value={count("FAILED")} /><Metric label="Usuários ativos" value={users.filter((user) => user.active).length} /></div></section> : <section><div className="flex items-center justify-between"><div><h1 className="text-2xl font-bold">Gestão de usuários</h1><p className="mt-1 text-sm text-slate-500">Criação de acessos para novos analistas.</p></div><button title="Atualizar" onClick={load} className="rounded-md border border-slate-200 bg-white p-2"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /></button></div></section>}
      {isMasterAdmin ? <section className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
        <div className="border border-slate-200 bg-white p-5"><h2 className="font-bold">Documentos em análise agora</h2><p className="mt-1 text-sm text-slate-500">Atualiza automaticamente a cada 15 segundos.</p><div className="mt-4 divide-y divide-slate-100">{inProgressProcesses.length ? inProgressProcesses.map((process) => <div key={process.id} className="py-3"><div className="flex items-center justify-between gap-3"><div className="text-sm font-bold">{process.profiles?.name ?? "Usuário"}</div><div className="text-xs font-bold text-blue-600">{process.process_documents.length} documento(s)</div></div><div className="mt-1 text-xs text-slate-500">Iniciado em {new Date(process.started_at).toLocaleString("pt-BR")} · {durationLabel(process.started_at, process.completed_at)}</div><div className="mt-2 space-y-1">{process.process_documents.map((document) => <div key={`${process.id}-${document.name}`} className="truncate text-sm text-slate-700">{document.name}</div>)}</div></div>) : <div className="py-6 text-sm text-slate-500">Nenhum documento em análise neste momento.</div>}</div></div>
        <div className="border border-slate-200 bg-white p-5"><h2 className="font-bold">Log recente</h2><div className="mt-4 space-y-3">{events.slice(0, 8).map((event) => <div key={event.id} className="border-l-2 border-slate-200 pl-3"><div className="text-sm font-bold text-slate-800">{eventLabel(event.event_type)}</div><div className="text-xs text-slate-500">{event.profiles?.name ?? "Sistema"} · {new Date(event.created_at).toLocaleString("pt-BR")}{eventDurationLabel(event) ? ` · ${eventDurationLabel(event)}` : ""}</div></div>)}{events.length === 0 ? <div className="text-sm text-slate-500">Nenhum evento registrado ainda.</div> : null}</div></div>
      </section> : null}
      <section className="border border-slate-200 bg-white p-5"><div className="flex items-center gap-2"><Users className="h-5 w-5 text-blue-600" /><h2 className="font-bold">Usuários</h2></div>
        <form onSubmit={createUser} className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]"><input name="name" required placeholder="Nome" className="min-h-10 rounded-md border border-slate-300 px-3 text-sm" /><input name="email" required type="email" placeholder="Email" className="min-h-10 rounded-md border border-slate-300 px-3 text-sm" /><button className="inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-bold text-white"><Plus className="h-4 w-4" />Criar Analista</button></form>
        {temporaryPassword ? <div className="mt-4 flex items-center justify-between gap-3 border border-amber-200 bg-amber-50 p-3 text-sm"><div><strong>Senha temporária:</strong> <code>{temporaryPassword}</code><div className="text-xs text-amber-700">Copie agora. Ela não será exibida novamente.</div></div><button onClick={() => navigator.clipboard.writeText(temporaryPassword)} title="Copiar"><Copy className="h-4 w-4" /></button></div> : null}
        <div className="mt-4 divide-y divide-slate-100">{users.map((user) => <div key={user.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between"><div><div className="text-sm font-bold">{user.name}</div><div className="text-xs text-slate-500">{user.email} · {user.active ? "Ativo" : "Desativado"}{user.must_change_password ? " · Troca de senha pendente" : ""}</div></div>{isMasterAdmin && user.role !== "ADMIN" ? <div className="flex gap-2"><button onClick={() => userAction(user.id, "RESET_PASSWORD")} className="inline-flex items-center gap-1 rounded-md border px-2 py-1.5 text-xs font-bold"><KeyRound className="h-3.5 w-3.5" />Redefinir senha</button><button onClick={() => userAction(user.id, user.active ? "DEACTIVATE" : "ACTIVATE")} className="inline-flex items-center gap-1 rounded-md border px-2 py-1.5 text-xs font-bold"><Power className="h-3.5 w-3.5" />{user.active ? "Desativar" : "Ativar"}</button></div> : null}</div>)}</div>
      </section>
      {isMasterAdmin ? <section className="border border-slate-200 bg-white"><div className="flex items-center justify-between border-b p-5"><h2 className="font-bold">Processos da equipe</h2><select className="rounded-md border px-3 py-2 text-sm" value={filter} onChange={(event) => setFilter(event.target.value)}><option value="ALL">Todos</option><option value="IN_PROGRESS">Em andamento</option><option value="PENDING_REVIEW">Pendentes</option><option value="FULLY_CHECKED">Conferidos</option><option value="FAILED">Falhas</option></select></div>
        {loading ? <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div> : <div className="divide-y">{visible.map((process) => <div key={process.id} className="grid gap-3 p-4 sm:grid-cols-[180px_1fr_1fr_150px_100px]"><div><div className="text-sm font-bold">{process.profiles?.name ?? "Usuário"}</div><div className="text-xs text-slate-500">{new Date(process.started_at).toLocaleString("pt-BR")}</div></div><div>{process.process_documents.map((document) => <div key={document.name} className="truncate text-sm text-slate-700">{document.name}</div>)}</div><div className="text-sm font-bold text-slate-600">{durationLabel(process.started_at, process.completed_at)}</div><div className="text-sm font-bold text-slate-600">{statusLabel(process.final_status)}</div><Link href={`/admin/processes/${process.id}`} className="text-sm font-bold text-blue-600">Ver resultado</Link></div>)}</div>}
      </section> : null}
    </div>
  </main>;
}
function Metric({ label, value }: { label: string; value: number }) { return <div className="border border-slate-200 bg-white p-4"><div className="text-2xl font-bold">{value}</div><div className="mt-1 text-sm text-slate-500">{label}</div></div>; }
function statusLabel(status: string) { return ({ IN_PROGRESS: "Em andamento", PENDING_REVIEW: "Com pendências", FULLY_CHECKED: "Conferido", FAILED: "Falhou" } as Record<string, string>)[status] ?? status; }
function durationLabel(startedAt: string, completedAt: string | null) {
  const start = new Date(startedAt).getTime();
  const end = completedAt ? new Date(completedAt).getTime() : Date.now();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return "Tempo indisponível";
  return formatDuration(end - start);
}
function eventDurationLabel(event: AuditEvent) {
  const duration = typeof event.metadata?.durationMs === "number" ? event.metadata.durationMs : null;
  return duration == null ? "" : `Tempo: ${formatDuration(duration)}`;
}
function formatDuration(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.round(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes <= 0) return `${seconds}s`;
  return `${minutes}min ${seconds}s`;
}
function eventLabel(type: string) {
  return ({
    LOGIN: "Login realizado",
    USER_CREATED: "Usuário criado",
    USER_ACTIVATED: "Usuário ativado",
    USER_DEACTIVATED: "Usuário desativado",
    PASSWORD_RESET: "Senha redefinida",
    PROCESS_CREATED: "Processo criado",
    PROCESS_FINISHED: "Processo concluído",
    PROCESS_FAILED: "Processo com falha",
    REVIEW_APPROVED: "Item validado",
    REVIEW_REVOKED: "Validação desfeita",
  } as Record<string, string>)[type] ?? type;
}
