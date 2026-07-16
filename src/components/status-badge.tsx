import clsx from "clsx";
import type { ValidationStatus } from "@/domain/validation";
import { statusCopy } from "@/lib/validation-copy";
import { InfoTooltip } from "./info-tooltip";

const statusClasses: Record<ValidationStatus, string> = {
  MATCH: "border-emerald-200 bg-emerald-50 text-emerald-700",
  DIVERGENCE: "border-rose-200 bg-rose-50 text-rose-700",
  NOT_FOUND: "border-amber-200 bg-amber-50 text-amber-800",
  NOT_APPLICABLE: "border-slate-200 bg-slate-50 text-slate-600",
  REVIEW_REQUIRED: "border-cyan-200 bg-cyan-50 text-cyan-700",
  SOURCE_UNREADABLE: "border-violet-200 bg-violet-50 text-violet-700",
};

export function StatusBadge({ status }: { status: ValidationStatus }) {
  return (
    <div className="flex items-center gap-1">
      <span className={clsx("inline-flex min-w-32 items-center justify-center rounded-md border px-3 py-1.5 text-xs font-bold", statusClasses[status])}>{statusCopy[status]}</span>
      <InfoTooltip text={statusDescriptions[status]} />
    </div>
  );
}

const statusDescriptions: Record<ValidationStatus, string> = {
  MATCH: "As fontes participantes apresentaram valores equivalentes depois da normalização. Isso indica concordância dos dados, não autenticidade jurídica do documento.",
  DIVERGENCE: "Duas ou mais fontes apresentaram valores diferentes de forma relevante. O diagnóstico ao lado aponta as fontes envolvidas.",
  NOT_FOUND: "O campo era esperado, mas não foi localizado em uma ou mais fontes.",
  NOT_APPLICABLE: "Este campo não se aplica à fonte ou ao tipo de documento enviado.",
  REVIEW_REQUIRED: "A comparação não pôde ser concluída automaticamente, por ausência, baixa confiança, conflito interno ou diferença pequena.",
  SOURCE_UNREADABLE: "A fonte foi enviada, mas não pôde ser interpretada com segurança, por exemplo por arquivo corrompido ou OCR indisponível.",
};
