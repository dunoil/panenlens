import { useState } from "react";
import type { HistoryEntry } from "../lib/types";
import {
  clearHistory,
  deleteHistoryEntry,
  loadHistory,
  updateHistoryEntry,
} from "../lib/history";
import { DiagnosisCard } from "../components/DiagnosisCard";
import { RouterBadge } from "../components/RouterBadge";
import { Icon } from "../components/Icon";

export function HistoryView() {
  const [entries, setEntries] = useState<HistoryEntry[]>(() => loadHistory());
  const [openId, setOpenId] = useState<string | null>(null);

  function handleActionResult(id: string, patch: Partial<HistoryEntry>) {
    updateHistoryEntry(id, patch);
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  }

  if (entries.length === 0) {
    return (
      <section className="rounded-3xl bg-white p-8 text-center shadow-card ring-1 ring-leaf-900/5">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-leaf-100 text-leaf-600">
          <Icon name="history" className="h-7 w-7" />
        </span>
        <h2 className="mt-3 text-lg font-extrabold text-leaf-950">No diagnoses yet</h2>
        <p className="mx-auto mt-1 max-w-sm text-sm leading-relaxed text-leaf-950/60">
          Your past diagnoses will be saved here — on this device only, in your
          browser's local storage. No account, nothing uploaded, so your field
          history is available even offline.
        </p>
      </section>
    );
  }

  const open = entries.find((e) => e.id === openId) ?? null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-extrabold text-leaf-950">
          Diagnosis history
          <span className="ml-2 text-sm font-semibold text-leaf-950/45">
            {entries.length} saved · on-device only
          </span>
        </h2>
        <button
          onClick={() => {
            clearHistory();
            setEntries([]);
            setOpenId(null);
          }}
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold text-red-700 ring-1 ring-red-200 transition hover:bg-red-50"
        >
          <Icon name="trash" className="h-3.5 w-3.5" />
          Clear all
        </button>
      </div>

      {open ? (
        <div className="space-y-3">
          <button
            onClick={() => setOpenId(null)}
            className="text-sm font-bold text-leaf-700 underline decoration-leaf-300 underline-offset-4 hover:text-leaf-900"
          >
            ← Back to all diagnoses
          </button>
          <DiagnosisCard entry={open} onActionResult={handleActionResult} />
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {entries.map((e) => (
            <article
              key={e.id}
              className="flex gap-3 rounded-3xl bg-white p-3 shadow-card ring-1 ring-leaf-900/5"
            >
              <button onClick={() => setOpenId(e.id)} className="flex min-w-0 flex-1 gap-3 text-left">
                <img
                  src={e.imageDataUrl}
                  alt=""
                  className="h-20 w-20 shrink-0 rounded-2xl object-cover ring-1 ring-leaf-900/10"
                />
                <span className="min-w-0">
                  <span className="block truncate font-extrabold text-leaf-950">
                    {e.diagnosis.diseaseName}
                  </span>
                  <span className="block text-xs font-medium text-leaf-950/50">
                    {new Date(e.createdAt).toLocaleString(undefined, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </span>
                  <span className="mt-1.5 block">
                    <RouterBadge meta={e.meta} />
                  </span>
                </span>
              </button>
              <button
                onClick={() => setEntries(deleteHistoryEntry(e.id))}
                aria-label="Delete this diagnosis"
                className="self-start rounded-full p-1.5 text-leaf-950/35 transition hover:bg-red-50 hover:text-red-600"
              >
                <Icon name="trash" className="h-4 w-4" />
              </button>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
