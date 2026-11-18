/**
 * PanenLens AI services — every model call goes through Firebase AI Logic
 * (`firebase/ai`) with the Gemini Developer API backend (GoogleAIBackend).
 *
 * The hybrid design in one paragraph:
 *  - Heavy multimodal work (leaf-photo diagnosis) is pinned to the cloud
 *    with `InferenceMode.ONLY_IN_CLOUD` and a structured JSON schema.
 *  - Lightweight text work (simplify, translate, triage Q&A, follow-ups)
 *    uses `InferenceMode.PREFER_ON_DEVICE`: Firebase AI Logic runs the
 *    request on Gemini Nano via Chrome's Prompt API when it is available
 *    and seamlessly falls back to a cloud Gemini model when it is not.
 *
 * Router badges: after every call we read `response.inferenceSource`
 * (exposed by the Firebase AI Logic SDK, v12.5+) — the SDK's own report of
 * whether the request was served ON_DEVICE or IN_CLOUD. If a response ever
 * lacks that property, we fall back to deriving the backend from the
 * requested inference mode, and for hybrid requests from a live Gemini Nano
 * availability check taken immediately before the call. The `determinedBy`
 * field on every result records which of these produced the badge, and the
 * UI discloses it — the badge is never just a guess presented as fact.
 */

import {
  getGenerativeModel,
  InferenceMode,
  InferenceSource,
  Schema,
  type GenerativeModel,
} from "firebase/ai";
import { getAIService } from "./firebase";
import { checkNanoAvailability } from "./nano";
import type {
  AIRunMeta,
  Diagnosis,
  HybridAnswer,
  InferenceBackend,
} from "./types";

/** Cloud model for photo diagnosis (multimodal, structured output). */
const CLOUD_DIAGNOSIS_MODEL = "gemini-2.5-flash";
/** Cloud fallback used when a hybrid request cannot run on-device. */
const HYBRID_CLOUD_FALLBACK_MODEL = "gemini-2.5-flash-lite";

const AGRO_SYSTEM_PROMPT =
  "You are PanenLens, an expert agronomist and plant pathologist who advises " +
  "smallholder farmers in Indonesia. Be practical, safe, and specific: prefer " +
  "low-cost, locally available treatments; mention dosage and safety " +
  "precautions for any chemical; never recommend banned pesticides. If you " +
  "are unsure, say so plainly instead of guessing.";

/* ------------------------------------------------------------------ */
/* Router badge resolution                                             */
/* ------------------------------------------------------------------ */

function resolveMeta(args: {
  inferenceSource?: InferenceSource;
  mode: InferenceMode;
  nanoReadyBeforeCall: boolean;
  latencyMs: number;
  cloudModelLabel: string;
}): AIRunMeta {
  const { inferenceSource, mode, nanoReadyBeforeCall, latencyMs } = args;

  let backend: InferenceBackend;
  let determinedBy: AIRunMeta["determinedBy"];

  if (inferenceSource === InferenceSource.ON_DEVICE) {
    backend = "on_device";
    determinedBy = "sdk";
  } else if (inferenceSource === InferenceSource.IN_CLOUD) {
    backend = "in_cloud";
    determinedBy = "sdk";
  } else if (mode === InferenceMode.ONLY_IN_CLOUD) {
    backend = "in_cloud";
    determinedBy = "mode";
  } else if (mode === InferenceMode.ONLY_ON_DEVICE) {
    backend = "on_device";
    determinedBy = "mode";
  } else {
    // Hybrid PREFER_ON_DEVICE without an SDK-reported source: infer from
    // the Nano availability check performed just before the call.
    backend = nanoReadyBeforeCall ? "on_device" : "in_cloud";
    determinedBy = "availability";
  }

  return {
    backend,
    determinedBy,
    latencyMs,
    modelLabel:
      backend === "on_device"
        ? "Gemini Nano · on-device"
        : args.cloudModelLabel,
    at: Date.now(),
  };
}

