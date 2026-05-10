/**
 * ROT13 encode/decode and detection utilities.
 *
 * In traditional geocaching, hints are often stored as ROT13-encoded text so
 * casual readers don't accidentally see spoilers when scrolling past. When
 * importing or pasting such hints into Treasures, we want to detect that the
 * text is ROT13 and present the decoded version to the user.
 */

/**
 * Apply the ROT13 cipher to a string. ROT13 is its own inverse, so this
 * function is used for both encoding and decoding.
 */
export function rot13(input: string): string {
  let out = "";
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    if (c >= 65 && c <= 90) {
      // A-Z
      out += String.fromCharCode(((c - 65 + 13) % 26) + 65);
    } else if (c >= 97 && c <= 122) {
      // a-z
      out += String.fromCharCode(((c - 97 + 13) % 26) + 97);
    } else {
      out += input[i];
    }
  }
  return out;
}

// Common English short words and geocaching hint vocabulary. Membership-based
// scoring works well because most cache hints are short phrases like
// "under the rock" or "behind the tree near the bench".
const COMMON_WORDS = new Set<string>([
  // Articles, conjunctions, prepositions
  "the", "a", "an", "and", "or", "but", "of", "to", "in", "on", "at",
  "by", "for", "with", "from", "into", "near", "under", "over", "above",
  "below", "behind", "beside", "between", "inside", "outside", "around",
  "is", "are", "be", "it", "its", "this", "that", "these", "those",
  "you", "your", "look", "see", "find", "search", "check", "watch",
  "left", "right", "up", "down", "north", "south", "east", "west",
  "top", "bottom", "side", "back", "front", "end", "edge", "corner",
  // Geocaching hint vocabulary
  "tree", "trees", "rock", "rocks", "stone", "stones", "log", "logs",
  "stump", "branch", "root", "roots", "leaves", "bush", "fence", "post",
  "wall", "sign", "bench", "pole", "lamp", "light", "bridge", "trail",
  "path", "river", "creek", "stream", "lake", "pond", "hill", "cave",
  "cache", "magnetic", "hidden", "hide", "small", "large", "big",
  "micro", "nano", "tiny", "covered", "covered", "ground", "leaf",
  "needle", "needles", "bark", "hollow", "cliff", "wood", "metal",
  "gate", "step", "steps", "stair", "stairs", "box", "container",
  "park", "parking", "lot", "way", "feet", "ft", "yards", "yds",
  "meter", "meters", "no", "not", "yes", "do", "don't", "can",
  "very", "quite", "where", "what", "when", "how", "who", "why",
  "make", "take", "use", "go", "come", "get", "put", "place",
  "between", "beneath", "beyond", "without",
]);

/** Tokenize a string into lowercase alphabetic words. */
function tokenize(s: string): string[] {
  return s.toLowerCase().split(/[^a-z]+/i).filter((w) => w.length > 0);
}

/** Count how many vowels are in a word. */
function vowelCount(word: string): number {
  let n = 0;
  for (const ch of word) {
    if ("aeiou".includes(ch)) n++;
  }
  return n;
}

/**
 * Score a string by how "English-like" it appears.
 *
 * Scoring components:
 * - Words found in COMMON_WORDS (heavy weight)
 * - Average ratio of vowels in each word (English words usually have ~38%)
 * - Penalty for words with no vowels at all (likely not English)
 */
function englishScore(text: string): number {
  const words = tokenize(text);
  if (words.length === 0) return 0;

  let commonHits = 0;
  let vowelRatioSum = 0;
  let noVowelWords = 0;

  for (const w of words) {
    if (COMMON_WORDS.has(w)) commonHits++;
    const vc = vowelCount(w);
    if (vc === 0 && w.length >= 2) {
      noVowelWords++;
    }
    vowelRatioSum += vc / w.length;
  }

  const commonRatio = commonHits / words.length;
  const avgVowelRatio = vowelRatioSum / words.length;
  const noVowelRatio = noVowelWords / words.length;

  // Combine: common-word matches matter most, vowel distribution next,
  // big penalty for many vowel-less words (cipher artifacts).
  return commonRatio * 3 + avgVowelRatio - noVowelRatio * 2;
}

/**
 * Heuristic: decide whether the input text appears to be ROT13-encoded.
 *
 * Returns true only when the ROT13-decoded version scores noticeably more
 * English-like than the original. Requires at least one alphabetic word so
 * that very short or non-textual inputs are never flagged.
 */
export function isLikelyRot13(text: string): boolean {
  if (!text) return false;
  const words = tokenize(text);
  if (words.length === 0) return false;

  // Require at least a small amount of alphabetic content to make a judgement.
  const totalAlpha = words.reduce((sum, w) => sum + w.length, 0);
  if (totalAlpha < 4) return false;

  const decoded = rot13(text);
  if (decoded === text) return false; // No alpha characters changed.

  const originalScore = englishScore(text);
  const decodedScore = englishScore(decoded);

  // Require a meaningful margin so we don't decode random text by accident.
  return decodedScore > originalScore + 0.25;
}

/**
 * If the given text appears to be ROT13-encoded, return the decoded version;
 * otherwise return the original text unchanged.
 */
export function maybeDecodeRot13(text: string): string {
  return isLikelyRot13(text) ? rot13(text) : text;
}
