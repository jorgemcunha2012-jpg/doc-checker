import { Info } from "lucide-react";

export function InfoTooltip({ text }: { text: string }) {
  return (
    <span className="group/info relative inline-flex align-middle">
      <button type="button" aria-label={text} className="inline-flex h-4 w-4 items-center justify-center rounded-full text-slate-400 outline-none hover:text-slate-700 focus-visible:ring-2 focus-visible:ring-blue-500">
        <Info className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
      <span role="tooltip" className="pointer-events-none absolute bottom-full left-1/2 z-40 mb-2 hidden w-64 -translate-x-1/2 rounded-md bg-slate-950 px-3 py-2 text-left text-[11px] font-medium leading-4 text-white shadow-xl group-hover/info:block group-focus-within/info:block">{text}</span>
    </span>
  );
}
