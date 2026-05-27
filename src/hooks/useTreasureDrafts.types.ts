/**
 * Shared types for the treasure-drafts subsystem.
 * Kept separate so non-hook code (e.g. `lib/localDraftsStore`) can import
 * the payload shape without pulling in React.
 */
import type { GeocacheFormData } from "@/types/geocache-form";

/** The full state that gets persisted inside a draft. */
export interface TreasureDraftPayload {
  formData: GeocacheFormData;
  location: { lat: number; lng: number } | null;
  images: string[];
  currentStep: number;
}

/** A draft record enriched with metadata for display. */
export interface TreasureDraft extends TreasureDraftPayload {
  /** The d-tag used as the addressable identifier on the relay. */
  slug: string;
  /** Unix-seconds timestamp of the wrapping kind-31234 event. */
  updatedAt: number;
  /** The Nostr event id of the kind 31234 wrapper. */
  eventId: string;
  /**
   * Whether the draft exists on the relay or is only stored locally.
   * - `synced`  — relay round-trip succeeded; this is the canonical record.
   * - `local`   — saved only to this device (no relay copy yet).
   */
  source: "synced" | "local";
}
