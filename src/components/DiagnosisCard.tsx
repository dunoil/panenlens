import { useState } from "react";
import type { Diagnosis, HistoryEntry, HybridAnswer, Severity } from "../lib/types";
import { askAboutDiagnosis, simplifyDiagnosis, translateDiagnosis } from "../lib/ai";
import { AIPendingNote, RouterBadge } from "./RouterBadge";
import { Icon } from "./Icon";

const SEVERITY_STYLE: Record<Severity, { label: string; classes: string }> = {
  low: { label: "Low severity", classes: "bg-leaf-100 text-leaf-800 ring-leaf-300" },
  moderate: { label: "Moderate severity", classes: "bg-harvest-100 text-harvest-700 ring-harvest-300" },
  high: { label: "High severity", classes: "bg-orange-100 text-orange-800 ring-orange-300" },
  critical: { label: "Critical severity", classes: "bg-red-100 text-red-800 ring-red-300" },
};

function StepList({ items, ordered = true }: { items: string[]; ordered?: boolean }) {
  if (items.length === 0) return <p className="text-sm text-leaf-950/50">—</p>;
  const Tag = ordered ? "ol" : "ul";
  return (
    <Tag className={`space-y-1.5 text-sm leading-relaxed ${ordered ? "" : "list-disc pl-5"}`}>
      {items.map((item, i) => (
        <li key={i} className="flex gap-2.5">
          {ordered && (
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-leaf-600 text-[11px] font-bold text-white">
              {i + 1}
            </span>
          )}
          <span className={ordered ? "" : "-ml-2.5"}>{item}</span>
        </li>
      ))}
    </Tag>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="mb-1.5 text-xs font-bold uppercase tracking-widest text-leaf-700">
        {title}
      </h4>
      {children}
    </div>
  );
}

type ActionKind = "simplify" | "translate" | "followup";

