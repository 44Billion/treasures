import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Textarea } from "@/shared/components/ui/textarea";
import { Alert, AlertDescription } from "@/shared/components/ui/alert";
import { useCreateVerifiedLog } from "@/features/logging/hooks/useCreateVerifiedLog";

interface VerifiedLogFormProps {
  geocache: {
    id: string;
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
  
  const [logText, setLogText] = useState("");
  const [postingStatus, setPostingStatus] = useState<string>("");
  
  // Verified logs are always "found" - if they have the verification key, they found it!
  const logType = "found";

  const handleCreateLog = () => {
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
      onSuccess: () => {
        setPostingStatus("Verified log posted successfully!");
        setLogText("");
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
    <Card className={`border-green-500 bg-green-50 dark:bg-green-950 ${className}`}>
      {!compact && (
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-green-700 dark:text-green-300">
            <ShieldCheck className="h-5 w-5 text-green-600" />
            Post a Verified Log
          </CardTitle>
        </CardHeader>
      )}
      <CardContent className={compact ? "p-4 space-y-3" : "space-y-4"}>
        <Alert>
          <ShieldCheck className="h-4 w-4" />
          <AlertDescription>
            You have a valid verification key for this cache. Your "Found it" log will be marked as verified.
          </AlertDescription>
        </Alert>
        
        <Textarea
          placeholder="Share your find experience! What was it like discovering this cache?"
          value={logText}
          onChange={(e) => setLogText(e.target.value)}
          rows={compact ? 3 : 4}
          className={compact ? "text-sm" : ""}
        />
        
        <Button 
          onClick={handleCreateLog} 
          disabled={!logText.trim() || isCreatingLog}
          size={compact ? "sm" : "default"}
          className="w-full bg-green-600 hover:bg-green-700"
        >
          <ShieldCheck className="h-4 w-4 mr-2" />
          {isCreatingLog ? "Posting Verified Log (please wait)..." : "Post Verified Log"}
        </Button>
        
        {postingStatus && (
          <p className={`text-gray-600 text-center ${compact ? "text-xs" : "text-sm"}`}>
            {postingStatus}
          </p>
        )}
      </CardContent>
    </Card>
  );
}