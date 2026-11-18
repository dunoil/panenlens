import { useEffect, useState } from "react";
import { firebaseConfigured, getFirebaseRuntime } from "../lib/firebase";
import { checkNanoAvailability, NANO_STATUS_LABEL, type NanoAvailability } from "../lib/nano";
import { Icon } from "../components/Icon";

export function AboutView() {
  const runtime = getFirebaseRuntime();
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

  return (
    <div className="space-y-4">
      <section className="rounded-3xl bg-white p-6 shadow-card ring-1 ring-leaf-900/5">
        <h2 className="flex items-center gap-2 text-lg font-extrabold text-leaf-950">
          <Icon name="route" className="h-5 w-5 text-leaf-600" />
          How the hybrid router works
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-leaf-950/70">
          PanenLens is built on <strong>Firebase AI Logic</strong> with two
          inference backends behind one SDK. Each feature is deliberately
          routed to the backend that fits it — and every answer shows its
          badge, so the routing is visible, not marketing.
        </p>

        {/* Architecture diagram */}
        <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-stretch">
          <div className="rounded-2xl bg-sky-50 p-4 ring-1 ring-sky-200">
            <p className="flex items-center gap-2 font-extrabold text-sky-900">
              <Icon name="cloud" className="h-5 w-5" /> Cloud · Gemini
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-sky-950/75">
              <li>Leaf-photo diagnosis (multimodal)</li>
              <li>Structured JSON care plans</li>
              <li>
                Mode: <code className="font-semibold">ONLY_IN_CLOUD</code>
              </li>
              <li>Model: Gemini 2.5 Flash</li>
            </ul>
          </div>
          <div className="flex items-center justify-center">
            <span className="rounded-full bg-leaf-900 px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest text-white">
              Firebase AI Logic
            </span>
          </div>
          <div className="rounded-2xl bg-leaf-50 p-4 ring-1 ring-leaf-200">
            <p className="flex items-center gap-2 font-extrabold text-leaf-900">
              <Icon name="cpu" className="h-5 w-5" /> On-device · Gemini Nano
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-leaf-950/75">
              <li>Simplify &amp; translate care plans</li>
              <li>Offline symptom triage chat</li>
              <li>
                Mode: <code className="font-semibold">PREFER_ON_DEVICE</code>
              </li>
              <li>Via Chrome Prompt API, with cloud fallback</li>
            </ul>
          </div>
        </div>

        <div className="mt-5 space-y-3 text-sm leading-relaxed text-leaf-950/70">
          <p>
            <strong className="text-leaf-950">Why hybrid?</strong> A photo
            diagnosis needs the strongest multimodal model and a strict output
            schema — that lives in the cloud. But the follow-up work happens in
            the field, where Indonesian smallholders often have weak or no
            signal. Summaries, translations and triage run on Gemini Nano
            directly in Chrome: instant, private (photos and questions never
            leave the device), free, and offline once the model is downloaded.
          </p>
          <p>
            <strong className="text-leaf-950">Honest badges.</strong> The badge
            on each answer comes from <code>response.inferenceSource</code>,
            the Firebase AI Logic SDK's own report of which backend served the
            request. In the rare case a response carries no source, the badge
            is derived from the requested inference mode — or, for hybrid
            requests, from a Gemini Nano availability check run immediately
            before the call. Hover any badge to see which method determined it.
          </p>
          <p>
            <strong className="text-leaf-950">Fallbacks.</strong> If Gemini
            Nano is unavailable (older browser, unsupported device, model not
            yet downloaded), hybrid requests automatically fall back to a cloud
            Gemini model — the feature still works, and the badge honestly
            shows “Cloud · Gemini”.
          </p>
        </div>
      </section>

      {/* Live device / service status */}
      <section className="rounded-3xl bg-white p-6 shadow-card ring-1 ring-leaf-900/5">
        <h3 className="flex items-center gap-2 font-extrabold text-leaf-950">
          <Icon name="shield" className="h-5 w-5 text-leaf-600" />
          This device &amp; services
        </h3>
        <dl className="mt-3 space-y-2.5 text-sm">
          <div className="flex items-start justify-between gap-4">
            <dt className="font-semibold text-leaf-950/60">Gemini Nano (Prompt API)</dt>
            <dd className="text-right font-bold text-leaf-900">
              {nano === null ? "Checking…" : NANO_STATUS_LABEL[nano]}
            </dd>
          </div>
          <div className="flex items-start justify-between gap-4">
            <dt className="font-semibold text-leaf-950/60">Firebase project</dt>
            <dd className="text-right font-bold text-leaf-900">
              {firebaseConfigured ? "Configured" : "Not configured (demo mode)"}
            </dd>
          </div>
          <div className="flex items-start justify-between gap-4">
            <dt className="font-semibold text-leaf-950/60">App Check</dt>
            <dd className="text-right font-bold text-leaf-900">
              {
                {
                  recaptcha: "Active · reCAPTCHA v3",
                  debug: "Active · debug token (local dev)",
                  "not-configured": "Not configured",
                  failed: "Failed to initialize",
                  skipped: "Skipped — Firebase not configured",
                }[runtime.appCheckMode]
              }
            </dd>
          </div>
          <div className="flex items-start justify-between gap-4">
            <dt className="font-semibold text-leaf-950/60">Diagnosis history</dt>
            <dd className="text-right font-bold text-leaf-900">
              Stored locally on this device only
            </dd>
          </div>
        </dl>
        {runtime.warnings.length > 0 && (
          <div className="mt-4 space-y-1.5">
            {runtime.warnings.map((w, i) => (
              <p
                key={i}
                className="flex items-start gap-2 rounded-xl bg-harvest-50 px-3 py-2 text-xs font-medium text-harvest-700 ring-1 ring-harvest-200"
              >
                <Icon name="alert" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {w}
              </p>
            ))}
          </div>
        )}
        <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-leaf-950/50">
          <Icon name="wifiOff" className="mt-0.5 h-4 w-4 shrink-0" />
          On-device features need Chrome 139+ on desktop with Gemini Nano. On
          other browsers they transparently use the cloud instead — open the
          Triage tab and check the badge on the reply.
        </p>
      </section>
    </div>
  );
}
