# Testing the Edit Fix

## What was the problem?

When editing a geocache, instead of updating the existing event, a completely new event was being created with a different cache ID. This happened because:

1. **Original creation** used a d-tag like: `['d', 'geocache-1673728374827-abc123']`
2. **Edit attempt** used the event ID as d-tag: `['d', '1a2b3c4d...']` (the event ID)

Since replaceable events (kind 30078) are identified by `kind + pubkey + d-tag`, using a different d-tag created a **new** replaceable event instead of replacing the original.

## What was the fix?

1. **Added `dTag` to Geocache type** - Now we store the original d-tag value
2. **Updated parsing functions** - Extract and store the d-tag when parsing events
3. **Fixed edit hook** - Use the original d-tag instead of the event ID
4. **Updated cache handling** - Better TypeScript types and null checking

## Key changes:

### Before (broken):
```typescript
tags: [
  ['d', originalGeocache.id], // Wrong! This is the event ID, not the d-tag
  ['t', 'geocache'],
  // ...
]
```

### After (fixed):
```typescript
tags: [
  ['d', originalGeocache.dTag], // Correct! Use the original d-tag for replacement
  ['t', 'geocache'], 
  // ...
]
```

## How to test:

1. Create a geocache
2. Edit that geocache 
3. Check that only one event exists for that geocache (not two separate events)
4. Verify the edit properly replaces the original content

## Expected behavior:

- ✅ Edits should replace the original geocache event
- ✅ Only one event should exist per geocache
- ✅ The edit should maintain the same cache ID/URL
- ✅ No duplicate entries should appear in lists