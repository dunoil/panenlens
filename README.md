# PanenLens — AI Plant Doctor for Smallholder Farmers

**Snap a photo of a sick leaf → get a diagnosis and treatment plan. Then let on-device AI explain it simply, translate it to Bahasa Indonesia, and answer questions — even offline in the field.**

PanenLens is built for Indonesia's smallholder farmers, who often farm far from agricultural extension services and with unreliable connectivity. It pairs the strongest cloud model (for the hard problem: multimodal disease diagnosis) with on-device AI (for the everyday problem: understanding and acting on the plan with poor signal).

Built with **Firebase AI Logic hybrid inference** for the **#BuildHybridAI 2026** hackathon (Web / Chrome).

---

## The hybrid design (the core of the app)

Every AI feature in PanenLens runs through the official Firebase JS SDK (`firebase/ai`, `GoogleAIBackend` — Gemini Developer API). What differs is the **inference mode**, chosen per feature:

| Feature | Inference mode | Backend | Why |
| --- | --- | --- | --- |
| Leaf-photo diagnosis | `ONLY_IN_CLOUD` | Cloud Gemini 2.5 Flash | Needs full multimodal reasoning + strict structured JSON output (disease, confidence, severity, organic/chemical treatment steps, prevention). |
| **Simplify** a care plan | `PREFER_ON_DEVICE` | Gemini Nano → cloud fallback | Plain-language rewrite; must work offline in the field. |
| **Translate to Bahasa Indonesia** | `PREFER_ON_DEVICE` | Gemini Nano → cloud fallback | Translation is a classic on-device task; instant and private. |
| **Follow-up questions** on a diagnosis | `PREFER_ON_DEVICE` | Gemini Nano → cloud fallback | Single-turn Q&A with the diagnosis folded into the prompt. |
| **Symptom triage chat** (no photo) | `PREFER_ON_DEVICE` | Gemini Nano → cloud fallback | Guided symptom Q&A for farmers without a usable photo; works with no signal. |

### Visible inference router

Every AI response in the UI carries a **router badge** — `On-device · Gemini Nano` or `Cloud · Gemini` — plus the call latency. The badge is honest by construction:

1. Primarily it reads **`response.inferenceSource`**, the Firebase AI Logic SDK's own report (SDK ≥ 12.5) of whether the request was served `ON_DEVICE` or `IN_CLOUD`.
2. If a response ever lacks that property, the badge is derived from the requested inference mode (e.g. `ONLY_IN_CLOUD` can only be cloud).
3. For hybrid (`PREFER_ON_DEVICE`) requests without an SDK-reported source, it is inferred from a **Gemini Nano availability check** (Chrome Prompt API) performed immediately before the call.

The badge records which of these three methods determined it (`determinedBy`), and hovering a badge in the app explains it. See `src/lib/ai.ts` (`resolveMeta`).

### Fallbacks & platform notes

- On-device inference uses Chrome's **Prompt API** and needs **Chrome 139+ on desktop** with Gemini Nano available (the model downloads once, with progress shown in the UI, via `model.initializeDeviceModel()`).
- When Nano is unavailable, `PREFER_ON_DEVICE` requests **fall back automatically** to a cloud Gemini model (`gemini-2.5-flash-lite`) — features keep working and the badge shows `Cloud · Gemini`.
- On-device inference is **single-turn only**, so the triage chat folds recent conversation history into each prompt; the identical prompt works on both backends.
- **App Check** is initialized before any AI call (Firebase AI Logic enforces it): reCAPTCHA v3 in production, the App Check **debug provider** for local development.
- Diagnosis history is stored **only in `localStorage`** on the user's device — no account, no server copy.

## Features

