#!/usr/bin/env node

/**
 * Extract a single version's release notes from CHANGELOG.md.
 *
 * The changelog is the single source of truth for both the GitLab release
 * description and any downstream "What's new" copy (Zapstore, app stores,
 * in-app pages). This script parses it deterministically so CI can pipe the
 * right block into the right place.
 *
 * Usage:
 *   node scripts/extract-release-notes.mjs <version>            # full body (no top ## heading)
 *   node scripts/extract-release-notes.mjs <version> --summary  # first plain-prose paragraph only
 *
 * The version argument should be the bare version (e.g. "2.5.1"), not the
 * "v2.5.1" tag form.
 *
 * Exit codes:
 *   0 on success
 *   1 if the version section is not found in CHANGELOG.md
 *   2 if arguments are invalid
 *
 * In --summary mode the script:
 *   - emits the first non-empty paragraph that appears before any "### " block
 *   - warns on stderr (but still exits 0) if the summary exceeds 500 characters,
 *     because Apple App Store and Google Play both cap "What's new" at 500
 *   - falls back to "Treasures v<version>" if no summary paragraph is present
 *     (legacy entries without summaries)
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SUMMARY_FALLBACK_PREFIX = 'Treasures v';
const STORE_SUMMARY_CHAR_LIMIT = 500;

const __dirname = dirname(fileURLToPath(import.meta.url));
const CHANGELOG_PATH = join(__dirname, '..', 'CHANGELOG.md');

function usage() {
  process.stderr.write(
    'Usage: extract-release-notes.mjs <version> [--summary]\n' +
    '  version: bare semver, e.g. "2.5.1" (not "v2.5.1")\n'
  );
}

function main() {
  const args = process.argv.slice(2);
  if (args.length < 1 || args.length > 2) {
    usage();
    process.exit(2);
  }

  const rawVersion = args[0];
  const summaryMode = args[1] === '--summary';
  if (args[1] && !summaryMode) {
    usage();
    process.exit(2);
  }

  // Accept both "2.5.1" and "v2.5.1" for ergonomics; emit the bare form downstream.
  const version = rawVersion.replace(/^v/, '');
  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    process.stderr.write(`Invalid version: ${rawVersion}\n`);
    process.exit(2);
  }

  let md;
  try {
    md = readFileSync(CHANGELOG_PATH, 'utf8');
  } catch (err) {
    process.stderr.write(`Could not read ${CHANGELOG_PATH}: ${err.message}\n`);
    process.exit(1);
  }

  const section = extractSection(md, version);
  if (!section) {
    process.stderr.write(`Version ${version} not found in CHANGELOG.md\n`);
    process.exit(1);
  }

  if (summaryMode) {
    const summary = extractSummary(section) || `${SUMMARY_FALLBACK_PREFIX}${version}`;
    if (summary.length > STORE_SUMMARY_CHAR_LIMIT) {
      process.stderr.write(
        `Warning: summary for ${version} is ${summary.length} characters ` +
        `(App Store and Google Play cap "What's new" at ${STORE_SUMMARY_CHAR_LIMIT}).\n`
      );
    }
    process.stdout.write(summary + '\n');
    return;
  }

  process.stdout.write(section.body.trimEnd() + '\n');
}

/**
 * Pull out the body of a `## [X.Y.Z] - YYYY-MM-DD` section, stopping at the
 * next `## ` heading or end-of-file. Returns `null` if the version is missing.
 *
 * The returned `body` does NOT include the `## [X.Y.Z]` heading itself, so it
 * can be dropped into a release description that already has its own title.
 */
function extractSection(md, version) {
  const lines = md.split('\n');
  // Escape "." for the regex; version is already validated upstream but be safe.
  const escaped = version.replace(/\./g, '\\.');
  const headingRe = new RegExp(`^## \\[${escaped}\\]`);
  const anyHeadingRe = /^## \[/;

  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (headingRe.test(lines[i])) {
      start = i;
      break;
    }
  }
  if (start === -1) return null;

  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (anyHeadingRe.test(lines[i])) {
      end = i;
      break;
    }
  }

  // Skip the heading line itself; trim leading blank lines for a clean body.
  let bodyStart = start + 1;
  while (bodyStart < end && lines[bodyStart].trim() === '') bodyStart++;

  return {
    heading: lines[start],
    body: lines.slice(bodyStart, end).join('\n'),
  };
}

/**
 * Extract the first plain-prose paragraph from a release section body.
 *
 * A summary paragraph:
 *   - sits before any `### ` subsection (Added / Changed / Fixed / Removed)
 *   - is not a bullet (does not start with `-` or `*`)
 *   - is not blank
 *
 * Multi-line summaries are joined into a single space-separated line so the
 * output is a clean one-paragraph string suitable for store metadata and the
 * in-app "What's new" toast.
 */
function extractSummary(section) {
  const lines = section.body.split('\n');
  const collected = [];
  let started = false;

  for (const line of lines) {
    if (line.startsWith('### ') || line.startsWith('## ')) break;
    const trimmed = line.trim();
    if (!trimmed) {
      // Blank line ends the first paragraph once we've started collecting.
      if (started) break;
      continue;
    }
    // Bullets aren't a summary; stop scanning if we hit one before any prose.
    if (/^[-*]\s/.test(trimmed)) break;
    collected.push(trimmed);
    started = true;
  }

  return collected.join(' ').trim();
}

main();
