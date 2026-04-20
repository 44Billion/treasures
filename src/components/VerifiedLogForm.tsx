import { useState, useRef, useEffect } from "react";
import { ShieldCheck, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useCreateVerifiedLog } from "@/hooks/useCreateVerifiedLog";
import { useShareLogAsEvent } from "@/hooks/useShareLogAsEvent";

interface VerifiedLogFormProps {
  geocache: {
    id: string;
    name?: string;
    dTag: string;
    pubkey: string;
    relays?: string[];
    kind?: number;
  };
  verificationKey: string;
  compact?: boolean;
  className?: string;
  autoFocus?: boolean;
}

export function VerifiedLogForm({
  geocache,
  verificationKey,
  compact = false,
  className,
  autoFocus = false,
}: VerifiedLogFormProps) {
  const { mutate: createVerifiedLog, isPending: isCreatingLog } = useCreateVerifiedLog();
  const { shareLogAsEvent, isPublishing: isSharing } = useShareLogAsEvent();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [logText, setLogText] = useState("");
  const [shareToFeed, setShareToFeed] = useState(false);
  const [postingStatus, setPostingStatus] = useState<string>("");

  // Auto-focus the textarea after the reveal overlay finishes and scroll completes
  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      const timer = setTimeout(() => {
        textareaRef.current?.focus();
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [autoFocus]);

  const logType = "found";

  const handleCreateLog = async () => {
    if (!logText.trim() || !geocache) return;

    setPostingStatus("Creating verified log...");

    const primaryRelay = geocache.relays?.[0] || '';

    createVerifiedLog({
      geocacheId: geocache.id,
      geocacheDTag: geocache.dTag,
      geocachePubkey: geocache.pubkey,
      geocacheKind: geocache.kind,
      relayUrl: primaryRelay,
      preferredRelays: geocache.relays,
      type: logType,
      text: logText,
      verificationKey,
    }, {
      onSuccess: async () => {
        setPostingStatus("Verified log posted!");

        if (shareToFeed) {
          try {
            setPostingStatus("Sharing to your feed...");
            await shareLogAsEvent({
              geocache: {
                ...geocache,
                name: geocache.name || 'Geocache',
              },
              logText,
              logType,
              isVerified: true,
            });
            setPostingStatus("Posted and shared!");
          } catch (error) {
            console.error('Failed to share to feed:', error);
            setPostingStatus("Posted! (Failed to share to feed)");
          }
        }

        setLogText("");
        setShareToFeed(false);
        setTimeout(() => setPostingStatus(""), 2000);
      },
      onError: () => {
        setPostingStatus("");
      },
    });
  };

  return (
    <div
      data-verified-log-form
      className={`verified-form-enter rounded-lg border border-primary/30 bg-card shadow-sm overflow-hidden ${className ?? ''}`}
    >
      {/* Header */}
      {!compact && (
        <div className="border-b border-primary/10 bg-primary/[0.03] px-4 py-4 md:px-5 md:py-5">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <ShieldCheck className="h-[18px] w-[18px] text-primary" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-semibold text-foreground leading-snug">
                Verified find{geocache.name ? <>: <span className="text-primary">{geocache.name}</span></> : null}
              </h3>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Write about your discovery. This log will be permanently marked as verified.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Form */}
      <div className={compact ? "p-4 space-y-3" : "p-4 md:p-5 space-y-4"}>
        <Textarea
          ref={textareaRef}
          placeholder="How did you find it? What was the experience like?"
          value={logText}
          onChange={(e) => setLogText(e.target.value)}
          rows={compact ? 3 : 4}
          className={compact ? "text-sm" : ""}
        />

        <div className="flex items-center space-x-2">
          <Checkbox
            id="share-to-feed-verified"
            checked={shareToFeed}
            onCheckedChange={(checked) => setShareToFeed(checked as boolean)}
            disabled={isCreatingLog || isSharing}
          />
          <label
            htmlFor="share-to-feed-verified"
            className={`flex items-center gap-1 text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-muted-foreground ${compact ? "text-xs" : ""}`}
          >
            <Share2 className="h-3 w-3" />
            Share to my feed
          </label>
        </div>

        <Button
          onClick={handleCreateLog}
          disabled={!logText.trim() || isCreatingLog || isSharing}
          size={compact ? "sm" : "default"}
          className="w-full"
        >
          <ShieldCheck className="h-4 w-4 mr-2" />
          {isCreatingLog || isSharing ? "Posting..." : "Post Verified Log"}
        </Button>

        {postingStatus && (
          <p className={`text-muted-foreground text-center ${compact ? "text-xs" : "text-sm"}`}>
            {postingStatus}
          </p>
        )}
      </div>
    </div>
  );
}
