import { describe, it, expect } from 'vitest';

import { deepLinkToRoute } from './useNativeDeepLinks';

describe('deepLinkToRoute', () => {
  it('returns null for a host we do not own', () => {
    expect(deepLinkToRoute('https://evil.example/settings')).toBeNull();
    expect(deepLinkToRoute('https://treasures.to.evil.example/settings')).toBeNull();
  });

  it('returns null for an unparseable URL', () => {
    expect(deepLinkToRoute('not a url')).toBeNull();
  });

  it('preserves the hash on a claim URL (naddr catch-all)', () => {
    // `/<naddr>#verify=<nsec>` is the claim flow — a single read-only segment.
    expect(deepLinkToRoute('https://treasures.to/naddr1abc#verify=nsec1xyz')).toBe(
      '/naddr1abc#verify=nsec1xyz',
    );
  });

  it('preserves search params on the create flow', () => {
    expect(deepLinkToRoute('https://treasures.to/create-cache?claimUrl=foo')).toBe(
      '/create-cache?claimUrl=foo',
    );
  });

  it('allows enumerated multi-segment routes', () => {
    expect(deepLinkToRoute('https://treasures.to/adventure/naddr1abc')).toBe('/adventure/naddr1abc');
    expect(deepLinkToRoute('https://treasures.to/blog/pub123/my-post')).toBe('/blog/pub123/my-post');
    expect(deepLinkToRoute('https://www.treasures.to/profile/pub123')).toBe('/profile/pub123');
  });

  it('maps the bare origin to the home route', () => {
    expect(deepLinkToRoute('https://treasures.to/')).toBe('/');
  });

  it('blocks an unlisted multi-segment route so no future write-on-mount route is externally triggerable', () => {
    // A hypothetical side-effecting route (cf. the /follow/:npub CSRF class):
    // not on the allowlist, so it must be ignored rather than navigated to.
    expect(deepLinkToRoute('https://treasures.to/follow/npub1attacker')).toBeNull();
    expect(deepLinkToRoute('https://treasures.to/some/deep/unlisted/path')).toBeNull();
  });
});
