/**
 * Firebase bootstrap for PanenLens.
 *
 * - The web config is read exclusively from Vite environment variables
 *   (VITE_FIREBASE_*), so no project values live in source control.
 * - App Check is initialized before any AI Logic call. Firebase AI Logic
 *   enforces App Check, so requests without a valid token are rejected.
 * - App Check providers:
 *     · Production → reCAPTCHA v3 (VITE_FIREBASE_RECAPTCHA_SITE_KEY).
 *     · Local development → the App Check *debug provider*. Setting
 *       `self.FIREBASE_APPCHECK_DEBUG_TOKEN` before `initializeAppCheck`
 *       makes the SDK exchange the registered debug token for real App
 *       Check tokens. The token itself comes from the environment variable
 *       VITE_FIREBASE_APPCHECK_DEBUG_TOKEN — it is never hardcoded here.
 */

import { initializeApp, type FirebaseApp } from "firebase/app";
import {
  initializeAppCheck,
  ReCaptchaV3Provider,
  type AppCheck,
} from "firebase/app-check";
import { getAI, GoogleAIBackend, type AI } from "firebase/ai";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as
    | string
    | undefined,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as
    | string
    | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID as
    | string
    | undefined,
};

/** True when the minimum config needed by AI Logic is present. */
export const firebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId,
);

export type AppCheckMode =
  | "recaptcha"
  | "debug"
  | "not-configured"
  | "failed"
  | "skipped";

export interface FirebaseRuntime {
  app: FirebaseApp | null;
  ai: AI | null;
  appCheck: AppCheck | null;
  appCheckMode: AppCheckMode;
  /** Non-fatal initialization warnings, surfaced in the About panel. */
  warnings: string[];
}

let runtime: FirebaseRuntime | null = null;

function initAppCheck(app: FirebaseApp, warnings: string[]): {
  appCheck: AppCheck | null;
  mode: AppCheckMode;
} {
  const debugToken = import.meta.env.VITE_FIREBASE_APPCHECK_DEBUG_TOKEN as
    | string
    | undefined;
  const siteKey = import.meta.env.VITE_FIREBASE_RECAPTCHA_SITE_KEY as
    | string
    | undefined;

  try {
    if (debugToken) {
      // Debug provider: must be set BEFORE initializeAppCheck. When this
      // global is present, the App Check SDK exchanges the registered debug
      // token for real tokens and the attestation provider below is never
      // exercised — which is why a placeholder key is safe in this mode.
      (
        self as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN?: string }
      ).FIREBASE_APPCHECK_DEBUG_TOKEN = debugToken;
    }

    if (siteKey) {
      const appCheck = initializeAppCheck(app, {
        provider: new ReCaptchaV3Provider(siteKey),
        isTokenAutoRefreshEnabled: true,
      });
      return { appCheck, mode: debugToken ? "debug" : "recaptcha" };
    }

    if (debugToken) {
      const appCheck = initializeAppCheck(app, {
        provider: new ReCaptchaV3Provider("app-check-debug-token-mode"),
        isTokenAutoRefreshEnabled: true,
      });
      return { appCheck, mode: "debug" };
    }

    warnings.push(
      "App Check is not configured (no reCAPTCHA site key and no debug token). " +
        "AI Logic requests will be rejected while App Check is enforced.",
    );
    return { appCheck: null, mode: "not-configured" };
  } catch (err) {
    warnings.push(
      `App Check failed to initialize: ${err instanceof Error ? err.message : String(err)}`,
    );
    return { appCheck: null, mode: "failed" };
  }
}

/** Lazily initialize Firebase exactly once and return the runtime handles. */
export function getFirebaseRuntime(): FirebaseRuntime {
  if (runtime) return runtime;

  const warnings: string[] = [];

  if (!firebaseConfigured) {
    warnings.push(
      "Firebase is not configured. Copy .env.example to .env.local and fill in " +
        "your Firebase web app config, then reload.",
    );
    runtime = {
      app: null,
      ai: null,
      appCheck: null,
      appCheckMode: "skipped",
      warnings,
    };
    return runtime;
  }

  const app = initializeApp(firebaseConfig);
  const { appCheck, mode } = initAppCheck(app, warnings);

  // Firebase AI Logic backed by the Gemini Developer API (free tier).
  const ai = getAI(app, { backend: new GoogleAIBackend() });

  runtime = { app, ai, appCheck, appCheckMode: mode, warnings };
  return runtime;
}

/** The AI Logic service handle; throws a friendly error when unconfigured. */
export function getAIService(): AI {
  const { ai } = getFirebaseRuntime();
  if (!ai) {
    throw new Error(
      "Firebase is not configured yet. Add your Firebase web config to .env.local (see .env.example) and reload the app.",
    );
  }
  return ai;
}
