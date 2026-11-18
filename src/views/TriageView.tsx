import { useEffect, useRef, useState } from "react";
import type { ChatMessage } from "../lib/types";
import { triageChat, type TriageTurn } from "../lib/ai";
import { newId } from "../lib/history";
import { AIPendingNote, RouterBadge } from "../components/RouterBadge";
import { Icon } from "../components/Icon";

const CROPS = ["Rice (padi)", "Chili (cabai)", "Tomato (tomat)", "Corn (jagung)", "Banana (pisang)", "Coffee (kopi)", "Cassava (singkong)", "Other"];

const SYMPTOMS = [
  "Yellow spots on leaves",
  "Brown / black spots",
  "White powder on leaves",
  "Leaves curling",
  "Holes in leaves",
  "Wilting even after watering",
  "Stunted growth",
  "Insects visible",
  "Rotting stem or fruit",
  "Leaves turning yellow overall",
];

const GREETING: ChatMessage = {
  id: "greeting",
  role: "assistant",
  text: "Hello! I am the PanenLens field assistant. Tell me what you see on your plant — pick a crop and symptoms below, or just describe it in your own words. I run on your device when possible, so I can keep helping even without signal.",
};

export function TriageView() {
  const [messages, setMessages] = useState<ChatMessage[]>([GREETING]);
  const [input, setInput] = useState("");
  const [crop, setCrop] = useState<string | null>(null);
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  function toggleSymptom(s: string) {
    setSymptoms((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  }

  async function send(textOverride?: string) {
    const composed =
      textOverride ??
      [
        crop ? `Crop: ${crop}.` : "",
        symptoms.length ? `Symptoms: ${symptoms.join(", ").toLowerCase()}.` : "",
        input.trim(),
      ]
        .filter(Boolean)
        .join(" ");
    if (!composed || busy) return;

    const userMsg: ChatMessage = { id: newId(), role: "user", text: composed };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setSymptoms([]);
    setError(null);
    setBusy(true);
    setDownloadProgress(null);

    const turns: TriageTurn[] = next
      .filter((m) => m.id !== "greeting")
      .slice(-8)
      .map((m) => ({ role: m.role, text: m.text }));

    try {
      const answer = await triageChat(turns, (f) => setDownloadProgress(f));
      setMessages((prev) => [
        ...prev,
        { id: newId(), role: "assistant", text: answer.text, meta: answer.meta },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
      setDownloadProgress(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-3xl bg-white p-5 shadow-card ring-1 ring-leaf-900/5">
        <h2 className="flex items-center gap-2 text-lg font-extrabold text-leaf-950">
          <Icon name="message" className="h-5 w-5 text-leaf-600" />
          Symptom triage — no photo needed
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-leaf-950/65">
          Describe the problem and get first guidance. This chat prefers{" "}
          <strong>on-device Gemini Nano</strong>, so it keeps working in the
          field with poor signal; if Nano is unavailable it falls back to the
          cloud and the badge on each reply tells you which one answered.
        </p>

        {/* Guided symptom picker */}
        <div className="mt-4">
          <p className="text-xs font-bold uppercase tracking-widest text-leaf-700">Crop</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {CROPS.map((c) => (
              <button
                key={c}
                onClick={() => setCrop(crop === c ? null : c)}
                className={`rounded-full px-3 py-1.5 text-xs font-bold ring-1 transition ${
                  crop === c
                    ? "bg-leaf-600 text-white ring-leaf-600"
                    : "bg-leaf-50 text-leaf-800 ring-leaf-200 hover:bg-leaf-100"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
          <p className="mt-4 text-xs font-bold uppercase tracking-widest text-leaf-700">
            What do you see?
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {SYMPTOMS.map((s) => (
              <button
                key={s}
                onClick={() => toggleSymptom(s)}
                className={`rounded-full px-3 py-1.5 text-xs font-bold ring-1 transition ${
                  symptoms.includes(s)
                    ? "bg-harvest-400 text-leaf-950 ring-harvest-400"
                    : "bg-white text-leaf-900 ring-leaf-200 hover:bg-leaf-50"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Chat */}
      <section className="flex min-h-[22rem] flex-col rounded-3xl bg-white shadow-card ring-1 ring-leaf-900/5">
        <div ref={scrollRef} className="max-h-[26rem] flex-1 space-y-3 overflow-y-auto p-4">
          {messages.map((m) => (
            <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] rounded-3xl px-4 py-3 text-sm leading-relaxed ${
                  m.role === "user"
                    ? "rounded-br-lg bg-leaf-600 text-white"
                    : "rounded-bl-lg bg-leaf-50 text-leaf-950 ring-1 ring-leaf-100"
                }`}
              >
                <p className="whitespace-pre-wrap">{m.text}</p>
                {m.meta && (
                  <div className="mt-2">
                    <RouterBadge meta={m.meta} />
                  </div>
                )}
              </div>
            </div>
          ))}
          {busy && (
            <div className="px-1">
              <AIPendingNote downloadProgress={downloadProgress} />
            </div>
          )}
        </div>

        {error && (
          <p className="mx-4 mb-2 flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-800 ring-1 ring-red-200">
            <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </p>
        )}

        <form
          className="flex gap-2 border-t border-leaf-100 p-3"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Describe the problem… (English or Bahasa Indonesia)"
            className="min-w-0 flex-1 rounded-full bg-leaf-50 px-4 py-2.5 text-sm ring-1 ring-leaf-200 outline-none placeholder:text-leaf-950/40 focus:ring-2 focus:ring-leaf-500"
          />
          <button
            type="submit"
            disabled={busy || (!input.trim() && !crop && symptoms.length === 0)}
            aria-label="Send"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-leaf-600 text-white transition hover:bg-leaf-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Icon name="send" className="h-4 w-4" />
          </button>
        </form>
      </section>
    </div>
  );
}
