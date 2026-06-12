/**
 * Geocache verification utilities using Nostr key pairs.
 *
 * When regenerating a QR code, a new geocache event (kind 37516) is created
 * with a new verification key, invalidating all previous verification keys.
 * Only the most recent verification key from the latest geocache event is valid.
 *
 * Split into focused modules:
 * - `keys`     — verification key pairs, URL building/parsing
 * - `events`   — kind 7517 event creation and cryptographic validation
 * - `qr`       — canvas QR rendering (cards, grid sheets, stamp sheets)
 * - `download` — native/web download and print plumbing
 */

export {
  type VerificationKeyPair,
  generateVerificationKeyPair,
  buildStandardVerificationUrl,
  parseVerificationFromHash,
  verifyKeyPair,
} from './keys';

export {
  createVerificationEvent,
  getEmbeddedVerification,
  verifyEmbeddedVerification,
} from './events';

export {
  generateVerificationQR,
  generateQRStampImage,
  generateQRGridImage,
} from './qr';

export {
  downloadQRCode,
  printQRCode,
} from './download';
