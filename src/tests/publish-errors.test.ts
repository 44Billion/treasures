/**
 * Tests for the publish-error classifier helpers.
 *
 * These power the CreateCache catch-block branching: signer-cancellations
 * get a neutral toast and don't auto-save, while network/relay failures
 * trigger the local-draft fallback path.
 */
import { describe, it, expect } from "vitest";
import {
  isUserCancelledPublishError,
  isNetworkPublishError,
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
