NIP-GC
======

Geocaching Events
-----------------

`draft` `optional`

This NIP defines event kinds for geocaching on Nostr. These events allow users to create, share, and log geocaches in a decentralized manner.

## Geocache Listing Event (Kind 37516)

Geocache listing events are addressable events of kind `37516` with the following structure:

```json
{
  "kind": 37516,
  "content": "<cache description>",
  "tags": [
    ["d", "<cache-identifier>"],
    ["name", "<cache-name>"],
    ["g", "<geohash>"],
    ["D", "<1-5>"],
    ["T", "<1-5>"],
    ["S", "<size>"],
    ["t", "<type>"]
  ]
}
```

Listing events require all information about the cache and information relevant to finding the cache. These include the `name`, location (`g`), difficulty (`D`) and terrain (`T`) scores, and size (`S`). The type of cache (`t`) is optional and defaults to `traditional` if not specified.

Cache types are determined by individual clients, with common types including `traditional`, `multi`, and `mystery`. Clients should decide which cache types they support based on their implementation needs.

These requirements are well-known and follow existing standards, such as those outlined on [geocaching.com](https://www.geocaching.com/help/index.php?pg=kb.chapter&id=97).

These events are assumed to be owned by the submitter of the cache, and core details should be maintained by that submitter. However, community logs should also provide context on the current state and validity of the cache.

### Content

The content field contains the cache description and any additional information about the cache.

### Tags

- `d` (required) - unique identifier for the cache
- `name` (required) - human-readable name for the cache  
- `g` (required) - geohash of cache location. To allow for a proximity search, include multiple geohash tags at different precision levels (3-9 characters)
- `D` (required) - integer 1-5 indicating puzzle/finding difficulty (indexed)
- `T` (required) - integer 1-5 indicating physical difficulty (indexed)
- `S` (required) - one of: `micro`, `small`, `regular`, `large`, `other` (indexed)
- `t` (optional) - cache type, with common values including: `traditional`, `multi`, `mystery`. Defaults to `traditional` if not specified
- `hint` (optional) - plaintext hint to help find the cache
- `image` (optional) - image URLs related to the cache
- `r` (optional) - preferred relay URLs for logs
- `verification` (optional) - hex-encoded public key for verifying finds at this cache

## Found Log Event (Kind 7516)

Found log events record successful visits to geocaches:

```json
{
  "kind": 7516,
  "content": "<log message>",
  "tags": [
    ["a", "37515:<pubkey>:<d-tag>"]
  ]
}
```

### Tags

- `a` (required) - reference to the geocache being logged
- `image` (optional) - photos from the visit
- `verification` (optional) - embedded verification event (see Verified Finds section)

## Comment Log Events (Kind 1111)

Non-found logs use comment events (kind `1111`) following NIP-22 comment structure:

```json
{
  "kind": 1111,
  "content": "<log message>",
  "tags": [
    ["A", "37515:<pubkey>:<d-tag>"],
    ["K", "37515"],
    ["P", "<cache-owner-pubkey>"],
    ["a", "37515:<pubkey>:<d-tag>"],
    ["k", "37515"],
    ["p", "<cache-owner-pubkey>"],
    ["t", "<log-type>"]
  ]
}
```

These events capture failures, notes, and status-related information about the cache via human reporting, following the NIP-22 comment threading model where the geocache listing is both the root and parent content.

Comment log types include `dnf` (did not find), `note` (helpful or neutral context), and `maintenance` (cache needs attention). If no `t` tag is present, the comment is assumed to be a general note.

Owners of the cache can officially retire caches using an `archived` tag value in the tag `t`, thus allowing the cache's history to be preserved without fully deleting it.

### Tags

- `A` (required) - root geocache reference (same as `a` for top-level comments)
- `K` (required) - root kind number (`37515`)
- `P` (required) - root author (cache owner pubkey)
- `a` (required) - parent reference (same as `A` for top-level comments)
- `k` (required) - parent kind number (`37515`)
- `p` (required) - parent author (cache owner pubkey)
- `t` (optional) - log type: `dnf`, `note`, `maintenance`, `archived`. If omitted, assumed to be `note`
- `image` (optional) - photos from the visit

## Geocache Verification Event (Kind 7517)

Verification events provide cryptographic proof that a someone physically located a geocache. These events are signed by the cache's verification private key.

```json
{
  "kind": 7517,
  "content": "Geocache verification for <finder-npub>",
  "tags": [
    ["a", "<finder-pubkey-hex>:<geocache-naddr>"]
  ]
}
```

### Content

The content field must follow the static format: `"Geocache verification for <finder-npub>"` where `<finder-npub>` is the NIP-19 encoded public key (npub) of the person who found the cache.

### Tags

- `a` (required) - composite identifier containing the finder's pubkey in hex format and the geocache naddr being verified

### Usage

Verification events are created when a finder obtains access to the cache's verification private key (typically via QR code at the cache location). The event must be signed by the cache's verification private key and can be:

1. Embedded in the `verification` tag as a JSON string in the Verified Found Log event (kind 7516).
2. Published to relays as standalone events
3. Both embedded and published for redundancy

## Verified Finds

Geocaches with verification enabled can provide cryptographic proof that a finder physically located the cache. This is accomplished through a verification event (kind 7517) signed by the cache's verification key.

### Verification Process

When a cache has a `verification` tag containing a public key, finders can create a verified log by:

1. Obtaining the cache's verification private key (typically via QR code at the cache location)
2. Creating a verification event (kind 7517) signed by this key
3. Embedding the verification event in their log entry

### Verification Validation

To validate a verified find:

1. Check that the verification event is signed by the expected verification public key
2. Verify that the finder pubkey in the `a` tag matches the log author
3. Confirm the geocache naddr in the `a` tag correctly references the target cache
4. Validate the event signature using standard Nostr verification

## Clients

For the best Geocaching experience, clients implementing geocaching support should:

- Support hint encoding, such as ROT13, to prevent spoilers.
- Determine cache status from recent log patterns. Multiple DNF entries and/or maintenance notes would indicate an issue with the cache.
- Publish logs to relays specified in the cache's `r` tags when available.
- Validate geohash precision meets minimum requirements (8+ characters, 9+ for micro caches) before accepting cache submissions.

## Examples

### Basic Cache

```json
{
  "kind": 37516,
  "content": "The first Nostr treasure, left in the aftermath of Oslo Freedom Forum!",
  "tags": [
    ["d", "first-treasure-1748619568668"],
    ["name", "First Treasure"], 
    ["g", "u4x"],
    ["g", "u4xs"],
    ["g", "u4xsu"],
    ["g", "u4xsu6"],
    ["g", "u4xsu6r"],
    ["g", "u4xsu6ry"],
    ["g", "u4xsu6ryb"],
    ["D", "1"],
    ["T", "1"],
    ["S", "small"],
    ["t", "traditional"],
    ["hint", "In the branches"],
    ["image", "https://blossom.primal.net/74efe01a767b27dead71b8a9bb8278a108360438e78e55194ed9ab14a9382dd3.jpg"]
  ]
}
```

### Verified Cache

```json
{
  "kind": 37516,
  "content": "High-security treasure requiring physical verification!",
  "tags": [
    ["d", "verified-treasure-1748619568669"],
    ["name", "Verified Treasure"], 
    ["g", "u4xsu6ry"],
    ["D", "3"],
    ["T", "2"],
    ["S", "small"],
    ["t", "traditional"],
    ["hint", "Look for the secret code"],
    ["verification", "6805d4e5c0df48b4f76e2fdcb67a2acb1d97567b01c6fe17a236dc32f34f1c07"]
  ]
}
```

### Found Log

```json
{
  "kind": 7516,
  "content": "Found it! Great hiding spot.",
  "tags": [
    ["a", "37515:0461fcbecc4c3374439932d6b8f11269ccdb7cc973ad7a50ae362db135a474dd:first-treasure-1748619568668"]
  ]
}
```

### DNF Log

```json
{
  "kind": 1111,
  "content": "Searched for 30 minutes but couldn't find it. Maybe it's missing?",
  "tags": [
    ["A", "37515:0461fcbecc4c3374439932d6b8f11269ccdb7cc973ad7a50ae362db135a474dd:first-treasure-1748619568668"],
    ["K", "37515"],
    ["P", "0461fcbecc4c3374439932d6b8f11269ccdb7cc973ad7a50ae362db135a474dd"],
    ["a", "37515:0461fcbecc4c3374439932d6b8f11269ccdb7cc973ad7a50ae362db135a474dd:first-treasure-1748619568668"],
    ["k", "37515"],
    ["p", "0461fcbecc4c3374439932d6b8f11269ccdb7cc973ad7a50ae362db135a474dd"],
    ["t", "dnf"]
  ]
}
```

### Note Log

```json
{
  "kind": 1111,
  "content": "Lots of muggles around during the day. Best to visit in the evening.",
  "tags": [
    ["A", "37515:0461fcbecc4c3374439932d6b8f11269ccdb7cc973ad7a50ae362db135a474dd:first-treasure-1748619568668"],
    ["K", "37515"],
    ["P", "0461fcbecc4c3374439932d6b8f11269ccdb7cc973ad7a50ae362db135a474dd"],
    ["a", "37515:0461fcbecc4c3374439932d6b8f11269ccdb7cc973ad7a50ae362db135a474dd:first-treasure-1748619568668"],
    ["k", "37515"],
    ["p", "0461fcbecc4c3374439932d6b8f11269ccdb7cc973ad7a50ae362db135a474dd"],
    ["t", "note"]
  ]
}
```

### Verification Event

```json
{
  "kind": 7517,
  "content": "Geocache verification for npub1qc0lc5lxnhxnfxlw2lxkv4x4vp6xsf4d5qwvlhfx6qmz6x4nfhqd8h2z3",
  "tags": [
    ["a", "0461fcbecc4c3374439932d6b8f11269ccdb7cc973ad7a50ae362db135a474dd:naddr1qqxnzd3e8q6n2dfk8qcnjve48qmnsw3jsqgswaehxw309aex2mrp0yhx6tpdsek6w309aex2mrp0yh56tnwdus8vatjvs6kzdrz956k7tjzw6qzypzgd2dmgxhxf34hnlw2y03nckr8f4g6mw9flxqq65v94zkp77rqfgrf8"]
  ],
  "pubkey": "6805d4e5c0df48b4f76e2fdcb67a2acb1d97567b01c6fe17a236dc32f34f1c07",
  "created_at": 1672531200,
  "sig": "a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456789012345678901234567890abcdef1234567890abcdef1234567890abcdef12"
}
```

### Verified Found Log

```json
{
  "kind": 7516,
  "content": "Found it! Great hiding spot.",
  "tags": [
    ["a", "37515:0461fcbecc4c3374439932d6b8f11269ccdb7cc973ad7a50ae362db135a474dd:verified-treasure-1748619568669"],
    ["verification", "{\"kind\":7517,\"content\":\"Geocache verification for npub1qc0lc5lxnhxnfxlw2lxkv4x4vp6xsf4d5qwvlhfx6qmz6x4nfhqd8h2z3\",\"tags\":[[\"a\",\"0461fcbecc4c3374439932d6b8f11269ccdb7cc973ad7a50ae362db135a474dd:naddr1qqxnzd3e8q6n2dfk8qcnjve48qmnsw3jsqgswaehxw309aex2mrp0yhx6tpdsek6w309aex2mrp0yh56tnwdus8vatjvs6kzdrz956k7tjzw6qzypzgd2dmgxhxf34hnlw2y03nckr8f4g6mw9flxqq65v94zkp77rqfgrf8\"]],\"pubkey\":\"6805d4e5c0df48b4f76e2fdcb67a2acb1d97567b01c6fe17a236dc32f34f1c07\",\"created_at\":1672531200,\"sig\":\"a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456789012345678901234567890abcdef1234567890abcdef1234567890abcdef12\"}"]
  ]
}
```
