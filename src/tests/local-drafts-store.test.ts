/**
 * Unit tests for the offline drafts localStorage layer.
 *
 * The store is pure logic over `window.localStorage` so we don't need
 * React Testing Library — just a clean per-test storage state.
 *
 * NOTE: The global test setup (`src/test-setup.ts`) installs a stub
 * `localStorage` whose getters/setters are no-op `vi.fn()`s. That breaks
 * any code that depends on read-after-write semantics, so we install a
 * real in-memory implementation for the duration of this suite.
 */
import { describe, it, expect, beforeEach, beforeAll, afterAll } from "vitest";
import {
  listLocalDrafts,
  listPendingLocalDrafts,
  getLocalDraft,
  upsertLocalDraft,
  removeLocalDraft,
  markLocalDraftSynced,
  newLocalDraftSlug,
} from "@/lib/localDraftsStore";
import type { TreasureDraftPayload } from "@/hooks/useTreasureDrafts.types";

const PUBKEY = "test-pubkey-abc";
const OTHER_PUBKEY = "other-pubkey-xyz";

// Stateful localStorage shim — replaces the no-op one installed by the
// global test setup so reads see writes within the same test.
let memStore: Map<string, string>;
let originalLocalStorageDescriptor: PropertyDescriptor | undefined;

beforeAll(() => {
  memStore = new Map();
  originalLocalStorageDescriptor =
    Object.getOwnPropertyDescriptor(globalThis, "localStorage") ?? undefined;

  const shim: Storage = {
    get length() {
      return memStore.size;
    },
    clear: () => {
      memStore.clear();
    },
    getItem: (key: string) => (memStore.has(key) ? memStore.get(key)! : null),
    setItem: (key: string, value: string) => {
      memStore.set(key, String(value));
    },
    removeItem: (key: string) => {
      memStore.delete(key);
    },
    key: (index: number) => Array.from(memStore.keys())[index] ?? null,
  };

  Object.defineProperty(globalThis, "localStorage", {
    value: shim,
    writable: true,
    configurable: true,
  });
  // jsdom's `window` and `globalThis` are the same object in this env, but
  // be explicit so any code that reads `window.localStorage` also sees it.
  Object.defineProperty(window, "localStorage", {
    value: shim,
    writable: true,
    configurable: true,
  });
});

afterAll(() => {
  if (originalLocalStorageDescriptor) {
    Object.defineProperty(globalThis, "localStorage", originalLocalStorageDescriptor);
    Object.defineProperty(window, "localStorage", originalLocalStorageDescriptor);
  }
});

const makePayload = (name = "Untitled"): TreasureDraftPayload => ({
  formData: {
    name,
    description: "desc",
    hint: "",
    mission: "",
    difficulty: "2",
    terrain: "2",
    size: "regular",
    type: "traditional",
    contentWarning: "",
    modifiers: [],
  } as unknown as TreasureDraftPayload["formData"],
  location: { lat: 40.0, lng: -105.0 },
  images: [],
  currentStep: 4,
});

