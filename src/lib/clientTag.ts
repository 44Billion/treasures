/**
 * NIP-89 client tag for Treasures.
 *
 * The tag format is:
 *   ["client", <name>, <kind:31990 address>, <relay hint>]
 *
 * The client tag is suppressed on non-https origins (e.g. local http://
 * dev servers) so that local experiments are not attributed to the
 * production client on public relays.
 */

const CLIENT_NAME = "Treasures";

const CLIENT_HANDLER_PUBKEY =
  "86184109eae937d8d6f980b4a0b46da4ef0d983eade403ee1b4c0b6bde238b47";

const CLIENT_HANDLER_D = "cgdgkgvtgnb";

const CLIENT_HANDLER_RELAY = "wss://relay.ditto.pub";

const CLIENT_HANDLER_ADDRESS = `31990:${CLIENT_HANDLER_PUBKEY}:${CLIENT_HANDLER_D}`;

/** Returns the NIP-89 client tag, or null when running on a non-https origin. */
export function getClientTag(): [string, string, string, string] | null {
  if (typeof location === "undefined") return null;
  if (location.protocol !== "https:") return null;
  return ["client", CLIENT_NAME, CLIENT_HANDLER_ADDRESS, CLIENT_HANDLER_RELAY];
}

/**
 * Adds the NIP-89 client tag to the given tags array if one is not already
 * present. Mutates the array in place and is idempotent.
 */
export function ensureClientTag(tags: string[][]): void {
  if (tags.some(([name]) => name === "client")) return;
  const tag = getClientTag();
  if (!tag) return;
  tags.push(tag);
}
