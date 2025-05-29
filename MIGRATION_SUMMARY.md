# NIP-GC Migration to Tag-Based Format

## Summary of Changes

This document summarizes the migration of NIP-GC from using stringified JSON in the content field to a tag-based approach, following the proposal in https://github.com/nostr-protocol/nips/pull/1770.

## NIP-GC.md Changes

### Geocache Listing (kind:37515)

**Format:**
- Content field contains the plain text description
- All data is stored in tags:
  - `name`: Cache name (required)
  - `difficulty`: 1-5 rating (required)
  - `terrain`: 1-5 rating (required)
  - `size`: micro/small/regular/large (required)
  - `cache-type`: traditional/multi/mystery/earth/virtual/letterbox/event (required)
  - `hint`: Optional ROT13 encoded hint
  - `image`: Repeated tag for each image URL

### Geocache Log (kind:37516)

**Format:**
- Content field contains the plain text log message
- Data in tags:
  - `log-type`: found/dnf/note/maintenance/disabled/enabled/archived (required)
  - `image`: Repeated tag for each image URL

## Code Changes

### Writing Events

Updated these hooks to write in the new tag-based format:
- `useCreateGeocache.ts`: Creates geocaches with tags
- `useEditGeocache.ts`: Edits geocaches using tags
- `useCreateLog.ts`: Creates logs with tags

### Reading Events

Updated parsing functions to only read from tags. Events missing required tags are rejected.

Updated in:
- `useGeocaches.ts`: List geocaches
- `useGeocache.ts`: Single geocache by ID
- `useGeocacheByDTag.ts`: Single geocache by d-tag
- `useGeocacheLogs.ts`: Geocache logs

## Breaking Changes

- No backward compatibility with JSON-based events
- All geocache events must have required tags or they will be ignored
- All log events must have the `log-type` tag or they will be ignored

## Benefits

1. **Consistency**: Aligns with Nostr conventions of using tags over JSON
2. **Queryability**: Tags can be filtered directly by relays
3. **Simplicity**: No JSON parsing needed
4. **Flexibility**: Easier to add new optional fields as tags

## Testing

All TypeScript compilation and build tests pass successfully with these changes.