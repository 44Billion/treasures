/**
 * Tests for Lightning Piggy client-tag branding.
 *
 * Treasures created by the Lightning Piggy client (kind-37516 events with
 * a `["client", "Lightning Piggy"]` tag) render a pig (Lucide PiggyBank)
 * in place of the type glyph: pink-on-normal-backdrop on cards, and
 * white-on-pink (`PIGGY_PINK`) on map markers, so piggy treasures are
 * recognizable at a glance.
 */

import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import type { NostrEvent } from '@nostrify/nostrify';
import { parseGeocacheEvent, isLightningPiggyClient, NIP_GC_KINDS } from '@/utils/nip-gc';
import { getCachedCacheIcon, getCachedClaimedFtfIcon } from '@/utils/cacheMapIcons';
import { CacheIcon } from '@/utils/cacheIcons';
import { PIGGY_PINK } from '@/config/cacheIconConstants';

// Minimal valid event scaffold; tests override `tags` to focus on the client tag.
function makeGeocacheEvent(extraTags: string[][]): NostrEvent {
  return {
    id: 'a'.repeat(64),
    pubkey: 'b'.repeat(64),
    created_at: 1700000000,
    kind: NIP_GC_KINDS.GEOCACHE,
    content: 'test treasure',
    sig: '0'.repeat(128),
    tags: [
      ['d', 'test-treasure'],
      ['name', 'Test Treasure'],
      ['g', 'u4xsu6ry'],
      ['D', '2'],
      ['T', '2'],
      ['S', 'small'],
      ...extraTags,
    ],
  };
}

describe('isLightningPiggyClient', () => {
  it('matches the real-world Lightning Piggy client tag value', () => {
    expect(isLightningPiggyClient('Lightning Piggy')).toBe(true);
  });

  it('matches case- and separator-insensitively', () => {
    expect(isLightningPiggyClient('lightning piggy')).toBe(true);
    expect(isLightningPiggyClient('LightningPiggy')).toBe(true);
    expect(isLightningPiggyClient('com.lightningpiggy.app')).toBe(true);
  });

  it('rejects other clients and missing values', () => {
    expect(isLightningPiggyClient(undefined)).toBe(false);
    expect(isLightningPiggyClient('')).toBe(false);
    expect(isLightningPiggyClient('Treasures')).toBe(false);
    expect(isLightningPiggyClient('piggy')).toBe(false);
  });
});

describe('parseGeocacheEvent — client tag', () => {
  it('surfaces the Lightning Piggy client tag on the parsed geocache', () => {
    const cache = parseGeocacheEvent(makeGeocacheEvent([
      ['client', 'Lightning Piggy'],
      ['t', 'traditional'],
    ]));
    expect(cache).not.toBeNull();
    expect(cache?.client).toBe('Lightning Piggy');
    expect(isLightningPiggyClient(cache?.client)).toBe(true);
  });

  it('does not flag Treasures-created events as piggy', () => {
    const cache = parseGeocacheEvent(makeGeocacheEvent([
      ['client', 'Treasures', '31990:pubkey:cgdgkgvtgnb', 'wss://relay.ditto.pub'],
    ]));
    expect(cache?.client).toBe('Treasures');
    expect(isLightningPiggyClient(cache?.client)).toBe(false);
  });
});

describe('CacheIcon — isPiggy', () => {
  it('renders a PiggyBank glyph instead of the type glyph', () => {
    const { container } = render(
      <CacheIcon type="traditional" isPiggy />,
    );
    const pig = container.querySelector('.lucide-piggy-bank');
    expect(pig).not.toBeNull();
    // Default theme: pink glyph on the caller's normal backdrop.
    expect(pig?.classList.contains('text-pink-500')).toBe(true);
  });

  it('takes precedence over the art modifier glyph', () => {
    const { container } = render(
      <CacheIcon type="traditional" isArt isPiggy />,
    );
    expect(container.querySelector('.lucide-piggy-bank')).not.toBeNull();
    expect(container.querySelector('.lucide-palette')).toBeNull();
  });

  it('renders the per-type glyph when isPiggy is not set', () => {
    const { container } = render(
      <CacheIcon type="traditional" />,
    );
    expect(container.querySelector('.lucide-piggy-bank')).toBeNull();
  });

  it('swaps to the PiggyBank glyph in the adventure and mojave themes too', () => {
    for (const theme of ['adventure', 'mojave']) {
      const { container } = render(
        <CacheIcon type="traditional" theme={theme} isPiggy />,
      );
      expect(container.querySelector('.lucide-piggy-bank')).not.toBeNull();
    }
  });
});

