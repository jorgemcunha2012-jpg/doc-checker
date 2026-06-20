import clsx from "clsx";
import type { ValidationStatus } from "@/domain/validation";
import { statusCopy } from "@/lib/validation-copy";

const statusClasses: Record<ValidationStatus, string> = {
  MATCH: "border-emerald-200 bg-emerald-50 text-emerald-700",
  DIVERGENCE: "border-rose-200 bg-rose-50 text-rose-700",
  NOT_FOUND: "border-amber-200 bg-amber-50 text-amber-800",
  NOT_APPLICABLE: "border-slate-200 bg-slate-50 text-slate-600",
  REVIEW_REQUIRED: "border-sky-200 bg-sky-50 text-sky-700",
};

export function StatusBadge({ status }: { status: ValidationStatus }) {
  return (
    <span className={clsx("inline-flex min-w-32 items-center justify-center rounded-full border px-3 py-1 text-xs font-semibold", statusClasses[status])}>
      {statusCopy[status]}
    </span>
  );
}
