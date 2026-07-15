"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Copy, KeyRound, Loader2, Plus, Power, RefreshCw, Users } from "lucide-react";
import Link from "next/link";
import type { DocumentSource, ExtractionQualityReport } from "@/domain/validation";
import { processCode } from "@/lib/process-code";
import { extractionAlert } from "@/lib/extraction-alerts";

type ManagedUser = { id: string; name: string; email: string; role: string; active: boolean; must_change_password: boolean; is_master_admin?: boolean };
type ManagedProcess = {
  id: string;
  processing_status: string;
  final_status: string;
  error?: string | null;
  summary?: { extractionQualityBySource?: Partial<Record<DocumentSource, ExtractionQualityReport>> } | null;
  started_at: string;
  completed_at: string | null;
  profiles: { name: string } | null;
  process_documents: Array<{ name: string }>;
};
type AuditEvent = {
  id: string;
  event_type: string;
  entity_type: string;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  profiles: { name: string } | null;
};

export function AdminDashboard({ isMasterAdmin, embedded = false }: { isMasterAdmin: boolean; embedded?: boolean }) {
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
  const operationalAlerts = useMemo(
    () => processes.flatMap((process) => {
      const anomaly = processAnomaly(process);
      return anomaly ? [{ process, ...anomaly }] : [];
    }).sort((left, right) => right.durationMs - left.durationMs),
    [processes],
  );
  const visible = useMemo(
    () => filter === "ALL"
      ? processes
      : filter === "ANOMALY"
        ? processes.filter((process) => Boolean(processAnomaly(process)))
        : processes.filter((process) => process.final_status === filter),
    [filter, processes],
  );
  const count = (status: string) => processes.filter((process) => process.final_status === status).length;
  const inProgressProcesses = processes.filter(
    (process) => process.final_status === "IN_PROGRESS" && processDurationMs(process) < 30 * 60 * 1000,
  );
  const finishedProcesses = processes.filter((process) => process.final_status !== "IN_PROGRESS");
  const documentsInProgress = inProgressProcesses.reduce((total, process) => total + process.process_documents.length, 0);
  const documentsAnalyzed = finishedProcesses.reduce((total, process) => total + process.process_documents.length, 0);
  const documentsTotal = processes.reduce((total, process) => total + process.process_documents.length, 0);
  const qualityMetrics = extractionQualityMetrics(processes);
  async function createUser(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); const response = await fetch("/api/admin/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: form.get("name"), email: form.get("email") }) }); const payload = await response.json(); if (response.ok) { setTemporaryPassword(payload.temporaryPassword); event.currentTarget.reset(); await load(); } }
  async function userAction(id: string, action: string) { const response = await fetch(`/api/admin/users/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) }); const payload = await response.json(); if (payload.temporaryPassword) setTemporaryPassword(payload.temporaryPassword); await load(); }
  return <main className={embedded ? "" : "min-h-screen bg-slate-50"}>
    {!embedded ? <header className="border-b border-slate-200 bg-white"><div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4"><div><div className="text-lg font-bold">ConferIA Admin</div><div className="text-xs text-slate-500">Gestão operacional</div></div><div className="flex items-center gap-4"><Link href={{ pathname: "/history" }} className="text-sm font-bold text-slate-600">Histórico</Link><Link href="/change-password" className="text-sm font-bold text-slate-600">Alterar minha senha</Link><Link href="/" className="text-sm font-bold text-blue-600">Nova conferência</Link></div></div></header> : null}
    <div className={`mx-auto max-w-7xl space-y-8 ${embedded ? "" : "px-5 py-8"}`}>
      {isMasterAdmin ? <section><div className="flex items-center justify-between"><div><h1 className="text-2xl font-bold">Visão geral</h1><p className="mt-1 text-sm text-slate-500">Atividades e resultados da equipe.</p></div><button title="Atualizar" onClick={load} className="rounded-md border border-slate-200 bg-white p-2"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /></button></div><div className="mt-5 grid gap-3 sm:grid-cols-5"><Metric label="Documentos analisados" value={documentsAnalyzed} /><Metric label="Documentos em análise" value={documentsInProgress} /><Metric label="Documentos cadastrados" value={documentsTotal} /><Metric label="Processos em andamento" value={inProgressProcesses.length} /><Metric label="Alertas operacionais" value={operationalAlerts.length} alert={operationalAlerts.length > 0} /></div><div className="mt-3 grid gap-3 sm:grid-cols-4"><Metric label="Com pendências" value={count("PENDING_REVIEW")} /><Metric label="Conferidos" value={count("FULLY_CHECKED")} /><Metric label="Falhas" value={count("FAILED")} /><Metric label="Usuários ativos" value={users.filter((user) => user.active).length} /></div><div className="mt-3 grid gap-3 sm:grid-cols-4"><Metric label="Campos críticos ausentes" value={qualityMetrics.missingCritical} alert={qualityMetrics.missingCritical > 0} /><Metric label="Baixa confiança crítica" value={qualityMetrics.lowConfidence} alert={qualityMetrics.lowConfidence > 0} /><Metric label="Conflitos internos críticos" value={qualityMetrics.ambiguous} alert={qualityMetrics.ambiguous > 0} /><Metric label="Recuperados automaticamente" value={qualityMetrics.recovered + qualityMetrics.deterministic} /></div></section> : <section><div className="flex items-center justify-between"><div><h1 className="text-2xl font-bold">Gestão de usuários</h1><p className="mt-1 text-sm text-slate-500">Criação de acessos para novos analistas.</p></div><button title="Atualizar" onClick={load} className="rounded-md border border-slate-200 bg-white p-2"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /></button></div></section>}
      {isMasterAdmin && operationalAlerts.length ? <section className="border border-amber-300 bg-amber-50">
        <div className="flex items-start gap-3 border-b border-amber-200 p-5">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
          <div><h2 className="font-bold text-amber-950">Alertas operacionais</h2><p className="mt-1 text-sm text-amber-800">Processos com falha, duração acima do esperado ou possível travamento.</p></div>
        </div>
        <div className="divide-y divide-amber-200">
          {operationalAlerts.slice(0, 10).map(({ process, label, severity, durationMs }) => <div key={process.id} className="grid gap-3 p-4 sm:grid-cols-[170px_1fr_150px_110px] sm:items-center">
            <div><div className="text-xs font-bold text-amber-800">{processCode(process.id)}</div><div className="text-sm font-bold text-slate-950">{process.profiles?.name ?? "Usuário"}</div><div className="text-xs text-slate-600">{new Date(process.started_at).toLocaleString("pt-BR")}</div></div>
            <div><div className={`text-sm font-bold ${severity === "critical" ? "text-rose-700" : "text-amber-800"}`}>{label}</div><div className="mt-1 truncate text-xs text-slate-600">{process.process_documents.map((document) => document.name).join(", ") || "Sem documentos registrados"}</div></div>
            <div className="text-sm font-bold text-slate-700">{formatDuration(durationMs)}</div>
            <Link href={`/admin/processes/${process.id}`} className="text-sm font-bold text-blue-700">Investigar</Link>
          </div>)}
        </div>
      </section> : null}
      {isMasterAdmin ? <section className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
        <div className="border border-slate-200 bg-white p-5"><h2 className="font-bold">Documentos em análise agora</h2><p className="mt-1 text-sm text-slate-500">Atualiza automaticamente a cada 15 segundos.</p><div className="mt-4 divide-y divide-slate-100">{inProgressProcesses.length ? inProgressProcesses.map((process) => <div key={process.id} className="py-3"><div className="flex items-center justify-between gap-3"><div><div className="text-xs font-bold text-[#0f8f88]">{processCode(process.id)}</div><div className="text-sm font-bold">{process.profiles?.name ?? "Usuário"}</div></div><div className="text-xs font-bold text-blue-600">{process.process_documents.length} documento(s)</div></div><div className="mt-1 text-xs text-slate-500">Iniciado em {new Date(process.started_at).toLocaleString("pt-BR")} · {durationLabel(process.started_at, process.completed_at)}</div><div className="mt-2 space-y-1">{process.process_documents.map((document) => <div key={`${process.id}-${document.name}`} className="truncate text-sm text-slate-700">{document.name}</div>)}</div></div>) : <div className="py-6 text-sm text-slate-500">Nenhum documento em análise neste momento.</div>}</div></div>
        <div className="border border-slate-200 bg-white p-5"><h2 className="font-bold">Log recente</h2><div className="mt-4 space-y-3">{events.slice(0, 8).map((event) => <div key={event.id} className="border-l-2 border-slate-200 pl-3"><div className="text-sm font-bold text-slate-800">{eventLabel(event.event_type)}</div><div className="text-xs text-slate-500">{event.profiles?.name ?? "Sistema"} · {new Date(event.created_at).toLocaleString("pt-BR")}{eventDurationLabel(event) ? ` · ${eventDurationLabel(event)}` : ""}</div></div>)}{events.length === 0 ? <div className="text-sm text-slate-500">Nenhum evento registrado ainda.</div> : null}</div></div>
      </section> : null}
      <section className="border border-slate-200 bg-white p-5"><div className="flex items-center gap-2"><Users className="h-5 w-5 text-blue-600" /><h2 className="font-bold">Usuários</h2></div>
        <form onSubmit={createUser} className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]"><input name="name" required placeholder="Nome" className="min-h-10 rounded-md border border-slate-300 px-3 text-sm" /><input name="email" required type="email" placeholder="Email" className="min-h-10 rounded-md border border-slate-300 px-3 text-sm" /><button className="inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-bold text-white"><Plus className="h-4 w-4" />Criar Analista</button></form>
        {temporaryPassword ? <div className="mt-4 flex items-center justify-between gap-3 border border-amber-200 bg-amber-50 p-3 text-sm"><div><strong>Senha temporária:</strong> <code>{temporaryPassword}</code><div className="text-xs text-amber-700">Copie agora. Ela não será exibida novamente.</div></div><button onClick={() => navigator.clipboard.writeText(temporaryPassword)} title="Copiar"><Copy className="h-4 w-4" /></button></div> : null}
        <div className="mt-4 divide-y divide-slate-100">{users.map((user) => <div key={user.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between"><div><div className="text-sm font-bold">{user.name}{user.is_master_admin ? " · Master" : ""}</div><div className="text-xs text-slate-500">{user.email} · {user.active ? "Ativo" : "Desativado"}{user.must_change_password ? " · Troca de senha pendente" : ""}</div></div>{(isMasterAdmin || !user.is_master_admin) ? <div className="flex gap-2"><button onClick={() => userAction(user.id, "RESET_PASSWORD")} className="inline-flex items-center gap-1 rounded-md border px-2 py-1.5 text-xs font-bold"><KeyRound className="h-3.5 w-3.5" />Redefinir senha</button>{isMasterAdmin && user.role !== "ADMIN" ? <button onClick={() => userAction(user.id, user.active ? "DEACTIVATE" : "ACTIVATE")} className="inline-flex items-center gap-1 rounded-md border px-2 py-1.5 text-xs font-bold"><Power className="h-3.5 w-3.5" />{user.active ? "Desativar" : "Ativar"}</button> : null}</div> : null}</div>)}</div>
      </section>
      {isMasterAdmin ? <section className="border border-slate-200 bg-white"><div className="flex items-center justify-between border-b p-5"><h2 className="font-bold">Processos da equipe</h2><select className="rounded-md border px-3 py-2 text-sm" value={filter} onChange={(event) => setFilter(event.target.value)}><option value="ALL">Todos</option><option value="ANOMALY">Com alerta</option><option value="IN_PROGRESS">Em andamento</option><option value="PENDING_REVIEW">Pendentes</option><option value="FULLY_CHECKED">Conferidos</option><option value="FAILED">Falhas</option></select></div>
        {loading ? <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div> : <div className="divide-y">{visible.map((process) => { const anomaly = processAnomaly(process); return <div key={process.id} className="grid gap-3 p-4 sm:grid-cols-[180px_1fr_1fr_150px_100px]"><div><div className="text-xs font-bold text-[#0f8f88]">{processCode(process.id)}</div><div className="text-sm font-bold">{process.profiles?.name ?? "Usuário"}</div><div className="text-xs text-slate-500">{new Date(process.started_at).toLocaleString("pt-BR")}</div></div><div>{process.process_documents.map((document) => <div key={document.name} className="truncate text-sm text-slate-700">{document.name}</div>)}</div><div><div className="text-sm font-bold text-slate-600">{durationLabel(process.started_at, process.completed_at)}</div>{anomaly ? <div className={`mt-1 text-xs font-bold ${anomaly.severity === "critical" ? "text-rose-700" : "text-amber-700"}`}>{anomaly.label}</div> : null}</div><div className="text-sm font-bold text-slate-600">{statusLabel(process.final_status)}</div><Link href={`/admin/processes/${process.id}`} className="text-sm font-bold text-blue-600">Ver resultado</Link></div>; })}</div>}
      </section> : null}
    </div>
  </main>;
}
function Metric({ label, value, alert = false }: { label: string; value: number; alert?: boolean }) { return <div className={`border p-4 ${alert ? "border-amber-300 bg-amber-50" : "border-slate-200 bg-white"}`}><div className={`text-2xl font-bold ${alert ? "text-amber-800" : ""}`}>{value}</div><div className={`mt-1 text-sm ${alert ? "font-semibold text-amber-800" : "text-slate-500"}`}>{label}</div></div>; }
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
function processAnomaly(process: ManagedProcess) {
  const durationMs = processDurationMs(process);
  if (!Number.isFinite(durationMs)) return null;
  if (process.process_documents.length === 0) {
    return { label: "Processo sem documentos registrados", severity: "critical" as const, durationMs };
  }
  if (process.final_status === "FAILED") {
    return { label: process.error ? `Falha: ${process.error}` : "Processo finalizado com falha", severity: "critical" as const, durationMs };
  }
  if (process.final_status === "IN_PROGRESS" && durationMs >= 30 * 60 * 1000) {
    return { label: "Possível processo travado", severity: "critical" as const, durationMs };
  }
  const alert = extractionAlert(process);
  if (alert) {
    return {
      label: `${alert.label} · ${alert.detail}`,
      severity: alert.severity,
      durationMs,
    };
  }
  if (durationMs >= 10 * 60 * 1000) {
    return {
      label: process.final_status === "IN_PROGRESS" ? "Processamento acima do esperado" : "Processo concluído lentamente",
      severity: "warning" as const,
      durationMs,
    };
  }
  const incompleteSources = Object.values(process.summary?.extractionQualityBySource ?? {})
    .filter((report) => report?.status === "PARTIAL" || report?.status === "FAILED");
  if (incompleteSources.length) {
    const lowestCoverage = Math.min(...incompleteSources.map((report) => report?.coverage ?? 0));
    const missing = incompleteSources.reduce((total, report) => total + (report?.missingCriticalFields?.length ?? 0), 0);
    const lowConfidence = incompleteSources.reduce((total, report) => total + (report?.lowConfidenceCriticalFields?.length ?? 0), 0);
    const ambiguous = incompleteSources.reduce((total, report) => total + (report?.ambiguousCriticalFields?.length ?? 0), 0);
    return {
      label: `Extração incompleta em ${incompleteSources.length} fonte(s) · cobertura ${lowestCoverage}% · ausentes ${missing} · baixa confiança ${lowConfidence} · conflitos ${ambiguous}`,
      severity: "warning" as const,
      durationMs,
    };
  }
  return null;
}

function extractionQualityMetrics(processes: ManagedProcess[]) {
  return processes.reduce(
    (metrics, process) => {
      for (const report of Object.values(process.summary?.extractionQualityBySource ?? {})) {
        metrics.missingCritical += report?.missingCriticalFields?.length ?? 0;
        metrics.lowConfidence += report?.lowConfidenceCriticalFields?.length ?? 0;
        metrics.ambiguous += report?.ambiguousCriticalFields?.length ?? 0;
        metrics.recovered += report?.recoveredFields?.length ?? 0;
        metrics.deterministic += report?.deterministicFields?.length ?? 0;
      }
      return metrics;
    },
    { missingCritical: 0, lowConfidence: 0, ambiguous: 0, recovered: 0, deterministic: 0 },
  );
}
function processDurationMs(process: ManagedProcess) {
  const start = new Date(process.started_at).getTime();
  const end = process.completed_at ? new Date(process.completed_at).getTime() : Date.now();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return Number.NaN;
  return end - start;
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
    PROCESS_SLOW: "Processo concluído acima do tempo esperado",
    PROCESS_FAILED: "Processo com falha",
    REVIEW_APPROVED: "Item validado",
    REVIEW_REVOKED: "Validação desfeita",
    LEARNING_RULE_RECORDED: "Aprendizado supervisionado registrado",
  } as Record<string, string>)[type] ?? type;
}
