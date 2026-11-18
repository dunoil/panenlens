import { useEffect, useState } from "react";
import { DiagnoseView } from "./views/DiagnoseView";
import { TriageView } from "./views/TriageView";
import { HistoryView } from "./views/HistoryView";
import { AboutView } from "./views/AboutView";
import { Icon, type IconName } from "./components/Icon";
import {
  checkNanoAvailability,
  NANO_STATUS_LABEL,
  type NanoAvailability,
} from "./lib/nano";
import { getFirebaseRuntime } from "./lib/firebase";

type Tab = "diagnose" | "triage" | "history" | "about";

const TABS: { id: Tab; label: string; icon: IconName }[] = [
  { id: "diagnose", label: "Diagnose", icon: "camera" },
  { id: "triage", label: "Triage", icon: "message" },
  { id: "history", label: "History", icon: "history" },
  { id: "about", label: "How it works", icon: "info" },
];

function NanoChip() {
  const [nano, setNano] = useState<NanoAvailability | null>(null);
  useEffect(() => {
    let alive = true;
    void checkNanoAvailability().then((s) => {
      if (alive) setNano(s);
    });
    return () => {
      alive = false;
    };
  }, []);

  const ready = nano === "available";
  return (
    <span
      title={nano ? NANO_STATUS_LABEL[nano] : "Checking on-device AI…"}
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ${
        ready
          ? "bg-leaf-100 text-leaf-800 ring-leaf-300"
          : "bg-white/70 text-leaf-950/55 ring-leaf-200"
      }`}
    >
      <Icon name="cpu" className="h-3.5 w-3.5" strokeWidth={2.4} />
      <span className="hidden sm:inline">
        {nano === null
          ? "Checking Nano…"
          : ready
            ? "Gemini Nano ready"
            : "Cloud mode"}
      </span>
      <span className="sm:hidden">{ready ? "Nano ready" : "Cloud"}</span>
    </span>
  );
}

export default function App() {
  const [tab, setTab] = useState<Tab>("diagnose");

  // Initialize Firebase (app + App Check + AI Logic) once on load so config
  // problems surface early in the About panel instead of at first AI call.
  useEffect(() => {
    getFirebaseRuntime();
  }, []);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-4 pb-24 sm:px-6 sm:pb-10">
      {/* Header */}
      <header className="flex items-center justify-between gap-3 py-4">
        <div className="flex items-center gap-2.5">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-leaf-600 text-white shadow-card">
            <Icon name="sprout" className="h-6 w-6" />
          </span>
          <div>
            <h1 className="text-xl font-extrabold leading-none tracking-tight text-leaf-950">
              PanenLens
            </h1>
            <p className="mt-1 text-xs font-semibold text-leaf-950/55">
              Plant doctor for smallholder farmers
            </p>
          </div>
        </div>
        <NanoChip />
      </header>

      {/* Desktop tab bar */}
      <nav className="mb-5 hidden gap-1.5 sm:flex" aria-label="Main">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold transition ${
              tab === t.id
                ? "bg-leaf-900 text-white shadow-card"
                : "bg-white/70 text-leaf-900 ring-1 ring-leaf-200 hover:bg-white"
            }`}
          >
            <Icon name={t.icon} className="h-4 w-4" />
            {t.label}
          </button>
        ))}
      </nav>

      <main className="flex-1">
        {tab === "diagnose" && <DiagnoseView />}
        {tab === "triage" && <TriageView />}
        {tab === "history" && <HistoryView />}
        {tab === "about" && <AboutView />}
      </main>

      <footer className="mt-8 pb-2 text-center text-xs leading-relaxed text-leaf-950/45">
        PanenLens · Built with Firebase AI Logic hybrid inference for
        #BuildHybridAI 2026.
        <br />
        Cloud Gemini diagnoses · on-device Gemini Nano explains, translates and
        triages.
      </footer>

      {/* Mobile bottom navigation */}
      <nav
        className="fixed inset-x-0 bottom-0 z-20 border-t border-leaf-100 bg-white/92 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden"
        aria-label="Main"
      >
        <div className="mx-auto grid max-w-3xl grid-cols-4">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex flex-col items-center gap-1 py-2.5 text-[11px] font-bold ${
                tab === t.id ? "text-leaf-700" : "text-leaf-950/45"
              }`}
            >
              <Icon name={t.icon} className="h-5 w-5" strokeWidth={tab === t.id ? 2.4 : 2} />
              {t.label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
