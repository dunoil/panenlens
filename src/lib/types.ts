/** Shared domain types for PanenLens. */

export type Severity = "low" | "moderate" | "high" | "critical";

/** Structured diagnosis returned by cloud Gemini (see diagnosisSchema in ai.ts). */
export interface Diagnosis {
  isHealthy: boolean;
  diseaseName: string;
  latinName?: string;
  /** 0..1 */
  confidence: number;
  severity: Severity;
  visibleSymptoms: string[];
  likelyCauses: string[];
  treatmentOrganic: string[];
  treatmentChemical: string[];
  prevention: string[];
  /** e.g. "Act within 2–3 days" */
  urgency: string;
}

/** Where an AI response actually ran. */
export type InferenceBackend = "on_device" | "in_cloud";

/**
 * How the backend shown in the UI was determined:
 * - "sdk": read from `response.inferenceSource` on the Firebase AI Logic
 *   response — the SDK's own report of which backend served the request.
 * - "mode": the SDK did not report a source, so it is derived from the
 *   inference mode requested (e.g. ONLY_IN_CLOUD can only be cloud).
 * - "availability": the SDK did not report a source for a hybrid
 *   (PREFER_ON_DEVICE) request, so it is inferred from a live Gemini Nano
 *   availability check performed immediately before the call.
 */
export type SourceDetermination = "sdk" | "mode" | "availability";

export interface AIRunMeta {
  backend: InferenceBackend;
  determinedBy: SourceDetermination;
  /** Wall-clock latency of the generateContent call, in milliseconds. */
  latencyMs: number;
  /** Human-readable model description, e.g. "Gemini 2.5 Flash (cloud)". */
  modelLabel: string;
  at: number;
}

/** A text answer produced by a hybrid (prefer-on-device) request. */
export interface HybridAnswer {
  text: string;
  meta: AIRunMeta;
}

export interface HistoryEntry {
  id: string;
  createdAt: number;
  /** Downscaled JPEG data URL of the diagnosed leaf photo. */
  imageDataUrl: string;
  diagnosis: Diagnosis;
  meta: AIRunMeta;
  simplified?: HybridAnswer;
  translated?: HybridAnswer;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  meta?: AIRunMeta;
}
