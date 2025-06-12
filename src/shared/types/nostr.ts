/**
 * Nostr-specific type definitions
 */

import type { NostrEvent, NostrFilter } from '@nostrify/nostrify';

/** Extended Nostr event with additional metadata */
export interface ExtendedNostrEvent extends NostrEvent {
  /** Cached metadata for performance */
  _metadata?: {
    authorName?: string;
    authorPicture?: string;
    relayUrl?: string;
    verified?: boolean;
  };
}

/** Nostr query parameters */
export interface NostrQueryParams {
  filters: NostrFilter[];
  signal?: AbortSignal;
  timeout?: number;
}

/** Nostr query result */
export interface NostrQueryResult<T = NostrEvent> {
  events: T[];
  fromCache: boolean;
  timestamp: number;
}

/** Nostr publish result */
export interface NostrPublishResult {
  event: NostrEvent;
  success: boolean;
  relayResponses: Array<{
    relay: string;
    success: boolean;
    error?: string;
  }>;
}

/** Nostr signer interface (NIP-07 compatible) */
export interface NostrSigner {
  getPublicKey(): Promise<string>;
  signEvent(event: Partial<NostrEvent>): Promise<NostrEvent>;
  nip04?: {
    encrypt(pubkey: string, plaintext: string): Promise<string>;
    decrypt(pubkey: string, ciphertext: string): Promise<string>;
  };
  nip44?: {
    encrypt(pubkey: string, plaintext: string): Promise<string>;
    decrypt(pubkey: string, ciphertext: string): Promise<string>;
  };
}

/** Nostr user account */
export interface NostrAccount {
  pubkey: string;
  signer: NostrSigner;
  metadata?: NostrMetadata;
  relays?: string[];
}

/** Nostr metadata (kind 0) */
export interface NostrMetadata {
  name?: string;
  about?: string;
  picture?: string;
  banner?: string;
  nip05?: string;
  lud06?: string;
  lud16?: string;
  website?: string;
  display_name?: string;
  bot?: boolean;
}

/** Nostr relay information */
export interface NostrRelay {
  url: string;
  read: boolean;
  write: boolean;
  status: 'connected' | 'connecting' | 'disconnected' | 'error';
  error?: string;
}

/** Nostr tag tuple */
export type NostrTag = [string, ...string[]];

/** Common Nostr event kinds */
export enum NostrKind {
  Metadata = 0,
  Text = 1,
  RecommendRelay = 2,
  Contacts = 3,
  EncryptedDirectMessage = 4,
  EventDeletion = 5,
  Repost = 6,
  Reaction = 7,
  BadgeAward = 8,
  GenericRepost = 16,
  ChannelCreation = 40,
  ChannelMetadata = 41,
  ChannelMessage = 42,
  ChannelHideMessage = 43,
  ChannelMuteUser = 44,
  FileMetadata = 1063,
  LiveChatMessage = 1311,
  ProblemTracker = 1971,
  Reporting = 1984,
  Label = 1985,
  CommunityPostApproval = 4550,
  JobRequest = 5000,
  JobResult = 5001,
  JobFeedback = 7000,
  ZapGoal = 9041,
  ZapRequest = 9734,
  Zap = 9735,
  Highlights = 9802,
  MuteList = 10000,
  PinList = 10001,
  RelayListMetadata = 10002,
  BookmarkList = 10003,
  CommunityList = 10004,
  PublicChatsList = 10005,
  BlockedRelaysList = 10006,
  SearchRelaysList = 10007,
  InterestsList = 10015,
  UserEmojiList = 10030,
  DirectMessageRelaysList = 10050,
  FileStorageServerList = 10096,
  WalletInfo = 13194,
  LightningPubRPC = 21000,
  ClientAuthentication = 22242,
  WalletRequest = 23194,
  WalletResponse = 23195,
  NostrWalletAuth = 23196,
  NostrWalletInfo = 23197,
  HTTPAuth = 27235,
  CategorizedPeopleList = 30000,
  CategorizedBookmarksList = 30001,
  RelaySet = 30002,
  BookmarkSet = 30003,
  CuratedSet = 30004,
  VideoSet = 30005,
  InterestSet = 30015,
  CreateOrUpdateStall = 30017,
  CreateOrUpdateProduct = 30018,
  MarketplaceUI = 30019,
  ProductSoldAsAuction = 30020,
  LongFormContent = 30023,
  DraftLongFormContent = 30024,
  EmojiSet = 30030,
  ApplicationSpecificData = 30078,
  LiveEvent = 30311,
  UserStatuses = 30315,
  ClassifiedListing = 30402,
  DraftClassifiedListing = 30403,
  DateBasedCalendarEvent = 31922,
  TimeBasedCalendarEvent = 31923,
  Calendar = 31924,
  CalendarEventRSVP = 31925,
  HandlerRecommendation = 31989,
  HandlerInformation = 31990,
  CommunityDefinition = 34550,
  // Geocaching specific kinds
  Geocache = 1337,
  GeocacheLog = 1338,
}

/** Nostr event template for creating new events */
export interface NostrEventTemplate {
  kind: NostrKind | number;
  content: string;
  tags?: NostrTag[];
  created_at?: number;
}

/** Nostr subscription options */
export interface NostrSubscriptionOptions {
  id?: string;
  closeOnEose?: boolean;
  timeout?: number;
  signal?: AbortSignal;
}

/** Nostr connection status */
export type NostrConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

/** Nostr error types */
export interface NostrError extends Error {
  code?: string;
  relay?: string;
  event?: NostrEvent;
}