import { useState } from "react";
import { ShieldCheck, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
}

export function VerifiedLogForm({ 
  geocache, 
  verificationKey, 
  compact = false,
  className 
}: VerifiedLogFormProps) {
  const { mutate: createVerifiedLog, isPending: isCreatingLog } = useCreateVerifiedLog();
  const { shareLogAsEvent, isPublishing: isSharing } = useShareLogAsEvent();
  
  const [logText, setLogText] = useState("");
  const [shareToFeed, setShareToFeed] = useState(false);
  const [postingStatus, setPostingStatus] = useState<string>("");
  
  // Verified logs are always "found" - if they have the verification key, they found it!
  const logType = "found";

  const handleCreateLog = async () => {
    if (!logText.trim() || !geocache) return;
    
    setPostingStatus("Creating verified log (this may take a moment)...");
    
    // Get the primary relay from the geocache's relay list
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
        setPostingStatus("Verified log posted successfully!");
        
        // If user wants to share to feed, publish as kind 1 event
        if (shareToFeed) {
          try {
            setPostingStatus("Sharing to your feed...");
            await shareLogAsEvent({
              geocache: {
                ...geocache,
                name: geocache.name || 'Geocache' // Fallback name if not available
              },
              logText,
              logType,
              isVerified: true
            });
            setPostingStatus("Verified log posted and shared to feed!");
          } catch (error) {
            console.error('Failed to share to feed:', error);
            setPostingStatus("Verified log posted! (Failed to share to feed)");
          }
        } else {
          setPostingStatus("Verified log posted successfully!");
        }
        
        setLogText("");
        setShareToFeed(false);
        setTimeout(() => {
          setPostingStatus("");
        }, 2000);
      },
      onError: () => {
        setPostingStatus("");
      }
    });
  };

  return (
    <div className={`lg:rounded-lg lg:border lg:border-primary lg:bg-primary-50 dark:lg:bg-primary-50 lg:shadow-sm ${className}`}>
      {!compact && (
        <div className="lg:p-6 lg:pb-0 p-4 lg:pt-6 pt-2">
          <h3 className="flex items-center gap-2 text-lg font-semibold text-primary">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Post a Verified Log
          </h3>
        </div>
      )}
      <div className={compact ? "p-4 space-y-3" : "lg:p-6 lg:pt-0 p-4 space-y-4 lg:pb-6 pb-2"}>
        <Alert>
          <ShieldCheck className="h-4 w-4" />
          <AlertDescription>
            You have a valid verification key for this cache. Your "Found it" log will be marked as verified.
          </AlertDescription>
        </Alert>
        
        <Textarea
          placeholder="Share your find experience! What was it like discovering this treasure?"
          value={logText}
          onChange={(e) => setLogText(e.target.value)}
          rows={compact ? 3 : 4}
          className={`text-primary ${compact && "text-sm"}`}
        />
        
        <div className="flex items-center space-x-2 text-primary">
          <Checkbox
            id="share-to-feed-verified"
            checked={shareToFeed}
            onCheckedChange={(checked) => setShareToFeed(checked as boolean)}
            disabled={isCreatingLog || isSharing}
          />
          <label
            htmlFor="share-to-feed-verified"
            className={`flex items-center gap-1 text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 ${compact ? "text-xs" : ""}`}
          >
            <Share2 className="h-3 w-3" />
            Share to my feed
          </label>
        </div>
        
        <Button 
          onClick={handleCreateLog} 
          disabled={!logText.trim() || isCreatingLog || isSharing}
          size={compact ? "sm" : "default"}
          className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
        >
          <ShieldCheck className="h-4 w-4 mr-2" />
          {isCreatingLog || isSharing ? "Posting Verified Log (please wait)..." : "Post Verified Log"}
        </Button>
        
        {postingStatus && (
          <p className={`text-gray-600 text-center ${compact ? "text-xs" : "text-sm"}`}>
            {postingStatus}
          </p>
        )}
      </div>
    </div>
  );
}