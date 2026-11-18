/**
 * Diagnosis history, stored entirely on the device in localStorage.
 * No account, no server copy — a farmer's field data stays on their phone.
 */

import type { HistoryEntry } from "./types";

const STORAGE_KEY = "panenlens.history.v1";
const MAX_ENTRIES = 30;

export function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as HistoryEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveHistoryEntry(entry: HistoryEntry): HistoryEntry[] {
  const next = [entry, ...loadHistory()].slice(0, MAX_ENTRIES);
  persist(next);
  return next;
}

export function updateHistoryEntry(
  id: string,
  patch: Partial<HistoryEntry>,
): HistoryEntry[] {
  const next = loadHistory().map((e) => (e.id === id ? { ...e, ...patch } : e));
  persist(next);
  return next;
}

export function deleteHistoryEntry(id: string): HistoryEntry[] {
  const next = loadHistory().filter((e) => e.id !== id);
  persist(next);
  return next;
}

export function clearHistory(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* storage unavailable */
  }
}

function persist(entries: HistoryEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Quota exceeded (large thumbnails): drop the oldest entries and retry.
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, 10)));
    } catch {
      /* storage unavailable — history becomes session-only */
    }
  }
}

export function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}
