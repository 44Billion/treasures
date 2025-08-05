import { useState } from "react";
import { MessageSquare } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { LogTypeButtonGroup } from "@/shared/components/ui/mobile-button-patterns";
import { Textarea } from "@/shared/components/ui/textarea";
import { EmptyStateCard } from "@/shared/components/ui/card-patterns";
import { LogList } from "@/features/logging/components/LogList";
import { LoginArea } from "@/features/auth/components/LoginArea";
import { useCurrentUser } from "@/features/auth/hooks/useCurrentUser";
import { useCreateLog } from "@/features/logging/hooks/useCreateLog";
import { VerifiedLogForm } from "@/features/logging/components/VerifiedLogForm";
import type { GeocacheLog } from "@/types/geocache";

interface LogsSectionProps {
  logs: GeocacheLog[];
  geocache: {
    id: string;
    dTag: string;
    pubkey: string;
    relays?: string[];
    kind?: number;
  };
  onProfileClick?: (pubkey: string) => void;
  compact?: boolean;
  isOwner?: boolean;
  className?: string;
  verificationKey?: string;
  isVerificationValid?: boolean;
  hideForm?: boolean;
}

export function LogsSection({ 
  logs, 
  geocache, 
  onProfileClick, 
  compact = false,
  isOwner = false,
  className,
  verificationKey,
  isVerificationValid = false,
  hideForm = false
}: LogsSectionProps) {
  // Logs received from parent component
  
  const { user } = useCurrentUser();
  const { mutate: createLog, isPending: isCreatingLog } = useCreateLog();
  
  const [logText, setLogText] = useState("");
  const [logType, setLogType] = useState<"found" | "dnf" | "note" | "maintenance" | "archived">("found");
  const [postingStatus, setPostingStatus] = useState<string>("");

  const handleCreateLog = () => {
    if (!logText.trim() || !geocache) return;
    
    setPostingStatus("Signing event...");
    
    // Get the primary relay from the geocache's relay list
    const primaryRelay = geocache.relays?.[0] || '';
    
    createLog({
      geocacheId: geocache.id,
      geocacheDTag: geocache.dTag,
      geocachePubkey: geocache.pubkey,
      geocacheKind: geocache.kind,
      relayUrl: primaryRelay,
      preferredRelays: geocache.relays,
      type: logType,
      text: logText,
    }, {
      onSuccess: () => {
        setPostingStatus("Posted! Refreshing...");
        setLogText("");
        setTimeout(() => {
          setPostingStatus("");
        }, 2000);
      },
      onError: (error) => {
        console.error('Log creation failed:', error);
        setPostingStatus("");
      }
    });
  };

  return (
    <div className={`space-y-4 ${className || ''}`}>
      {/* Show verified form if verification key is valid */}
      {verificationKey && isVerificationValid && !hideForm && (
        <VerifiedLogForm
          geocache={geocache}
          verificationKey={verificationKey}
          compact={compact}
        />
      )}
      
      {/* Show regular form for logged-in users (unless they have verification) */}
      {user && !(verificationKey && isVerificationValid) && !hideForm && (
        <Card>
          {!compact && (
            <CardHeader>
              <CardTitle>Post a Log</CardTitle>
            </CardHeader>
          )}
          <CardContent className={compact ? "p-4 space-y-3" : "space-y-4"}>
            <LogTypeButtonGroup
              logType={logType}
              onLogTypeChange={(type) => setLogType(type as typeof logType)}
              isOwner={isOwner}
              disabled={isCreatingLog}
            />
            
            <Textarea
              placeholder="Share your experience..."
              value={logText}
              onChange={(e) => setLogText(e.target.value)}
              rows={compact ? 3 : 4}
              className={compact ? "text-sm" : ""}
            />
            
            <Button 
              onClick={handleCreateLog} 
              disabled={!logText.trim() || isCreatingLog}
              size={compact ? "sm" : "default"}
              className="w-full"
            >
              {isCreatingLog ? "Posting..." : "Post Log"}
            </Button>
            
            {postingStatus && (
              <p className={`text-gray-600 text-center ${compact ? "text-xs" : "text-sm"}`}>
                {postingStatus}
              </p>
            )}
          </CardContent>
        </Card>
      )}
      
      {logs && logs.length > 0 ? (
        <LogList logs={logs} compact={compact} onProfileClick={onProfileClick} />
      ) : (
        <EmptyStateCard
          icon={MessageSquare}
          title="No logs yet"
          description={compact ? undefined : user ? "Be the first to log this cache!" : "Log in to share your experience with this cache!"}
          action={!user ? <LoginArea /> : undefined}
        />
      )}
    </div>
  );
}