/**
 * Gemini Nano (Chrome Prompt API) availability detection.
 *
 * Firebase AI Logic's on-device backend is built on Chrome's Prompt API.
 * The SDK does not expose a public "is Nano ready?" call, so PanenLens asks
 * the Prompt API directly — via the modern `LanguageModel` global, falling
 * back to the legacy `window.ai.languageModel` — purely to *display* device
 * readiness and to explain hybrid routing decisions in the UI. Inference
 * itself always goes through Firebase AI Logic.
 */

export type NanoAvailability =
  | "available"
  | "downloadable"
  | "downloading"
  | "unavailable"
  | "unsupported";

interface LanguageModelLike {
  availability: () => Promise<string>;
}

function getLanguageModelApi(): LanguageModelLike | null {
  const g = globalThis as unknown as {
    LanguageModel?: LanguageModelLike;
    ai?: { languageModel?: LanguageModelLike };
  };
  if (g.LanguageModel && typeof g.LanguageModel.availability === "function") {
    return g.LanguageModel;
  }
  if (g.ai?.languageModel && typeof g.ai.languageModel.availability === "function") {
    return g.ai.languageModel;
  }
  return null;
}

/** True when this browser exposes Chrome's Prompt API at all. */
export function promptApiSupported(): boolean {
  return getLanguageModelApi() !== null;
}

export async function checkNanoAvailability(): Promise<NanoAvailability> {
  const api = getLanguageModelApi();
  if (!api) return "unsupported";
  try {
    const status = await api.availability();
    switch (status) {
      case "available":
        return "available";
      case "downloadable":
        return "downloadable";
      case "downloading":
        return "downloading";
      default:
        return "unavailable";
    }
  } catch {
    return "unavailable";
  }
}

export const NANO_STATUS_LABEL: Record<NanoAvailability, string> = {
  available: "Gemini Nano ready on this device",
  downloadable: "Gemini Nano can be downloaded on first use",
  downloading: "Gemini Nano is downloading…",
  unavailable: "Gemini Nano not available on this device",
  unsupported: "On-device AI needs Chrome 139+ on desktop",
};