/** Map raw SDK errors to messages a farmer (or judge) can act on. */
function friendlyError(err: unknown): Error {
  const raw = err instanceof Error ? err.message : String(err);
  if (/app-check|appcheck|unauthorized|401|403/i.test(raw)) {
    return new Error(
      "The request was blocked by App Check. For local development, register an App Check debug token in the Firebase console and set VITE_FIREBASE_APPCHECK_DEBUG_TOKEN in .env.local.",
    );
  }
  if (/quota|429|resource-exhausted/i.test(raw)) {
    return new Error(
      "The free Gemini quota is exhausted right now. Please wait a little and try again.",
    );
  }
  if (/offline|network|fetch|failed to fetch/i.test(raw)) {
    return new Error(
      "Network problem — this feature needs a connection. (On-device features keep working offline once Gemini Nano is downloaded.)",
    );
  }
  if (/on-device|ondevice|language model|prompt api/i.test(raw)) {
    return new Error(
      "On-device AI is not available in this browser. PanenLens needs Chrome 139+ on desktop with Gemini Nano for offline features; cloud features still work.",
    );
  }
  return new Error(`AI request failed: ${raw}`);
}

/* ------------------------------------------------------------------ */
/* Hybrid (prefer-on-device) text generation                           */
/* ------------------------------------------------------------------ */

let hybridModel: GenerativeModel | null = null;

function getHybridModel(): GenerativeModel {
  if (hybridModel) return hybridModel;
  hybridModel = getGenerativeModel(getAIService(), {
    mode: InferenceMode.PREFER_ON_DEVICE,
    // Cloud side of the hybrid pair, used automatically by the SDK when
    // Gemini Nano is unavailable.
    inCloudParams: {
      model: HYBRID_CLOUD_FALLBACK_MODEL,
      generationConfig: { temperature: 0.6, maxOutputTokens: 1024 },
      systemInstruction: AGRO_SYSTEM_PROMPT,
    },
    // On-device side: declare EN/ID text I/O for Chrome's Prompt API.
    // (The agronomist instructions are also embedded in each prompt below,
    // because on-device sessions do not receive the cloud systemInstruction.)
    onDeviceParams: {
      createOptions: {
        expectedInputs: [{ type: "text", languages: ["en", "id"] }],
        expectedOutputs: [{ type: "text", languages: ["en", "id"] }],
      },
    },
  });
  return hybridModel;
}

/**
 * Run a single-turn text request through the hybrid router.
 *
 * On-device inference in Firebase AI Logic supports single-turn generation
 * only (no multi-turn chat sessions), so conversational features pass their
 * recent history inside the prompt text — the same prompt then works
 * identically on-device and in the cloud fallback.
 */
export async function hybridGenerate(
  prompt: string,
  onModelDownloadProgress?: (fraction: number) => void,
): Promise<HybridAnswer> {
  const model = getHybridModel();

  // Per Firebase docs, initializeDeviceModel() must be called after a user
  // interaction and before the first prompt request; it triggers/awaits the
  // Gemini Nano download when needed. Failures are non-fatal: the SDK falls
  // back to the cloud model for PREFER_ON_DEVICE requests.
  try {
    await model.initializeDeviceModel(onModelDownloadProgress);
  } catch {
    /* cloud fallback covers this */
  }

  const nanoReadyBeforeCall =
    (await checkNanoAvailability()) === "available";

  const started = performance.now();
  try {
    const result = await model.generateContent(prompt);
    const latencyMs = Math.round(performance.now() - started);
    const meta = resolveMeta({
      inferenceSource: result.response.inferenceSource,
      mode: InferenceMode.PREFER_ON_DEVICE,
      nanoReadyBeforeCall,
      latencyMs,
      cloudModelLabel: `${HYBRID_CLOUD_FALLBACK_MODEL} · cloud fallback`,
    });
    return { text: result.response.text().trim(), meta };
  } catch (err) {
    throw friendlyError(err);
  }
}

/* ------------------------------------------------------------------ */
/* Cloud photo diagnosis (multimodal, structured output)               */
/* ------------------------------------------------------------------ */

const diagnosisSchema = Schema.object({
  properties: {
    isHealthy: Schema.boolean({
      description: "True if the leaf looks healthy with no disease signs.",
    }),
    diseaseName: Schema.string({
      description:
        "Common name of the most likely disease or pest problem, or 'Healthy leaf' when isHealthy is true.",
    }),
    latinName: Schema.string({
      description: "Scientific name of the pathogen or pest, if known.",
    }),
    confidence: Schema.number({
      description: "Confidence in the diagnosis, from 0 to 1.",
    }),
    severity: Schema.enumString({
      enum: ["low", "moderate", "high", "critical"],
      description: "How severe the infection/infestation appears.",
    }),
    visibleSymptoms: Schema.array({
      items: Schema.string(),
      description: "Symptoms visible in the photo.",
    }),
    likelyCauses: Schema.array({
      items: Schema.string(),
      description: "Likely causes or spreading conditions.",
    }),
    treatmentOrganic: Schema.array({
      items: Schema.string(),
      description:
        "Step-by-step organic / low-cost treatments, in the order to apply them.",
    }),
    treatmentChemical: Schema.array({
      items: Schema.string(),
      description:
        "Step-by-step chemical treatments with active ingredient, dosage and safety notes. Empty if none is appropriate.",
    }),
    prevention: Schema.array({
      items: Schema.string(),
      description: "Prevention steps for the next planting cycle.",
    }),
    urgency: Schema.string({
      description: "How soon the farmer should act, e.g. 'Act within 2–3 days'.",
    }),
  },
  optionalProperties: ["latinName"],
});