describe("localDraftsStore", () => {
  beforeEach(() => {
    memStore.clear();
  });

  it("returns an empty list when nothing has been written", () => {
    expect(listLocalDrafts(PUBKEY)).toEqual([]);
    expect(listPendingLocalDrafts(PUBKEY)).toEqual([]);
    expect(getLocalDraft(PUBKEY, "missing")).toBeNull();
  });

  it("persists a new draft and reads it back", () => {
    const slug = newLocalDraftSlug();
    const payload = makePayload("My cache");

    const record = upsertLocalDraft(PUBKEY, slug, payload);

    expect(record.slug).toBe(slug);
    expect(record.syncStatus).toBe("pending");
    expect(record.payload.formData.name).toBe("My cache");

    const found = getLocalDraft(PUBKEY, slug);
    expect(found).not.toBeNull();
    expect(found?.payload.location).toEqual({ lat: 40.0, lng: -105.0 });
  });

  it("overwrites an existing draft when the same slug is upserted", () => {
    const slug = "stable-slug";
    upsertLocalDraft(PUBKEY, slug, makePayload("v1"));
    upsertLocalDraft(PUBKEY, slug, makePayload("v2"));

    const all = listLocalDrafts(PUBKEY);
    expect(all).toHaveLength(1);
    expect(all[0].payload.formData.name).toBe("v2");
  });

  it("keeps drafts scoped per-pubkey", () => {
    upsertLocalDraft(PUBKEY, "a", makePayload("mine"));
    upsertLocalDraft(OTHER_PUBKEY, "b", makePayload("theirs"));

    expect(listLocalDrafts(PUBKEY)).toHaveLength(1);
    expect(listLocalDrafts(PUBKEY)[0].payload.formData.name).toBe("mine");
    expect(listLocalDrafts(OTHER_PUBKEY)).toHaveLength(1);
    expect(listLocalDrafts(OTHER_PUBKEY)[0].payload.formData.name).toBe("theirs");
  });

  it("removes a draft by slug", () => {
    upsertLocalDraft(PUBKEY, "x", makePayload("x"));
    upsertLocalDraft(PUBKEY, "y", makePayload("y"));

    removeLocalDraft(PUBKEY, "x");

    const remaining = listLocalDrafts(PUBKEY);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].slug).toBe("y");
  });

  it("drops the local copy when marked as synced (relay is canonical)", () => {
    const slug = "to-sync";
    upsertLocalDraft(PUBKEY, slug, makePayload());
    expect(getLocalDraft(PUBKEY, slug)).not.toBeNull();

    markLocalDraftSynced(PUBKEY, slug);

    // After sync the local copy is removed — the relay is the source of
    // truth and keeping a stale local copy would risk drift.
    expect(getLocalDraft(PUBKEY, slug)).toBeNull();
    expect(listLocalDrafts(PUBKEY)).toEqual([]);
  });

  it("only returns pending drafts from listPendingLocalDrafts", () => {
    upsertLocalDraft(PUBKEY, "a", makePayload("a"), "pending");
    upsertLocalDraft(PUBKEY, "b", makePayload("b"), "synced");

    const pending = listPendingLocalDrafts(PUBKEY);
    expect(pending).toHaveLength(1);
    expect(pending[0].slug).toBe("a");
  });

  it("sorts drafts newest-first by savedAt", async () => {
    upsertLocalDraft(PUBKEY, "first", makePayload("first"));
    // Force a measurable timestamp gap so the ISO strings sort correctly.
    await new Promise((r) => setTimeout(r, 5));
    upsertLocalDraft(PUBKEY, "second", makePayload("second"));

    const list = listLocalDrafts(PUBKEY);
    expect(list.map((d) => d.slug)).toEqual(["second", "first"]);
  });

  it("recovers gracefully from corrupted JSON in storage", () => {
    memStore.set(`treasures-local-drafts:${PUBKEY}`, "not-valid-json{");
    expect(listLocalDrafts(PUBKEY)).toEqual([]);
    expect(getLocalDraft(PUBKEY, "anything")).toBeNull();
  });

  it("ignores entries with unexpected shapes", () => {
    memStore.set(
      `treasures-local-drafts:${PUBKEY}`,
      JSON.stringify([
        { slug: "ok", savedAt: new Date().toISOString(), syncStatus: "pending", payload: makePayload() },
        { slug: 123, broken: true }, // bad
        null,
      ]),
    );
    const list = listLocalDrafts(PUBKEY);
    expect(list).toHaveLength(1);
    expect(list[0].slug).toBe("ok");
  });

  it("generates unique slugs", () => {
    const slugs = new Set<string>();
    for (let i = 0; i < 50; i++) {
      slugs.add(newLocalDraftSlug());
    }
    expect(slugs.size).toBe(50);
  });
});