export function DiagnosisCard({
  entry,
  onActionResult,
}: {
  entry: HistoryEntry;
  /** Persist simplify/translate results back into history (optional in read-only contexts). */
  onActionResult?: (id: string, patch: Partial<HistoryEntry>) => void;
}) {
  const d: Diagnosis = entry.diagnosis;
  const severity = SEVERITY_STYLE[d.severity];

  const [busy, setBusy] = useState<ActionKind | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [followUp, setFollowUp] = useState<HybridAnswer | null>(null);

  const runProgress = (fraction: number) => setDownloadProgress(fraction);

  async function runAction(kind: ActionKind) {
    setError(null);
    setBusy(kind);
    setDownloadProgress(null);
    try {
      if (kind === "simplify") {
        const answer = await simplifyDiagnosis(d, runProgress);
        onActionResult?.(entry.id, { simplified: answer });
      } else if (kind === "translate") {
        const answer = await translateDiagnosis(d, runProgress);
        onActionResult?.(entry.id, { translated: answer });
      } else {
        const q = question.trim();
        if (!q) return;
        const answer = await askAboutDiagnosis(d, q, runProgress);
        setFollowUp(answer);
        setQuestion("");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
      setDownloadProgress(null);
    }
  }

  return (
    <article className="animate-rise overflow-hidden rounded-3xl bg-white shadow-card ring-1 ring-leaf-900/5">
      {/* Header */}
      <div className="flex gap-4 p-5 pb-4">
        <img
          src={entry.imageDataUrl}
          alt="Diagnosed leaf"
          className="h-24 w-24 shrink-0 rounded-2xl object-cover ring-1 ring-leaf-900/10"
        />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ${severity.classes}`}
            >
              {severity.label}
            </span>
            <span className="text-[11px] font-semibold text-leaf-950/50">
              {Math.round(d.confidence * 100)}% confidence
            </span>
          </div>
          <h3 className="mt-1.5 text-xl font-extrabold leading-tight text-leaf-950">
            {d.diseaseName}
          </h3>
          {d.latinName && (
            <p className="text-sm italic text-leaf-950/55">{d.latinName}</p>
          )}
          <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-harvest-600">
            <Icon name="zap" className="h-4 w-4" />
            {d.urgency}
          </p>
        </div>
      </div>

      <div className="px-5">
        <RouterBadge meta={entry.meta} />
        <p className="mt-1.5 text-[11px] leading-snug text-leaf-950/45">
          Photo diagnosis runs in the cloud — it needs full multimodal reasoning.
          The actions below run on-device first.
        </p>
      </div>

      {/* Body */}
      <div className="space-y-5 px-5 py-5">
        {d.visibleSymptoms.length > 0 && (
          <Section title="What we see">
            <StepList items={d.visibleSymptoms} ordered={false} />
          </Section>
        )}
        {d.likelyCauses.length > 0 && (
          <Section title="Likely causes">
            <StepList items={d.likelyCauses} ordered={false} />
          </Section>
        )}
        <Section title="Organic treatment — start here">
          <StepList items={d.treatmentOrganic} />
        </Section>
        {d.treatmentChemical.length > 0 && (
          <Section title="Chemical options — if needed">
            <StepList items={d.treatmentChemical} />
          </Section>
        )}
        <Section title="Prevent it next season">
          <StepList items={d.prevention} ordered={false} />
        </Section>
      </div>

      {/* On-device actions */}
      <div className="border-t border-leaf-100 bg-leaf-50/70 px-5 py-4">
        <p className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-leaf-700">
          <Icon name="cpu" className="h-4 w-4" />
          On-device actions · work offline
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => runAction("simplify")}
            disabled={busy !== null}
            className="inline-flex items-center gap-2 rounded-full bg-leaf-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-leaf-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Icon name="sparkles" className="h-4 w-4" />
            {busy === "simplify" ? "Simplifying…" : "Simplify"}
          </button>
          <button
            onClick={() => runAction("translate")}
            disabled={busy !== null}
            className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-bold text-leaf-800 ring-1 ring-leaf-300 transition hover:bg-leaf-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Icon name="languages" className="h-4 w-4" />
            {busy === "translate" ? "Translating…" : "Translate to Bahasa Indonesia"}
          </button>
        </div>

        {busy && (
          <div className="mt-3">
            <AIPendingNote downloadProgress={downloadProgress} />
          </div>
        )}
        {error && (
          <p className="mt-3 flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-800 ring-1 ring-red-200">
            <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </p>
        )}

        {entry.simplified && (
          <div className="mt-4 rounded-2xl bg-white p-4 ring-1 ring-leaf-200">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h5 className="text-sm font-extrabold text-leaf-900">In simple words</h5>
              <RouterBadge meta={entry.simplified.meta} />
            </div>
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{entry.simplified.text}</p>
          </div>
        )}

        {entry.translated && (
          <div className="mt-4 rounded-2xl bg-white p-4 ring-1 ring-leaf-200">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h5 className="text-sm font-extrabold text-leaf-900">Bahasa Indonesia</h5>
              <RouterBadge meta={entry.translated.meta} />
            </div>
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{entry.translated.text}</p>
          </div>
        )}

        {/* Follow-up */}
        <form
          className="mt-4 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void runAction("followup");
          }}
        >
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask a follow-up… e.g. Is it safe for my other plants?"
            className="min-w-0 flex-1 rounded-full bg-white px-4 py-2.5 text-sm ring-1 ring-leaf-200 outline-none placeholder:text-leaf-950/40 focus:ring-2 focus:ring-leaf-500"
          />
          <button
            type="submit"
            disabled={busy !== null || !question.trim()}
            aria-label="Ask follow-up"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-leaf-600 text-white transition hover:bg-leaf-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Icon name="send" className="h-4 w-4" />
          </button>
        </form>
        {followUp && (
          <div className="mt-3 rounded-2xl bg-white p-4 ring-1 ring-leaf-200">
            <div className="mb-2 flex items-center justify-end">
              <RouterBadge meta={followUp.meta} />
            </div>
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{followUp.text}</p>
          </div>
        )}

        <p className="mt-4 text-[11px] leading-snug text-leaf-950/45">
          AI guidance, not a substitute for a local agricultural extension
          officer (PPL). Always follow label instructions and local regulations
          for any chemical treatment.
        </p>
      </div>
    </article>
  );
}