- 📷 **Diagnose** — upload/take a leaf photo → structured result card (disease + Latin name, confidence, severity, urgency, symptoms, causes, step-by-step organic and chemical treatments, prevention).
- ✨ **Simplify** — one tap rewrites the plan in plain, jargon-free language (on-device first).
- 🌐 **Translate** — one tap renders the care plan in farmer-friendly Bahasa Indonesia (on-device first).
- 💬 **Triage chat** — crop + symptom picker and free-text chat (English or Bahasa) answered on-device first.
- 🕘 **History** — past diagnoses with photos, stored locally, available offline.
- ℹ️ **How it works** — an architecture panel with a live Gemini Nano / Firebase / App Check status readout.

## Tech stack

- Vite + React + TypeScript + Tailwind CSS v4
- Firebase JS SDK v13: `firebase/app`, `firebase/app-check`, `firebase/ai` (AI Logic, `GoogleAIBackend`)
- No backend of our own; no paid services (Spark/free tiers only)

## Getting started

### Prerequisites

- Node.js 20+
- A Firebase project with **AI Logic** enabled (console → AI Services → AI Logic → Get started; choose the **Gemini Developer API** provider — free tier, no billing)
- **App Check** configured for your web app. For local development, register a debug token (console → App Check → Apps → your app → Manage debug tokens)
- For on-device inference: Chrome 139+ on desktop. Enable `chrome://flags/#prompt-api-for-gemini-nano-multimodal-input`, restart Chrome, and let Gemini Nano download (the app shows progress on first use). Without it, everything still works via cloud fallback.

### Setup

```bash
git clone <this-repo> panenlens
cd panenlens
npm install

cp .env.example .env.local   # then fill in your own values
npm run dev
```

`.env.local` values (see `.env.example` for the full template):

| Variable | Where to find it |
| --- | --- |
| `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`, `VITE_FIREBASE_MEASUREMENT_ID` | Firebase console → Project settings → General → *Your apps* → SDK setup and configuration |
| `VITE_FIREBASE_APPCHECK_DEBUG_TOKEN` | Firebase console → App Check → Apps → *Manage debug tokens* (local dev only — never ship this in production) |
| `VITE_FIREBASE_RECAPTCHA_SITE_KEY` | reCAPTCHA v3 site key registered in App Check (production) |

> 🔐 Secrets discipline: the app reads all config from environment variables. `.env*` files are git-ignored (except `.env.example` placeholders). The App Check debug token is **only** read from the environment — it is never hardcoded in source.

### Scripts

```bash
npm run dev      # local development (Vite)
npm run build    # type-check + production build to dist/
npm run preview  # serve the production build locally
```

## Project structure

```
src/
  lib/
    firebase.ts   Firebase app init, App Check (debug/reCAPTCHA), AI Logic service
    ai.ts         All model calls: cloud diagnosis (schema), hybrid router,
                  simplify / translate / follow-up / triage, router-badge logic
    nano.ts       Gemini Nano (Prompt API) availability detection for UI status
    image.ts      In-browser photo downscale → inlineData + history thumbnail
    history.ts    localStorage diagnosis history
    types.ts      Diagnosis, AIRunMeta, HistoryEntry, …
  components/
    RouterBadge.tsx   The visible inference-router badge (+ pending state)
    DiagnosisCard.tsx Structured result card with on-device actions
    Icon.tsx          Inline SVG icons
  views/
    DiagnoseView.tsx  Photo upload → cloud diagnosis flow
    TriageView.tsx    Symptom picker + on-device-first chat
    HistoryView.tsx   Local diagnosis history
    AboutView.tsx     Architecture / "How it works" panel with live status
  App.tsx             Shell, header with Nano status chip, tab navigation
```

## Responsible-use note

PanenLens gives AI-generated agricultural guidance. It is not a substitute for a local agricultural extension officer (PPL), and chemical suggestions always carry dosage and safety guidance with a reminder to follow label instructions and local regulations.

## License

Apache License 2.0 — see [LICENSE](LICENSE).

*PanenLens was created during the #BuildHybridAI 2026 submission period (Nov 2026). AI coding assistants were used in its development, as permitted by the hackathon rules.*
