import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { writeFileSync, readFileSync, mkdtempSync, rmSync, mkdirSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..');
const SCRIPT_REL = 'scripts/extract-release-notes.mjs';

/**
 * Run the extractor against a synthetic CHANGELOG.md placed in a temp repo
 * layout that mirrors what the real script expects (a `scripts/` dir next
 * to a `CHANGELOG.md`). Returns the captured stdout/stderr and exit status.
 *
 * Uses spawnSync (not execFileSync) so we can capture stderr on success too —
 * the script writes warnings to stderr while still exiting 0.
 */
function runExtractor(changelog: string, args: string[]): { stdout: string; stderr: string; status: number } {
  const tmp = mkdtempSync(join(tmpdir(), 'extract-release-notes-'));
  try {
    mkdirSync(join(tmp, 'scripts'), { recursive: true });
    cpSync(join(REPO_ROOT, SCRIPT_REL), join(tmp, SCRIPT_REL));
    writeFileSync(join(tmp, 'CHANGELOG.md'), changelog, 'utf8');

    const result = spawnSync('node', [SCRIPT_REL, ...args], {
      cwd: tmp,
      encoding: 'utf8',
    });
    return {
      stdout: (result.stdout ?? '').replace(/\n$/, ''),
      stderr: (result.stderr ?? '').replace(/\n$/, ''),
      status: result.status ?? -1,
    };
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

describe('extract-release-notes.mjs', () => {
  const SAMPLE = `# Changelog

## [2.5.1] - 2026-05-28

A short summary paragraph for 2.5.1 with some context.

### Added
- New thing
- Another new thing

### Fixed
- A bug

## [2.5.0] - 2026-05-27

Two-line
summary that should be joined into one space-separated paragraph.

### Added
- Older thing

## [2.0.5] - 2026-04-25

### Fixed
- A legacy entry with no summary paragraph.
`;

  describe('full-body mode', () => {
    it('returns the section body without the version heading', () => {
      const { stdout, status } = runExtractor(SAMPLE, ['2.5.1']);
      expect(status).toBe(0);
      expect(stdout).toContain('A short summary paragraph for 2.5.1');
      expect(stdout).toContain('### Added');
      expect(stdout).toContain('- A bug');
      // Should NOT include the heading itself or the next section.
      expect(stdout).not.toContain('## [2.5.1]');
      expect(stdout).not.toContain('## [2.5.0]');
    });

    it('handles the final (oldest) section by reading to end of file', () => {
      const { stdout, status } = runExtractor(SAMPLE, ['2.0.5']);
      expect(status).toBe(0);
      expect(stdout).toContain('A legacy entry with no summary paragraph.');
    });

    it('accepts both bare and v-prefixed versions', () => {
      const bare = runExtractor(SAMPLE, ['2.5.1']);
      const prefixed = runExtractor(SAMPLE, ['v2.5.1']);
      expect(bare.status).toBe(0);
      expect(prefixed.status).toBe(0);
      expect(bare.stdout).toEqual(prefixed.stdout);
    });
  });

  describe('--summary mode', () => {
    it('emits only the first plain-prose paragraph', () => {
      const { stdout, status } = runExtractor(SAMPLE, ['2.5.1', '--summary']);
      expect(status).toBe(0);
      expect(stdout).toBe('A short summary paragraph for 2.5.1 with some context.');
    });

    it('joins multi-line paragraphs into a single space-separated string', () => {
      const { stdout, status } = runExtractor(SAMPLE, ['2.5.0', '--summary']);
      expect(status).toBe(0);
      expect(stdout).toBe('Two-line summary that should be joined into one space-separated paragraph.');
    });

    it('falls back to "Treasures vX.Y.Z" when no summary paragraph is present', () => {
      const { stdout, status } = runExtractor(SAMPLE, ['2.0.5', '--summary']);
      expect(status).toBe(0);
      expect(stdout).toBe('Treasures v2.0.5');
    });

    it('warns on stderr but exits 0 when a summary exceeds 500 chars', () => {
      const longSummary = 'X'.repeat(600);
      const bigChangelog = `# Changelog

## [2.6.0] - 2026-06-01

${longSummary}

### Added
- huge release
`;
      const { stdout, stderr, status } = runExtractor(bigChangelog, ['2.6.0', '--summary']);
      expect(status).toBe(0);
      expect(stdout.length).toBe(600);
      expect(stderr).toMatch(/Warning.*500/);
    });
  });

  describe('error handling', () => {
    it('exits 1 when the version is not found', () => {
      const { status, stderr } = runExtractor(SAMPLE, ['9.9.9']);
      expect(status).toBe(1);
      expect(stderr).toMatch(/not found/i);
    });

    it('exits 2 on an invalid version argument', () => {
      const { status } = runExtractor(SAMPLE, ['not-a-version']);
      expect(status).toBe(2);
    });

    it('exits 2 when called with no arguments', () => {
      const { status } = runExtractor(SAMPLE, []);
      expect(status).toBe(2);
    });

    it('exits 2 when given an unknown flag', () => {
      const { status } = runExtractor(SAMPLE, ['2.5.1', '--bogus']);
      expect(status).toBe(2);
    });
  });

  describe('against the real CHANGELOG.md', () => {
    it('extracts a valid summary for the current package.json version', () => {
      const pkg = JSON.parse(readFileSync(join(REPO_ROOT, 'package.json'), 'utf8'));
      const version = pkg.version as string;
      const result = spawnSync('node', [SCRIPT_REL, version, '--summary'], {
        cwd: REPO_ROOT,
        encoding: 'utf8',
      });
      expect(result.status).toBe(0);
      const stdout = (result.stdout ?? '').trim();
      expect(stdout.length).toBeGreaterThan(0);
      expect(stdout.length).toBeLessThanOrEqual(500);
    });
  });
});
