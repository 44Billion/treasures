/**
 * Tests for the publish-error classifier helpers.
 *
 * These power the CreateCache catch-block branching: signer-cancellations
 * get a neutral toast and don't auto-save, while network/relay failures
 * trigger the local-draft fallback path.
 */
import { describe, it, expect, vi } from "vitest";
import {
  isUserCancelledPublishError,
  isNetworkPublishError,
  isSignerTimeoutError,
  signEventWithTimeout,
  SIGNER_TIMEOUT_MESSAGE,
} from "@/lib/publishErrors";

describe("publishErrors", () => {
  describe("isUserCancelledPublishError", () => {
    const cancelled = [
      "User rejected the request",
      "user denied signature",
      "User cancelled",
      "user canceled",
      "denied by user",
      "Request rejected",
      "signEvent: rejected",
      "SIGNEVENT denied",
    ];

    for (const msg of cancelled) {
      it(`matches cancellation: "${msg}"`, () => {
        expect(isUserCancelledPublishError(new Error(msg))).toBe(true);
      });
    }

    const nonCancelled = [
      "Connection timeout",
      "Network error",
      "Failed to fetch",
      "Relay unreachable",
      "Internal server error",
    ];

    for (const msg of nonCancelled) {
      it(`does not match non-cancellation: "${msg}"`, () => {
        expect(isUserCancelledPublishError(new Error(msg))).toBe(false);
      });
    }

    it("handles null/undefined/empty errors", () => {
      expect(isUserCancelledPublishError(null)).toBe(false);
      expect(isUserCancelledPublishError(undefined)).toBe(false);
      expect(isUserCancelledPublishError("")).toBe(false);
      expect(isUserCancelledPublishError({})).toBe(false);
    });

    it("handles non-Error throwables (strings, plain objects)", () => {
      expect(isUserCancelledPublishError("User rejected")).toBe(true);
      expect(isUserCancelledPublishError({ message: "user cancelled" })).toBe(true);
    });
  });

  describe("isNetworkPublishError", () => {
    const networkErrors = [
      "Connection timeout",
      "Request timed out",
      "Network unreachable",
      "Failed to fetch",
      "AbortError: signal aborted",
      "Connection refused",
      "Event not found on relays",
      "Relay returned an error",
    ];

    for (const msg of networkErrors) {
      it(`matches network error: "${msg}"`, () => {
        expect(isNetworkPublishError(new Error(msg))).toBe(true);
      });
    }

    it("does not match user-cancellation messages", () => {
      expect(isNetworkPublishError(new Error("User rejected"))).toBe(false);
      expect(isNetworkPublishError(new Error("Signature denied"))).toBe(false);
    });

    it("handles null/undefined/empty errors", () => {
      expect(isNetworkPublishError(null)).toBe(false);
      expect(isNetworkPublishError(undefined)).toBe(false);
      expect(isNetworkPublishError("")).toBe(false);
    });
  });

  describe("isSignerTimeoutError", () => {
    it("matches the signer-timeout marker", () => {
      expect(isSignerTimeoutError(new Error(SIGNER_TIMEOUT_MESSAGE))).toBe(true);
    });

    it("does not match relay/network or cancel errors", () => {
      expect(isSignerTimeoutError(new Error("Connection timeout"))).toBe(false);
      expect(isSignerTimeoutError(new Error("User rejected"))).toBe(false);
    });

    it("handles null/undefined", () => {
      expect(isSignerTimeoutError(null)).toBe(false);
      expect(isSignerTimeoutError(undefined)).toBe(false);
    });
  });

  describe("signEventWithTimeout", () => {
    it("resolves with the signed event when signing completes in time", async () => {
      const signed = { id: "abc" };
      await expect(
        signEventWithTimeout(() => Promise.resolve(signed), 1000),
      ).resolves.toBe(signed);
    });

    it("rejects with the signer-timeout marker when signing hangs", async () => {
      vi.useFakeTimers();
      try {
        const promise = signEventWithTimeout(
          () => new Promise(() => {}), // never resolves
          5000,
        );
        const assertion = expect(promise).rejects.toThrow(SIGNER_TIMEOUT_MESSAGE);
        await vi.advanceTimersByTimeAsync(5000);
        await assertion;
      } finally {
        vi.useRealTimers();
      }
    });

    it("propagates a signer's own error (e.g. user cancel) unchanged", async () => {
      await expect(
        signEventWithTimeout(
          () => Promise.reject(new Error("User rejected")),
          1000,
        ),
      ).rejects.toThrow("User rejected");
    });
  });

  describe("classification boundary", () => {
    // The two classifiers must be mutually exclusive for common cases —
    // otherwise the CreateCache catch block would auto-save on user cancel
    // (we explicitly don't want that).
    it("treats clear cancellations as cancel, not network", () => {
      const err = new Error("User rejected the request");
      expect(isUserCancelledPublishError(err)).toBe(true);
      expect(isNetworkPublishError(err)).toBe(false);
    });

    it("treats timeouts as network, not cancel", () => {
      const err = new Error("Connection timeout after 8000ms");
      expect(isUserCancelledPublishError(err)).toBe(false);
      expect(isNetworkPublishError(err)).toBe(true);
    });
  });
});
