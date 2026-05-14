NIP-GD
======

Good Deed
---------

`draft` `optional`

This NIP defines a Nostr event for first-person attestations of good deeds — acts of kindness, service, charity, environmental stewardship, completed challenges, fulfilled pledges, or any other pro-social act the author wishes to record and share.

A Good Deed is **self-attested**. It is the author's first-person claim that they performed a beneficial act. It is not a verification, an award, an endorsement, or a transaction. Readers form their own judgment about the truth and merit of any given deed, the same way they evaluate any other first-person content on Nostr.

The kind number **`5777`** is chosen for its symbolism: across multiple traditions and pop-numerology readings, **`777`** signifies completion or divine favor and **`5`** signifies service. Together they read as "good acts of service."

## Event Kind

| Kind   | Description | Type    |
| ------ | ----------- | ------- |
| `5777` | Good Deed   | Regular |

Good Deed events are regular events (non-replaceable). Each deed is an event-in-history, not editable state. To correct or retract a deed, authors SHOULD use [NIP-09](09.md) deletion requests.

## Event Structure

```jsonc
{
  "kind": 5777,
  "content": "<first-person account of the deed>",
  "tags": [
    // Optional reference(s) to the thing(s) that prompted or motivated the deed
    ["a", "<kind>:<pubkey>:<d-tag>"],   // addressable event (e.g. a quest, challenge)
    ["e", "<event-id>"],                // regular event
    ["i", "<nip73-identifier>"],        // external identifier per NIP-73

    // Optional beneficiaries (people who benefited from the deed)
    ["p", "<pubkey>"],

    // Optional categorization
    ["t", "<category>"],

    // Optional media (per NIP-92)
    ["imeta", "url <url>", "m <mime>", "alt <description>", ...],

    // Optional location
    ["g", "<geohash>"]
  ]
}
```

### Content

The `content` field contains a first-person narrative description of the deed. It is human-readable plaintext.

The author SHOULD describe what they did in their own words. There is no required format. Brevity, length, and tone are all at the author's discretion.

### Tags

#### References — what prompted the deed

Zero or more of `a`, `e`, and `i` tags MAY be present, indicating things that prompted, motivated, or are referenced by the deed.

- `a` — an addressable event (e.g. a challenge, a quest, a pledge, a curated list, an article)
- `e` — a regular event (e.g. a post inviting action)
- `i` — an external identifier per [NIP-73](73.md) (e.g. a URL, a hashtag, an ISBN)

A Good Deed MAY reference nothing. Many deeds arise spontaneously and reference no prior event.

A Good Deed MAY reference multiple things if a single act fulfilled multiple prompts.

