/**
 * Blog posts should detect `nostr:naddr1…` references to treasure listings in
 * their body and render them as rich preview cards, while leaving surrounding
 * markdown intact and ignoring non-geocache addressable identifiers.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import { nip19 } from 'nostr-tools';
import i18n from '@/lib/i18n';
import { NIP_GC_KINDS } from '@/utils/nip-gc';
import type { BlogPost } from '@/types/blog';

// Stub the embed card so the splitter is tested in isolation without pulling
// in the full geocache fetch + zap/log stack. We only assert routing here.
vi.mock('@/components/TreasureEmbedCard', () => ({
  TreasureEmbedCard: ({ naddr }: { naddr: string }) => (
    <div data-testid="treasure-embed">{naddr}</div>
  ),
}));

vi.mock('@/hooks/useAuthor', () => ({
  useAuthor: () => ({ data: null, isLoading: false }),
}));

// Import after mocks are registered.
import { BlogPostDetail } from '@/components/BlogPostDetail';

const PUBKEY = '0'.repeat(64);
const treasureNaddr = nip19.naddrEncode({
  kind: NIP_GC_KINDS.GEOCACHE,
  pubkey: PUBKEY,
  identifier: 'my-treasure',
  relays: [],
});
const blogNaddr = nip19.naddrEncode({
  kind: 30023,
  pubkey: PUBKEY,
  identifier: 'some-post',
  relays: [],
});

function makePost(content: string): BlogPost {
  return {
    id: 'post-1',
    pubkey: PUBKEY,
    title: 'Test Post',
    content,
    summary: '',
    image: '',
    publishedAt: 1_700_000_000,
    createdAt: 1_700_000_000,
    tags: [],
    dTag: 'test-post',
    event: {
      id: 'post-1',
      kind: 30023,
      pubkey: PUBKEY,
      content,
      tags: [],
      created_at: 1_700_000_000,
      sig: '',
    },
  };
}

function renderPost(content: string) {
  return render(
    <MemoryRouter>
      <I18nextProvider i18n={i18n}>
        <BlogPostDetail post={makePost(content)} />
      </I18nextProvider>
    </MemoryRouter>,
  );
}

describe('BlogPostDetail treasure embeds', () => {
  it('renders a treasure preview card for a nostr:naddr reference and keeps surrounding text', () => {
    renderPost(`Check this out:\n\nnostr:${treasureNaddr}\n\nAwesome find.`);

    expect(screen.getByTestId('treasure-embed')).toHaveTextContent(treasureNaddr);
    expect(screen.getByText(/Check this out/)).toBeInTheDocument();
    expect(screen.getByText(/Awesome find\./)).toBeInTheDocument();
  });

  it('handles a bare naddr without the nostr: prefix', () => {
    renderPost(`Here it is: ${treasureNaddr}`);

    expect(screen.getByTestId('treasure-embed')).toHaveTextContent(treasureNaddr);
  });

  it('renders multiple treasure references', () => {
    renderPost(`One nostr:${treasureNaddr} and two nostr:${treasureNaddr}`);

    expect(screen.getAllByTestId('treasure-embed')).toHaveLength(2);
  });

  it('does not embed non-geocache naddr references', () => {
    renderPost(`A blog link nostr:${blogNaddr} stays inline.`);

    expect(screen.queryByTestId('treasure-embed')).toBeNull();
  });
});
