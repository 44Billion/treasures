# NIP-GC Migration to Tag-Based Format

## Summary of Changes

This document summarizes the migration of NIP-GC from using stringified JSON in the content field to a tag-based approach, following the proposal in https://github.com/nostr-protocol/nips/pull/1770.

## NIP-GC.md Changes

### Geocache Listing (kind:37515)

**Old Format:**
- Content field contained stringified JSON with all geocache data
- Tags only had metadata like `d`, `g`, `location`, `status`

**New Format:**
- Content field contains the plain text description
- All data is stored in tags:
  - `name`: Cache name
  - `difficulty`: 1-5 rating
  - `terrain`: 1-5 rating  
  - `size`: micro/small/regular/large
  - `cache-type`: traditional/multi/mystery/earth/virtual/letterbox/event
  - `hint`: Optional ROT13 encoded hint
  - `image`: Repeated tag for each image URL

### Geocache Log (kind:37516)

**Old Format:**
- Content field contained stringified JSON with type, text, and images

**New Format:**
- Content field contains the plain text log message
- Data in tags:
  - `log-type`: found/dnf/note/maintenance/disabled/enabled/archived
  - `image`: Repeated tag for each image URL

## Code Changes

### Writing Events

Updated these hooks to write in the new tag-based format:
- `useCreateGeocache.ts`: Creates geocaches with tags
- `useEditGeocache.ts`: Edits geocaches using tags
- `useCreateLog.ts`: Creates logs with tags

### Reading Events

Updated parsing functions to:
1. First try to read from tags (new format)
2. Fall back to parsing JSON from content field (legacy format)

Updated in:
- `useGeocaches.ts`: List geocaches
- `useGeocache.ts`: Single geocache by ID
- `useGeocacheByDTag.ts`: Single geocache by d-tag
- `useGeocacheLogs.ts`: Geocache logs

## Backward Compatibility

The implementation maintains backward compatibility by:
1. **Reading**: Attempting to parse tags first, falling back to JSON if tags are missing
2. **Writing**: Only writing in the new tag format (no dual writing needed for this app)

## Benefits

1. **Consistency**: Aligns with Nostr conventions of using tags over JSON
2. **Queryability**: Tags can be filtered directly by relays
3. **Simplicity**: No JSON parsing needed for basic queries
4. **Flexibility**: Easier to add new optional fields as tags

## Testing

All TypeScript compilation and build tests pass successfully with these changes.