describe('map markers — piggy variant', () => {
  it('renders a pig glyph on a pink background in the default theme', () => {
    const icon = getCachedCacheIcon('traditional', 'default', false, false, true);
    const html = icon.options.html as string;
    expect(html).toContain(`background: ${PIGGY_PINK}`);
    // PiggyBank snout path (distinct from chest/compass/help-circle glyphs).
    expect(html).toContain('M16 10h.01');
    expect(icon.options.className).toContain('piggy-cache-icon');
  });

  it('does not collide with the non-piggy cached icon of the same type', () => {
    const piggy = getCachedCacheIcon('traditional', 'default', false, false, true);
    const plain = getCachedCacheIcon('traditional', 'default', false, false, false);
    expect(piggy).not.toBe(plain);
    expect(plain.options.html as string).not.toContain(`background: ${PIGGY_PINK}`);
  });

  it('propagates the pig glyph to the claimed-FTF marker variant', () => {
    const icon = getCachedClaimedFtfIcon('traditional', 'default', false, false, true);
    const html = icon.options.html as string;
    expect(html).toContain(`background: ${PIGGY_PINK}`);
    expect(html).toContain('M16 10h.01');
    expect(icon.options.className).toContain('piggy-cache-icon');
  });

  it('keeps theme frames but swaps the glyph in the adventure theme', () => {
    const icon = getCachedCacheIcon('traditional', 'adventure', false, false, true);
    const html = icon.options.html as string;
    expect(html).toContain('M16 10h.01'); // pig glyph
    expect(html).not.toContain(PIGGY_PINK); // theme frame color preserved
  });
});

describe('map markers — hover target class', () => {
  /**
   * Regression: the hover CSS (`.custom-cache-icon:hover .cache-marker-body`)
   * must be able to reach the round marker body in every variant. Markers
   * with corner badges (lightning — which includes Lightning Piggy
   * treasures — and claimed-FTF) wrap the body in a rectangular positioning
   * shell; the old `> div:first-child` selector hit that shell and drew a
   * square box-shadow around the marker on hover.
   */
  function bodyOf(html: string): Element | null {
    const el = document.createElement('div');
    el.innerHTML = html;
    return el.querySelector('.cache-marker-body');
  }

  it('tags the marker body on the plain default-theme marker', () => {
    const icon = getCachedCacheIcon('traditional', 'default', false, false, false);
    const body = bodyOf(icon.options.html as string);
    expect(body).not.toBeNull();
    expect(body?.getAttribute('style')).toContain('border-radius: 50%');
  });

  it('tags the round body (not the badge shell) on lightning piggy markers', () => {
    const icon = getCachedCacheIcon('traditional', 'default', false, true, true);
    const html = icon.options.html as string;
    const body = bodyOf(html);
    expect(body).not.toBeNull();
    // The hover target must be the circular pink body, not the wrapper.
    expect(body?.getAttribute('style')).toContain('border-radius: 50%');
    expect(body?.getAttribute('style')).toContain(`background: ${PIGGY_PINK}`);
    // The badge shell wraps the body, so the shell must NOT be the target.
    const el = document.createElement('div');
    el.innerHTML = html;
    expect(el.firstElementChild?.classList.contains('cache-marker-body')).toBe(false);
  });

  it('tags the body on claimed-FTF and themed variants too', () => {
    const claimed = getCachedClaimedFtfIcon('traditional', 'default', false, true, true);
    expect(bodyOf(claimed.options.html as string)).not.toBeNull();
    for (const theme of ['adventure', 'mojave'] as const) {
      const icon = getCachedCacheIcon('traditional', theme, false, false, true);
      expect(bodyOf(icon.options.html as string)).not.toBeNull();
    }
  });
});
