import type { AIRunMeta } from "../lib/types";
import { Icon } from "./Icon";

const DETERMINED_BY_NOTE: Record<AIRunMeta["determinedBy"], string> = {
  sdk: "Backend reported by the Firebase AI Logic SDK (response.inferenceSource).",
  mode: "Backend derived from the inference mode requested for this call.",
  availability:
    "Backend inferred from a Gemini Nano availability check run just before the call.",
};

/**
 * The visible inference router badge: every AI answer in PanenLens carries
 * one, showing where it ran (on-device Gemini Nano vs cloud Gemini) and how
 * long the call took.
 */
export function RouterBadge({ meta, className = "" }: { meta: AIRunMeta; className?: string }) {
  const onDevice = meta.backend === "on_device";
  return (
    <span
      title={`${meta.modelLabel} · ${DETERMINED_BY_NOTE[meta.determinedBy]}`}
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold tracking-wide ${
        onDevice
          ? "bg-leaf-100 text-leaf-800 ring-1 ring-leaf-300"
          : "bg-sky-100 text-sky-900 ring-1 ring-sky-300"
      } ${className}`}
    >
      <Icon name={onDevice ? "cpu" : "cloud"} className="h-3.5 w-3.5" strokeWidth={2.4} />
      {onDevice ? "On-device · Gemini Nano" : "Cloud · Gemini"}
      <span className="font-semibold opacity-70">
        {(meta.latencyMs / 1000).toFixed(meta.latencyMs < 1000 ? 2 : 1)}s
      </span>
    </span>
  );
}

/** Shown while an AI call is in flight, including Nano download progress. */
export function AIPendingNote({ downloadProgress }: { downloadProgress?: number | null }) {
  return (
    <div className="flex items-center gap-2 text-sm font-medium text-leaf-700">
      <span className="h-2.5 w-2.5 animate-pulse-soft rounded-full bg-leaf-500" />
      {downloadProgress != null && downloadProgress < 1 ? (
        <span>
          Preparing the on-device model… {Math.round(downloadProgress * 100)}%
          downloaded (one-time, then it works offline)
        </span>
      ) : (
        <span>Thinking… checking on-device first, cloud as backup.</span>
      )}
    </div>
  );
}
