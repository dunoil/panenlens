import { useRef, useState } from "react";
import type { HistoryEntry } from "../lib/types";
import { diagnoseLeafPhoto } from "../lib/ai";
import { prepareImage, type PreparedImage } from "../lib/image";
import { newId, saveHistoryEntry, updateHistoryEntry } from "../lib/history";
import { firebaseConfigured } from "../lib/firebase";
import { DiagnosisCard } from "../components/DiagnosisCard";
import { Icon } from "../components/Icon";

export function DiagnoseView() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [prepared, setPrepared] = useState<PreparedImage | null>(null);
  const [entry, setEntry] = useState<HistoryEntry | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    setEntry(null);
    try {
      setPrepared(await prepareImage(file));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function runDiagnosis() {
    if (!prepared) return;
    setBusy(true);
    setError(null);
    try {
      const { diagnosis, meta } = await diagnoseLeafPhoto(
        prepared.base64,
        prepared.mimeType,
      );
      const newEntry: HistoryEntry = {
        id: newId(),
        createdAt: Date.now(),
        imageDataUrl: prepared.dataUrl,
        diagnosis,
        meta,
      };
      saveHistoryEntry(newEntry);
      setEntry(newEntry);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  function handleActionResult(id: string, patch: Partial<HistoryEntry>) {
    updateHistoryEntry(id, patch);
    setEntry((prev) => (prev && prev.id === id ? { ...prev, ...patch } : prev));
  }

  return (
    <div className="space-y-5">
      {/* Hero / uploader */}
      <section className="overflow-hidden rounded-3xl bg-leaf-900 text-white shadow-lift">
        <div className="relative p-6 sm:p-8">
          <div
            className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full bg-leaf-500/25 blur-2xl"
            aria-hidden="true"
          />
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-leaf-300">
            AI plant doctor
          </p>
          <h2 className="mt-2 max-w-md text-2xl font-extrabold leading-tight sm:text-3xl">
            Photograph a sick leaf.
            <br />
            Get a treatment plan in seconds.
          </h2>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-leaf-100/85">
            Cloud Gemini reads the photo and writes the diagnosis. Then Gemini
            Nano — on your own device — explains it simply, translates it, and
            answers questions, even with no signal in the field.
          </p>

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              void onFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />

          {!prepared ? (
            <button
              onClick={() => fileRef.current?.click()}
              className="mt-5 inline-flex items-center gap-2.5 rounded-full bg-harvest-400 px-6 py-3 text-base font-extrabold text-leaf-950 shadow-lift transition hover:bg-harvest-300"
            >
              <Icon name="camera" className="h-5 w-5" />
              Take or upload a leaf photo
            </button>
          ) : (
            <div className="mt-5 flex flex-wrap items-center gap-4">
              <img
                src={prepared.dataUrl}
                alt="Leaf to diagnose"
                className="h-28 w-28 rounded-2xl object-cover ring-2 ring-white/40"
              />
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => void runDiagnosis()}
                  disabled={busy}
                  className="inline-flex items-center gap-2 rounded-full bg-harvest-400 px-6 py-3 text-base font-extrabold text-leaf-950 shadow-lift transition hover:bg-harvest-300 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Icon name="leaf" className="h-5 w-5" />
                  {busy ? "Diagnosing…" : "Diagnose this leaf"}
                </button>
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={busy}
                  className="text-sm font-bold text-leaf-100 underline decoration-leaf-400 underline-offset-4 hover:text-white disabled:opacity-60"
                >
                  Choose a different photo
                </button>
              </div>
            </div>
          )}

          {busy && (
            <p className="mt-4 flex items-center gap-2 text-sm font-medium text-leaf-100">
              <span className="h-2.5 w-2.5 animate-pulse-soft rounded-full bg-harvest-300" />
              Sending the photo to cloud Gemini for a full diagnosis…
            </p>
          )}
          {!firebaseConfigured && (
            <p className="mt-4 flex items-start gap-2 rounded-xl bg-white/10 px-3 py-2 text-sm font-medium text-harvest-100 ring-1 ring-white/20">
              <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0" />
              Demo mode: Firebase is not configured in this build, so diagnosis
              is disabled. Add your config via .env.local (see README) to enable
              live AI.
            </p>
          )}
        </div>
      </section>

      {error && (
        <p className="flex items-start gap-2 rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-800 ring-1 ring-red-200">
          <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </p>
      )}

      {entry && <DiagnosisCard entry={entry} onActionResult={handleActionResult} />}

      {/* How it works strip */}
      {!entry && (
        <section className="grid gap-3 sm:grid-cols-3">
          {[
            {
              icon: "cloud" as const,
              title: "1 · Cloud diagnosis",
              text: "Gemini in the cloud studies the photo — disease, severity, and a full treatment plan.",
            },
            {
              icon: "cpu" as const,
              title: "2 · On-device help",
              text: "Gemini Nano simplifies and translates the plan right on the device. Private, instant, offline.",
            },
            {
              icon: "route" as const,
              title: "3 · Visible router",
              text: "Every answer is badged with where it ran and how long it took. No black box.",
            },
          ].map((c) => (
            <div key={c.title} className="rounded-3xl bg-white p-5 shadow-card ring-1 ring-leaf-900/5">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-leaf-100 text-leaf-700">
                <Icon name={c.icon} className="h-5 w-5" />
              </span>
              <h3 className="mt-3 font-extrabold text-leaf-950">{c.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-leaf-950/65">{c.text}</p>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