const DIAGNOSIS_PROMPT = `You are shown a photo of a plant leaf (or plant part) taken by an Indonesian smallholder farmer.

Diagnose it and respond ONLY with JSON matching the provided schema:
- Identify the most likely disease, pest damage, or nutrient problem. If the plant looks healthy, set isHealthy to true, diseaseName to "Healthy leaf", severity to "low", and focus treatment fields on maintenance.
- Base visibleSymptoms strictly on what can be seen in the photo.
- Treatments must be practical for a smallholder in Indonesia: low-cost first, locally available materials, clear step-by-step order. For chemical options give the active ingredient (not just a brand), a typical dosage, and safety precautions (protective gear, pre-harvest interval).
- confidence is your honest probability (0–1) that the diagnosis is correct.
- Write all text in clear, simple English.`;

function parseDiagnosis(raw: string): Diagnosis {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start === -1 || end === -1) {
      throw new Error("The model returned an unreadable diagnosis. Please try again with a clearer photo.");
    }
    parsed = JSON.parse(cleaned.slice(start, end + 1));
  }
  const d = parsed as Partial<Diagnosis>;
  const severities = ["low", "moderate", "high", "critical"] as const;
  return {
    isHealthy: Boolean(d.isHealthy),
    diseaseName: d.diseaseName ?? "Unknown problem",
    latinName: d.latinName,
    confidence: Math.min(1, Math.max(0, Number(d.confidence ?? 0.5))),
    severity: severities.includes(d.severity as (typeof severities)[number])
      ? (d.severity as Diagnosis["severity"])
      : "moderate",
    visibleSymptoms: d.visibleSymptoms ?? [],
    likelyCauses: d.likelyCauses ?? [],
    treatmentOrganic: d.treatmentOrganic ?? [],
    treatmentChemical: d.treatmentChemical ?? [],
    prevention: d.prevention ?? [],
    urgency: d.urgency ?? "Monitor the plant over the next few days.",
  };
}

/**
 * Diagnose a leaf photo with cloud Gemini.
 *
 * Photo diagnosis is deliberately pinned to the cloud
 * (InferenceMode.ONLY_IN_CLOUD): it needs full multimodal reasoning and a
 * strict JSON schema, and the farmer is already online to upload the photo.
 * The lightweight follow-up actions on the result are the on-device part of
 * the hybrid story.
 */
export async function diagnoseLeafPhoto(
  imageBase64: string,
  mimeType: string,
): Promise<{ diagnosis: Diagnosis; meta: AIRunMeta }> {
  const model = getGenerativeModel(getAIService(), {
    mode: InferenceMode.ONLY_IN_CLOUD,
    inCloudParams: {
      model: CLOUD_DIAGNOSIS_MODEL,
      generationConfig: {
        temperature: 0.35,
        responseMimeType: "application/json",
        responseSchema: diagnosisSchema,
      },
      systemInstruction: AGRO_SYSTEM_PROMPT,
    },
  });

  const started = performance.now();
  try {
    const result = await model.generateContent([
      { type: "text", text: DIAGNOSIS_PROMPT },
      { type: "inlineData", inlineData: { data: imageBase64, mimeType } },
    ]);
    const latencyMs = Math.round(performance.now() - started);
    const meta = resolveMeta({
      inferenceSource: result.response.inferenceSource,
      mode: InferenceMode.ONLY_IN_CLOUD,
      nanoReadyBeforeCall: false,
      latencyMs,
      cloudModelLabel: `${CLOUD_DIAGNOSIS_MODEL} · cloud`,
    });
    return { diagnosis: parseDiagnosis(result.response.text()), meta };
  } catch (err) {
    throw friendlyError(err);
  }
}

/* ------------------------------------------------------------------ */
/* Features built on the hybrid router                                 */
/* ------------------------------------------------------------------ */

