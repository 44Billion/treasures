NIP-GC
======

Geocaching Events
-----------------

`draft` `optional`

This NIP defines event kinds for geocaching activities on Nostr, enabling users to create, discover, and log geocaches in a decentralized manner.

## Motivation

Geocaching is a global treasure hunting game where participants use GPS coordinates to hide and seek containers ("geocaches") at specific locations. This NIP brings geocaching to Nostr, allowing for censorship-resistant, decentralized geocache listings and logs without relying on centralized platforms.

## Event Kinds

This NIP defines two new event kinds:

- `kind:37515`: Geocache listing (addressable event)
- `kind:37516`: Geocache log entry

## Geocache Listing (kind:37515)

A geocache listing is an addressable event that describes a hidden geocache. The event is addressable to allow cache owners to update their listings (e.g., to provide maintenance updates or adjust coordinates).

### Content

The `.content` field MUST be a JSON-stringified object containing the following fields:

```json
{
  "name": "Cache Name",
  "description": "Detailed description of the cache and its location",
  "hint": "Optional encrypted hint to help find the cache",
  "difficulty": 3,
  "terrain": 2,
  "size": "regular",
  "type": "traditional",
  "images": ["https://example.com/image1.jpg", "https://example.com/image2.jpg"]
}
```

#### Field Definitions

- `name` (required): The name of the geocache
- `description` (required): Detailed description including cache placement details and any special instructions
- `hint` (optional): An encrypted hint that can help seekers find the cache. Should be ROT13 encoded by convention
- `difficulty` (required): Integer from 1-5 indicating puzzle/finding difficulty (1=easiest, 5=hardest)
- `terrain` (required): Integer from 1-5 indicating physical difficulty (1=wheelchair accessible, 5=specialized equipment required)
- `size` (required): One of: `"micro"`, `"small"`, `"regular"`, `"large"`
- `type` (required): One of: `"traditional"`, `"multi"`, `"mystery"`, `"earth"`, `"virtual"`, `"letterbox"`, `"event"`
- `images` (optional): Array of image URLs related to the cache location or container

### Tags

Required tags:
- `d` (required): Unique identifier for the geocache
- `g` (required): Geohash of the cache location (minimum 6 characters precision)
- `location` (required): Human-readable location description (e.g., "Central Park, New York")

Optional tags:
- `t` (optional, repeated): Hashtags/categories (e.g., "urban", "forest", "historical")
- `published_at` (optional): Unix timestamp when the cache was first hidden
- `status` (optional): Current cache status - `"active"` (default), `"disabled"`, or `"archived"`

### Example

```json
{
  "kind": 37515,
  "pubkey": "<cache owner's pubkey>",
  "created_at": 1234567890,
  "content": "{\"name\":\"Riverside Mystery\",\"description\":\"A scenic cache along the river trail. Please be mindful of muggles during busy hours.\",\"hint\":\"Ybbx sbe gur byq bnx gerr\",\"difficulty\":2,\"terrain\":3,\"size\":\"small\",\"type\":\"traditional\",\"images\":[\"https://example.com/cache-area.jpg\"]}",
  "tags": [
    ["d", "riverside-mystery-2024"],
    ["g", "dp3wfg"],
    ["location", "Riverside Park, Portland, OR"],
    ["t", "scenic"],
    ["t", "river"],
    ["published_at", "1704067200"],
    ["status", "active"]
  ]
}
```

## Geocache Log (kind:37516)

A geocache log represents a user's visit to a geocache. These are regular (non-addressable) events.

### Content

The `.content` field MUST be a JSON-stringified object containing:

```json
{
  "type": "found",
  "text": "Great cache! TFTC. The hint was very helpful.",
  "images": ["https://example.com/log-photo.jpg"]
}
```

#### Field Definitions

- `type` (required): One of:
  - `"found"`: Successfully found the cache
  - `"dnf"`: Did Not Find despite searching
  - `"note"`: General comment without searching
  - `"maintenance"`: Maintenance performed by cache owner
  - `"disabled"`: Cache temporarily disabled by owner
  - `"enabled"`: Cache re-enabled by owner
  - `"archived"`: Cache permanently retired
- `text` (required): The log message
- `images` (optional): Array of image URLs from the visit

### Tags

Required tags:
- `a` (required): Reference to the geocache being logged using NIP-01 `a` tag format: `["a", "37515:<cache-owner-pubkey>:<d-tag>", "<optional-relay-url>"]`

Optional tags:
- `g` (optional): Geohash of where the log was created (for privacy, should be less precise than cache location)
- `published_at` (optional): Unix timestamp of the actual visit (may differ from event creation time)

### Example

```json
{
  "kind": 37516,
  "pubkey": "<finder's pubkey>",
  "created_at": 1234567890,
  "content": "{\"type\":\"found\",\"text\":\"Beautiful location! Took me 20 minutes to find it. TFTC!\",\"images\":[\"https://example.com/selfie.jpg\"]}",
  "tags": [
    ["a", "37515:abc123...:riverside-mystery-2024", "wss://relay.example.com"],
    ["g", "dp3w"],
    ["published_at", "1704153600"]
  ]
}
```

## Client Implementation Notes

### Querying Geocaches

Clients SHOULD use the following filters to query geocaches:

1. **All active geocaches**: `{"kinds": [37515], "#status": ["active"]}`
2. **Geocaches by location**: `{"kinds": [37515], "#g": ["dp3w"]}` (using geohash prefix)
3. **Geocaches by type**: `{"kinds": [37515], "#t": ["mystery"]}`
4. **User's hidden caches**: `{"kinds": [37515], "authors": ["<pubkey>"]}`

### Querying Logs

1. **Logs for a specific cache**: `{"kinds": [37516], "#a": ["37515:<pubkey>:<d-tag>"]}`
2. **User's found caches**: Query user's logs with type "found", then fetch referenced caches
3. **Recent activity**: `{"kinds": [37516], "limit": 50}` with time-based sorting

### Privacy Considerations

- Log events MAY include less precise geohashes than the cache location to protect finder privacy
- Clients SHOULD warn users before publishing precise location data
- Images SHOULD have EXIF location data stripped before uploading

### Coordinate Handling

- Coordinates SHOULD be stored as geohashes for efficient geographic queries
- Clients MUST support at least 6-character geohash precision (±0.61km)
- For display, clients SHOULD convert between geohash and decimal degrees

### Statistics

Clients MAY calculate statistics by counting log events:
- **Find count**: Count of logs with `type: "found"` for a cache
- **DNF rate**: Ratio of "dnf" to total "found" + "dnf" logs
- **User stats**: Count of unique caches found by a user

## Appendix: Geocaching Terminology

- **TFTC**: Thanks For The Cache
- **Muggle**: Non-geocacher who might accidentally discover a cache
- **DNF**: Did Not Find
- **FTF**: First To Find
- **Cache**: Short for geocache
- **CO**: Cache Owner
- **Geohash**: A geographic encoding system that represents coordinates as a short alphanumeric string

## Security and Spam Considerations

- Clients SHOULD implement rate limiting for cache creation
- Cache owners SHOULD be able to delete/archive their own caches
- Clients MAY implement reputation systems based on found/hidden ratios
- Clients SHOULD verify that log coordinates are reasonably close to cache coordinates

## Future Considerations

This NIP intentionally keeps the initial implementation simple. Future NIPs may define:
- Trackable items that move between caches
- Event caches with specific date/time meetups
- Challenge caches with specific finding requirements
- Puzzle solutions stored as encrypted content
- Integration with Lightning for premium caches or tips