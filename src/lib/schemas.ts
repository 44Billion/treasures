import { z } from 'zod';

/**
 * Notification read-state and preferences.
 *
 * `cursor` is a Unix timestamp (seconds) of the most recently *viewed*
 * notification. Anything newer than the cursor is considered unread.
 */
export const NotificationSettingsSchema = z
  .object({
    /** Unix timestamp (seconds) of the last viewed notification. */
    cursor: z.number().optional(),
  })
  .passthrough();

/**
 * Encrypted, cross-device app settings stored in a single NIP-78 (kind 30078)
 * addressable event under the `treasures/metadata` `d` tag.
 *
 * The schema is intentionally permissive (`.passthrough()`) so that fields
 * written by a newer client version survive a read-modify-write performed by
 * an older client.
 */
export const EncryptedSettingsSchema = z
  .object({
    /** Notification read-state and preferences. */
    notifications: NotificationSettingsSchema.optional(),
    /** Timestamp (ms) of the last successful settings write. */
    lastSync: z.number().optional(),
  })
  .passthrough();

export type NotificationSettings = z.infer<typeof NotificationSettingsSchema>;
export type EncryptedSettings = z.infer<typeof EncryptedSettingsSchema>;
