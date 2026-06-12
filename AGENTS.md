# Project Overview

Treasures (https://treasures.to) is a decentralized geocaching app built on Nostr. Users create, find, and log geocaches ("treasures") with cryptographic verification via QR codes.

## Technology Stack

- **React 19** with TypeScript, built by **Vite**
- **TailwindCSS 3.x** + **shadcn/ui** (Radix primitives) in `@/components/ui`
- **Nostrify** (`@nostrify/react`) + **nostr-tools** for Nostr protocol
- **TanStack Query** for data fetching/caching
- **React Router** with lazy-loaded routes (`src/AppRouter.tsx`)
- **Leaflet** + react-leaflet for maps
- **Capacitor 8** for the native Android build
- **vite-plugin-pwa** / Workbox for PWA + offline caching
- **i18next** for i18n (locales: `en`, `de`, `ja`, `th` in `src/locales/`)
- **Zustand** (limited use; see State Management)

## Project Structure

The layout is **flat** (no `src/features/` or `src/shared/` directories):

- `src/pages/` — route components (Home, Map, CacheDetail, MyCaches, CreateCache, GenerateQR, Adventures, Profile, Settings, Blog, etc.)
- `src/components/` — UI components, plus `ui/` (shadcn), `auth/`, `map/`, `icons/`
- `src/hooks/` — ~70 custom hooks (`useGeocaches`, `useGeocacheLogs`, `useCreateLog`, `useMultiRelayQuery`, …)
- `src/stores/` — core data stores (see below)
- `src/lib/` — app infrastructure (`appRelays.ts`, `constants.ts`, `NIndexedDBStore.ts`, `NostrBatcher.ts`, `i18n.ts`, `utils.ts`)
- `src/utils/` — domain utilities (`nip-gc.ts`, `nip-gd.ts`, `naddr.ts`, `verification.ts`, `geo.ts`, …)
- `src/config/` — constants (`timeouts.ts`, `polling.ts`, `limits.ts`, `mapStyles.ts`, `legacy.ts`)
- `src/contexts/` — React contexts (`AppContext`, NWC)
- `src/tests/` — test files plus `testUtils.ts` and `setup.ts`
- `src/workers/` — web workers (QR decode)
- `NIP-GC.md`, `NIP-GD.md` — protocol specs for the custom event kinds used by this app

## Nostr Event Kinds (see NIP-GC.md / NIP-GD.md)

Kind constants live in `src/utils/nip-gc.ts` (`NIP_GC_KINDS`) and `src/utils/nip-gd.ts`. Always use the constants, never magic numbers.

| Kind  | Use                                          |
|-------|----------------------------------------------|
| 37516 | Geocache listing (addressable)               |
| 37515 | Legacy geocache (allowlist in `src/config/legacy.ts`) |
| 37517 | Adventure (curated treasure collection)      |
| 7516  | Found log                                    |
| 7517  | Verification event (verified found)          |
| 1111  | Comment log — dnf/note/maintenance (NIP-22)  |
| 5777  | Good Deed / Key Quest (NIP-GD)               |
| 31234 | Draft                                        |
| 30023 | Blog post                                    |
| 10003 | Saved-cache bookmarks                        |
| 16767 | Active profile theme                         |
| 9735  | Zap receipt                                  |

## Core Data Stores

All CRUD for core data flows through `src/stores/` (React-context-based stores wired up in `StoreProvider.tsx`, accessed via hooks in `src/stores/hooks.ts`):

- `useGeocacheStore.ts` — geocache data for cards, details, listings, edits
- `useLogStore.ts` — found/verified-found logs and comment logs (dnf, note, maintenance, archived)
- `useAuthorStore.ts` — geocache creator and log author profile data
- `useSavedCachesStore.ts` — bookmarked caches

**IMPORTANT**: Never create an alternate route that serves or mutates this core data — go through the stores/hooks.

Zustand (with `persist`) is used only for `useWotStore.ts` (Web of Trust filtering) and `useZapStore.ts`. Everything else uses TanStack Query or the context stores.

### State management direction

The codebase currently has three state layers (context stores, zustand, TanStack Query). The target direction for **new code**:

- **Server/relay data** → TanStack Query (`useQuery`/`useMutation`), keyed caches, timeout constants from `@/config`.
- **Persistent client state** (settings, filters) → zustand with `persist`.
- **The context stores in `src/stores/`** remain the required path for core geocache/log/author CRUD until they are migrated — do not bypass them, and do not add new context-based stores.

## Relay Configuration

This app is **multi-relay**. Do not hardcode relay URLs in hooks or components.

- `src/lib/appRelays.ts` — `APP_RELAYS` (app defaults), `SEARCH_RELAYS` (NIP-50 full-text search), `PRESET_RELAYS` (UI picker), `getEffectiveRelays()` (merges app relays with the user's NIP-65 relay list)
- `src/hooks/useMultiRelayQuery.ts` — querying across relays
- `src/config/relays.ts` is a **deprecated shim** — do not import from it in new code

## Querying Nostr Data

Combine `useNostr` with `useQuery`, always with timeout constants from `@/config`:

```typescript
import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';
import { TIMEOUTS, QUERY_LIMITS } from '@/config';

function useFoundLogs(geocacheAddress: string) {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['found-logs', geocacheAddress],
    queryFn: async (c) => {
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(TIMEOUTS.QUERY)]);
      return await nostr.query(
        [{ kinds: [7516], '#a': [geocacheAddress], limit: QUERY_LIMITS.LOGS }],
        { signal },
      );
    },
  });
}
```

Constants (in `src/config/`): `TIMEOUTS` (`QUERY` 8s, `FAST_QUERY` 3s, `PUBLISH` 12s, …), `POLLING_INTERVALS`, `QUERY_LIMITS`.

### NIP-19 identifiers in filters

Nostr filters only accept hex. Decode `naddr`/`npub`/etc. first — helpers exist in `src/utils/naddr.ts` (`parseNaddr`, `geocacheToNaddr`):

```ts
import { nip19 } from 'nostr-tools';

const decoded = nip19.decode(value);
if (decoded.type !== 'naddr') throw new Error('Unsupported identifier');
const { kind, pubkey, identifier } = decoded.data;
const events = await nostr.query(
  [{ kinds: [kind], authors: [pubkey], '#d': [identifier] }],
  { signal },
);
```

## Publishing Events

Use `useNostrPublish` (handles relay selection, client tag, error reporting via `src/lib/publishErrors.ts`). Gate publishing UI on `useCurrentUser`:

```tsx
const { user } = useCurrentUser();
const { mutate: createEvent } = useNostrPublish();
if (!user) return <span>You must be logged in.</span>;
```

For geocache/log creation specifically, prefer the purpose-built hooks: `useCreateGeocache`, `useEditGeocache`, `useCreateLog`, `useCreateVerifiedLog`, `useDeleteGeocache`.

## Auth

- `LoginArea` component (`@/components/auth/LoginArea`) handles all login UI: NIP-07 extension, NIP-46 remote signing, and local nsec signup. Don't wrap it in conditional logic; use `compact` prop in tight spaces.
- `useCurrentUser` for the logged-in user; `user.signer` follows the NIP-07 interface (including `signer.nip44` for encryption — guard for availability).
- `useLoggedInAccounts` / account switching is built in.

## Profiles, Uploads, Content

- `useAuthor(pubkey)` for profile metadata (kind 0 / `NostrMetadata`).
- `useUploadFile` for file uploads (Blossom; returns NIP-94-style tags, first tag holds the URL).
- `NoteContent` component for rendering kind-1-style text content.
- `EditProfileForm` component for profile editing.

## Offline / PWA

- Workbox runtime caching covers map tiles, images, and pages.
- `src/lib/NIndexedDBStore.ts` mirrors events to IndexedDB as a local backup store (supports id/address filters only — tag-based queries still require the network).
- PWA update prompt and install flow are implemented (`usePWAInstall`, update prompt component).

## i18n

All user-facing strings must go through i18next (`useTranslation`). Add keys to **all four** locale files in `src/locales/`. CI runs `npm run check-translations` and fails on missing keys.

## Build, Test, Deploy

```bash
npm run dev            # vite dev server
npm run build          # vite build (+ copies index.html -> 404.html for SPA fallback)
npm run test           # full gate: tsc + eslint + translation check + vitest + build
npm run deploy         # rsync to droplet (requires DROPLET_IP)
npm run deploy:nostr   # nostr-deploy-cli
npm run cap:sync       # sync Capacitor Android project
npm run analyze        # bundle analysis
```

### Focused testing

Only run tests related to your immediate scope of work:

```bash
npx vitest run src/tests/some-file.test.tsx   # one file
npx vitest run --grep "WelcomeModal"          # by name
npx tsc -p tsconfig.json --noEmit             # types only
npx eslint src/                               # lint only
```

Run the full `npm run test` suite only before deployment, when changes affect multiple systems, or when explicitly requested.

### Testing rules

- Tests live in `src/tests/` (plus colocated `*.test.tsx` next to hooks); use Vitest + React Testing Library with helpers from `src/tests/testUtils.ts`.
- Use the real protocol kinds (37516, 7516, 1111, …) from `NIP_GC_KINDS` in test fixtures and mocks.
- Write tests for new features and bug fixes (test the bug scenario first).
- **NEVER DELETE TEST FILES** unless they are deprecated (broken AND unfixable).
- **DO NOT CREATE DEBUG/DEMO PAGES** — validate behavior with tests instead.

## Code Quality Rules

- No `any` — use `unknown` plus narrowing, or proper types.
- No `console.log` left in production code paths (console statements are stripped from prod builds, but keep the source clean).
- Use the `cn()` utility from `@/lib/utils` for conditional classes; shadcn components follow the `forwardRef` pattern.
- Mobile-first responsive design with Tailwind prefixes (`md:`, `lg:`).
- Use path alias `@/` for imports.

### Error handling pattern

```ts
try {
  const signal = AbortSignal.any([c.signal, AbortSignal.timeout(TIMEOUTS.QUERY)]);
  const events = await nostr.query([filter], { signal });
} catch (error: unknown) {
  const err = error as { message?: string };
  if (err.message?.includes('timeout')) { /* timeout */ }
  else if (err.message?.includes('User rejected')) { /* user cancelled signing */ }
  else { /* other */ }
}
```

## Forbidden Patterns

❌ Hardcoding relay URLs in hooks/components — use `getEffectiveRelays()` / `APP_RELAYS`
❌ Importing from the deprecated `src/config/relays.ts` shim
❌ Magic numbers for event kinds — use `NIP_GC_KINDS`
❌ Custom timeout values — use `TIMEOUTS` from `@/config`
❌ Bypassing the stores in `src/stores/` for core geocache/log/author data
❌ Untranslated user-facing strings
❌ Debug/demo pages or routes
