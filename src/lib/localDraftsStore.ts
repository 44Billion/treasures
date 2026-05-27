/**
 * localDraftsStore - Multi-slot localStorage store for offline geocache drafts.
 *
 * Distinct from the single-slot auto-save (`useTreasureDrafts.loadLocalDraft`):
 * this store holds N "explicit save" drafts keyed by slug, scoped per-pubkey,
 * with a sync status so the UI can mark them as "Not synced" until the relay
 * round-trip succeeds.
 *
 * When the user clicks "Save Draft" while offline (or the relay publish fails),
 * the draft is written here with `syncStatus: 'pending'`. When the same slug is
 * later saved successfully to the relay, the local copy is removed.
 */
import type { TreasureDraftPayload } from "@/hooks/useTreasureDrafts.types";

const STORAGE_KEY_PREFIX = "treasures-local-drafts:";

export type LocalDraftSyncStatus = "pending" | "synced";

export interface LocalDraftRecord {
  /** Unique slug — matches the relay draft's d-tag when/if it syncs. */
  slug: string;
  /** The full draft payload (formData, location, images, currentStep). */
  payload: TreasureDraftPayload;
  /** ISO timestamp of last local save. */
  savedAt: string;
  /** Whether this draft has been confirmed on the relay yet. */
  syncStatus: LocalDraftSyncStatus;
}

function storageKey(pubkey: string): string {
  return `${STORAGE_KEY_PREFIX}${pubkey}`;
}

function readAll(pubkey: string): LocalDraftRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(storageKey(pubkey));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (r): r is LocalDraftRecord =>
        r &&
        typeof r.slug === "string" &&
        typeof r.savedAt === "string" &&
        (r.syncStatus === "pending" || r.syncStatus === "synced") &&
        r.payload &&
        typeof r.payload === "object",
    );
  } catch {
    return [];
  }
}

function writeAll(pubkey: string, drafts: LocalDraftRecord[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey(pubkey), JSON.stringify(drafts));
  } catch (err) {
    // Quota errors etc. — surface in console but don't crash.
    console.warn("[localDraftsStore] Failed to persist drafts:", err);
  }
}

/** Return all local drafts for a pubkey, newest first. */
export function listLocalDrafts(pubkey: string): LocalDraftRecord[] {
  return readAll(pubkey).sort((a, b) =>
    b.savedAt.localeCompare(a.savedAt),
  );
}

/** Return all pending (unsynced) local drafts for a pubkey. */
export function listPendingLocalDrafts(pubkey: string): LocalDraftRecord[] {
  return listLocalDrafts(pubkey).filter((d) => d.syncStatus === "pending");
}

/** Look up a single local draft by slug. */
export function getLocalDraft(
  pubkey: string,
  slug: string,
): LocalDraftRecord | null {
  return readAll(pubkey).find((d) => d.slug === slug) ?? null;
}

/**
 * Upsert a local draft. Overwrites any existing record with the same slug.
 * Defaults to `syncStatus: 'pending'`.
 */
export function upsertLocalDraft(
  pubkey: string,
  slug: string,
  payload: TreasureDraftPayload,
  syncStatus: LocalDraftSyncStatus = "pending",
): LocalDraftRecord {
  const all = readAll(pubkey);
  const record: LocalDraftRecord = {
    slug,
    payload,
    savedAt: new Date().toISOString(),
    syncStatus,
  };
  const next = [record, ...all.filter((d) => d.slug !== slug)];
  writeAll(pubkey, next);
  return record;
}

/** Remove a local draft by slug. No-op if not found. */
export function removeLocalDraft(pubkey: string, slug: string): void {
  const all = readAll(pubkey);
  const next = all.filter((d) => d.slug !== slug);
  if (next.length !== all.length) {
    writeAll(pubkey, next);
  }
}

/** Mark a local draft as successfully synced. */
export function markLocalDraftSynced(pubkey: string, slug: string): void {
  const all = readAll(pubkey);
  const idx = all.findIndex((d) => d.slug === slug);
  if (idx === -1) return;
  // Once synced, we just drop the local copy — the relay is the source of truth.
  // Keeping it would risk drift on the next decrypt/load.
  const next = all.filter((d) => d.slug !== slug);
  writeAll(pubkey, next);
}

/** Generate a new unique slug for an offline-created draft. */
export function newLocalDraftSlug(): string {
  return `geocache-draft-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}