/** Render a diagnosis as plain text for follow-up prompts. */
export function diagnosisToText(d: Diagnosis): string {
  const lines = [
    `Diagnosis: ${d.diseaseName}${d.latinName ? ` (${d.latinName})` : ""}`,
    `Confidence: ${Math.round(d.confidence * 100)}% · Severity: ${d.severity}`,
    `Urgency: ${d.urgency}`,
    d.visibleSymptoms.length
      ? `Visible symptoms: ${d.visibleSymptoms.join("; ")}`
      : "",
    d.likelyCauses.length ? `Likely causes: ${d.likelyCauses.join("; ")}` : "",
    d.treatmentOrganic.length
      ? `Organic treatment steps: ${d.treatmentOrganic.join(" | ")}`
      : "",
    d.treatmentChemical.length
      ? `Chemical treatment steps: ${d.treatmentChemical.join(" | ")}`
      : "",
    d.prevention.length ? `Prevention: ${d.prevention.join("; ")}` : "",
  ];
  return lines.filter(Boolean).join("\n");
}

/** One-tap "explain it simply" — designed to run on Gemini Nano. */
export function simplifyDiagnosis(
  d: Diagnosis,
  onProgress?: (fraction: number) => void,
): Promise<HybridAnswer> {
  const prompt = `${AGRO_SYSTEM_PROMPT}

Rewrite the plant diagnosis below so a farmer with no technical background can understand and act on it. Rules:
- Very simple, everyday English. Short sentences.
- Start with one sentence saying what is wrong with the plant.
- Then a short numbered list: what to do first, next, and last.
- End with one sentence on how urgent it is.
- No jargon, no Latin names, no markdown headings. Maximum 130 words.

Diagnosis:
${diagnosisToText(d)}`;
  return hybridGenerate(prompt, onProgress);
}

/** One-tap translation of the care plan into Bahasa Indonesia. */
export function translateDiagnosis(
  d: Diagnosis,
  onProgress?: (fraction: number) => void,
): Promise<HybridAnswer> {
  const prompt = `Translate the plant care plan below into natural, farmer-friendly Bahasa Indonesia.
Rules:
- Keep the same structure and order (one item per line, keep the labels translated, e.g. "Diagnosis:", "Tingkat keparahan:").
- Use simple everyday Bahasa Indonesia as spoken in rural Java/Sumatra.
- Keep numbers, dosages and chemical active-ingredient names unchanged.
- Output ONLY the translation.

Care plan:
${diagnosisToText(d)}`;
  return hybridGenerate(prompt, onProgress);
}

/** Follow-up question about a specific diagnosis (hybrid). */
export function askAboutDiagnosis(
  d: Diagnosis,
  question: string,
  onProgress?: (fraction: number) => void,
): Promise<HybridAnswer> {
  const prompt = `${AGRO_SYSTEM_PROMPT}

A farmer received this diagnosis for their plant:
${diagnosisToText(d)}

The farmer now asks: "${question}"

Answer directly and practically in at most 120 words, in the same language the farmer used. Give concrete steps, quantities and timing where relevant.`;
  return hybridGenerate(prompt, onProgress);
}

export interface TriageTurn {
  role: "user" | "assistant";
  text: string;
}

/**
 * Offline symptom triage chat (hybrid, prefer-on-device).
 *
 * On-device inference is single-turn, so the recent conversation is folded
 * into each prompt. The assistant behaves like a guided triage: it asks one
 * clarifying question at a time until it can name the likely problem and
 * the first safe steps.
 */
export function triageChat(
  history: TriageTurn[],
  onProgress?: (fraction: number) => void,
): Promise<HybridAnswer> {
  const transcript = history
    .map((t) => `${t.role === "user" ? "Farmer" : "PanenLens"}: ${t.text}`)
    .join("\n");
  const prompt = `${AGRO_SYSTEM_PROMPT}

You are running a symptom triage chat with a farmer who has NO photo — they describe symptoms in words. Behaviour:
- If you still need information, ask exactly ONE short clarifying question (crop type, which part is affected, colour/pattern of spots, how fast it spreads, recent weather/fertilizer).
- Once you have enough, give: (1) the most likely problem, (2) how sure you are and why, (3) the first 2–3 safe steps to take today, (4) what to watch for.
- Keep every reply under 130 words, simple language, no markdown tables. Reply in the language the farmer is using.

Conversation so far:
${transcript}

Write the next PanenLens reply only.`;
  return hybridGenerate(prompt, onProgress);
}