When a reference is present, clients SHOULD display the deed in the context of the referenced thing (e.g. on the referenced event's page, in a feed about a hashtag, etc.).

#### Beneficiaries — `p`

Zero or more `p` tags MAY identify pubkeys who benefited from the deed. Beneficiary tags carry the same semantic as `p` tags in other Nostr events: they are mentions of the listed pubkeys and clients SHOULD notify those pubkeys.

Authors SHOULD obtain consent before publicly tagging beneficiaries when the deed concerns sensitive matters (financial assistance, personal support, etc.).

#### Categorization — `t`

Zero or more `t` tags MAY categorize the deed. Categories are free-form strings. Common values include:

- `environmental` — cleanup, restoration, conservation
- `community` — local-community-oriented acts
- `service` — direct service to individuals
- `kindness` — interpersonal acts of consideration
- `charity` — financial or material giving
- `creative` — creative gifts, public art, sharing skills
- `learning` — teaching, mentoring, tutoring
- `health` — health-related help (donations, support, presence)
- `quest` — completion of a referenced challenge or quest

Clients MAY define and surface additional categories. There is no closed list.

#### Media — `imeta`

Media attachments MUST use `imeta` tags per [NIP-92](92.md). Authors MAY include URLs in `content` alongside `imeta` tags describing them.

#### Location — `g`

A `g` tag MAY contain a geohash indicating where the deed took place. Multiple `g` tags at different precision levels MAY be included to enable proximity discovery, following the same convention used by other location-aware NIPs.

Authors SHOULD use lower-precision geohashes (4–6 characters) for privacy when the precise location is sensitive.

## Common Tags

This NIP relies on a few tags whose semantics are general enough to be reused by other event kinds. They are documented here for clarity.

### `mission`

A `mission` tag declares an objective that a finder, participant, or actor is expected to complete in the context of the event that bears it.

```
["mission", "<text describing the objective>"]
```

An event MAY include zero or more `mission` tags. Multiple tags represent an ordered list of sub-objectives; their order in the event's tag list is significant.

Specific event kinds MAY further constrain `mission` multiplicity. For example, [NIP-GC](NIP-GC.md) geocache listings (kind `37516`) restrict treasures to at most one `mission` tag.

A Good Deed event MAY reference an event containing one or more `mission` tags via its `a`, `e`, or `i` reference tags. The deed's `content` describes which mission(s) were completed and how. This NIP intentionally does not define a structured way to indicate which specific mission a deed completes — natural-language description in `content` is sufficient for v1.

## Examples

### A simple deed with no reference

```jsonc
{
  "kind": 5777,
  "content": "Picked up trash along the river trail this morning. Two bags worth.",
  "tags": [
    ["t", "environmental"],
    ["g", "9q8yy"]
  ],
  // ...
}
```

### A deed with media

```jsonc
{
  "kind": 5777,
  "content": "Helped my neighbor build a raised garden bed. Photo of the finished work below.\n\nhttps://blossom.example.com/garden.jpg",
  "tags": [
    ["t", "community"],
    ["t", "service"],
    ["imeta",
      "url https://blossom.example.com/garden.jpg",
      "m image/jpeg",
      "alt A freshly built cedar raised garden bed full of soil",
      "dim 1920x1080"
    ]
  ],
  // ...
}
```

### A deed referencing a quest (cross-NIP integration)

A Good Deed completing a Key Quest defined by an NIP-GC geocache:

```jsonc
{
  "kind": 5777,
  "content": "Solved the riddle and brought the acorn from the old oak, as the Key Quest required.",
  "tags": [
    ["a", "37516:c4f5...e7a7:riddle-of-the-old-oak-1748619568670"],
    ["p", "c4f5...e7a7"],
    ["t", "quest"],
    ["imeta",
      "url https://blossom.example.com/acorn.jpg",
      "m image/jpeg",
      "alt An acorn from the old oak resting on the cache log"
    ]
  ],
  // ...
}
```

### A deed with a beneficiary

```jsonc
{
  "kind": 5777,
  "content": "Spent the afternoon helping @alice move into her new apartment. So many books.",
  "tags": [
    ["p", "<alice-pubkey>"],
    ["t", "service"],
    ["t", "kindness"]
  ],
  // ...
}
```

## Client Guidance

### Display

Clients SHOULD render Good Deeds in a way that is visually distinct from generic short notes (kind 1) and comments (kind 1111). A Good Deed is a statement of action, not a thought or reply, and the UI should reflect that.

Clients MAY group, count, and surface Good Deeds in dedicated feeds, profile sections, or activity summaries.

### Verification

Good Deeds are self-attested. Clients MUST NOT display them as "verified" by default. Clients MAY surface third-party attestations (e.g. via [NIP-Attestation] events targeting a Good Deed), reactions, zaps, or comments that respond to the deed, but the deed itself carries only the author's signature.

### Beneficiary perspective

A user mentioned via `p` in a Good Deed MAY respond with a reaction, comment, or their own counter-deed. Clients MAY surface a "deeds done for you" or "thanked by" view to help users notice and respond to deeds in which they are named.

### Reactions and Zaps

Standard Nostr primitives apply naturally:

- [NIP-25](25.md) reactions express appreciation
- [NIP-57](57.md) zaps reward the doer financially
- [NIP-22](22.md) comments engage in discussion
- [NIP-58](58.md) badges may be awarded by anyone who wishes to mint recognition

The Good Deed primitive defines the *act of telling*. All forms of social response are layered on top using existing NIPs.

### Aggregation

Clients implementing user-level deed counts SHOULD count all Good Deeds authored by a given pubkey.

Clients SHOULD NOT silently filter out Good Deeds that lack `imeta`, `a`/`e`/`i` references, or other optional content. The author's narrative `content` is sufficient.

## Cross-NIP Integration: Key Quests in NIP-GC

For geocache events (kind `37516`) that include a `mission` tag (a "Key Quest" requirement), clients SHOULD treat Good Deed events whose `a` tag references the cache as completions of the Key Quest. Display behavior is left to the client, but a natural pattern is a dedicated "Quest Completions" section on the cache's listing page.

Clients SHOULD NOT require any form of verification (cryptographic or otherwise) before displaying a Good Deed completion claim. The cache owner or any third party MAY layer attestation, reactions, badges, or zaps on top using existing NIPs.

## Privacy Considerations

- A Good Deed is a **publication**. Once signed and published it is public, permanent, and unredactable in practice. Authors who want a private record of their actions SHOULD use a local journal application, not this NIP.
- Authors SHOULD think carefully before tagging beneficiaries publicly. Anonymous giving is a legitimate and culturally significant mode in many traditions, and may be better served by not publishing a deed at all.
- Geohashes leak location. Authors SHOULD lower precision or omit `g` tags entirely when the location is sensitive.

## Anti-Spam and Trust

This NIP intentionally specifies no verification, gatekeeping, or trust mechanism. Anyone can publish any Good Deed, true or false. This is the same trust model as all other first-person content on Nostr.

Clients SHOULD apply their existing trust, follow-graph, and moderation heuristics when surfacing Good Deeds. Clients MAY weight deeds by author trust, attestation count, zap volume, or any other signal they choose.

## Rationale

The "good deed" concept exists in nearly every human moral tradition: *mitzvah* (Jewish), *good works* (Christian), *seva* (Hindu/Sikh), *sadaqah* (Islamic), *meritorious action* (Buddhist), and secular ethical traditions all recognize the value of recording and sharing pro-social acts.

Existing Nostr primitives do not capture this speech act:

- **Notes (kind 1)** are generic short-form text; deeds need stronger semantics for clients to surface them as acts rather than thoughts.
- **Comments (kind 1111)** are conversation; deeds are first-person assertion.
- **Reactions (kind 7)** are micro-signals about other content; deeds are content in their own right.
- **Badges ([NIP-58](58.md))** are issuer-awarded; deeds are self-authored.
- **Attestations (NIP-Attestation drafts)** are third-party verifications; deeds are first-person.
- **Highlights ([NIP-84](84.md))** select content; deeds describe action.

Defining a small, focused kind for "I did a good thing" enables a cluster of pro-social features (deed feeds, profile deed counts, quest completion tracking, charity logging, kindness challenges) that are difficult or impossible to build coherently on top of generic kinds.

The kind number `5777` is chosen to be memorable, symbolic, and unused. Verification at the time of writing showed no collisions on major relays.

## Acknowledgments

This NIP emerged from work on [NIP-GC](NIP-GC.md) geocaching, specifically the Key Quest feature, which surfaced the need for a primitive that could express "proof of completing a referenced challenge" in a generalizable, interoperable way.
