import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { MessageSquare, Share2, LogIn, UserPlus, ShieldCheck } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { LogTypeButtonGroup } from "@/shared/components/ui/mobile-button-patterns";
import { Textarea } from "@/shared/components/ui/textarea";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { EmptyStateCard } from "@/shared/components/ui/card-patterns";
import { LogList } from "@/features/logging/components/LogList";
import { LoginArea } from "@/features/auth/components/LoginArea";
import { LoginDialog } from "@/components/auth";
import SignupDialog from "@/components/auth/SignupDialog";
import { VerifiedLoginPromptDialog } from "@/components/auth/VerifiedLoginPromptDialog";
import { useCurrentUser } from "@/features/auth/hooks/useCurrentUser";
import { useCreateLog } from "@/features/logging/hooks/useCreateLog";
import { useShareLogAsEvent } from "@/features/logging/hooks/useShareLogAsEvent";
import { VerifiedLogForm } from "@/features/logging/components/VerifiedLogForm";
import type { GeocacheLog } from "@/types/geocache";

interface LogsSectionProps {
  logs: GeocacheLog[];
  geocache: {
    id: string;
    name?: string;
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
  const { t } = useTranslation();
  const { user } = useCurrentUser();
  const { mutate: createLog, isPending: isCreatingLog } = useCreateLog();
  const { shareLogAsEvent, isPublishing: isSharing } = useShareLogAsEvent();

  const [logText, setLogText] = useState("");
  const [logType, setLogType] = useState<"found" | "dnf" | "note" | "maintenance" | "archived">("found");
  const [shareToFeed, setShareToFeed] = useState(false);
  const [postingStatus, setPostingStatus] = useState<string>("");
  const [showLoginDialog, setShowLoginDialog] = useState(false);
  const [showSignupDialog, setShowSignupDialog] = useState(false);
  const [showVerifiedLoginPrompt, setShowVerifiedLoginPrompt] = useState(false);

  const handleCreateLog = async () => {
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
      onSuccess: async () => {
        setPostingStatus("Posted! Refreshing...");

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
              isVerified: false
            });
            setPostingStatus("Posted and shared to feed!");
          } catch (error) {
            console.error('Failed to share to feed:', error);
            setPostingStatus("Posted! (Failed to share to feed)");
          }
        } else {
          setPostingStatus("Posted! Refreshing...");
        }

        setLogText("");
        setShareToFeed(false);
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

  const handleLoginClick = () => {
    setShowLoginDialog(true);
  };

  const handleSignupClick = () => {
    setShowVerifiedLoginPrompt(true);
  };

  const handleNormalSignupClick = () => {
    setShowSignupDialog(true);
  };

  const handleLoginDialogClose = () => {
    setShowLoginDialog(false);
  };

  const handleVerifiedPromptClose = () => {
    setShowVerifiedLoginPrompt(false);
  };

  const handleSignupDialogClose = () => {
    setShowSignupDialog(false);
  };

  // Auto-show verified login prompt when user has verification key but is not logged in
  useEffect(() => {
    if (verificationKey && isVerificationValid && !user) {
      setShowVerifiedLoginPrompt(true);
    }
  }, [verificationKey, isVerificationValid, user]);

  return (
    <div className={`space-y-4 ${className || ''}`}>
      {/* Show verified form if verification key is valid and user is logged in */}
      {user && verificationKey && isVerificationValid && !hideForm && (
        <VerifiedLogForm
          geocache={geocache}
          verificationKey={verificationKey}
          compact={compact}
        />
      )}

      {/* Show regular form for logged-in users (unless they have verification) */}
      {user && !(verificationKey && isVerificationValid) && !hideForm && (
        <div className="lg:rounded-lg lg:border lg:bg-card lg:shadow-sm">
          {!compact && (
            <div className="lg:p-6 lg:pb-0 px-4 sm:p-4 lg:pt-6 sm:pt-2">
              <h3 className="text-lg font-semibold text-card-foreground">{t('logs.post.title')}</h3>
            </div>
          )}
          <div className={compact ? "p-4 space-y-3" : "lg:p-6 lg:pt-0 p-4 space-y-4 lg:pb-6 pb-2"}>
            <LogTypeButtonGroup
              logType={logType}
              onLogTypeChange={(type) => setLogType(type as typeof logType)}
              isOwner={isOwner}
              disabled={isCreatingLog}
            />

            <Textarea
              placeholder={t('logs.post.placeholder')}
              value={logText}
              onChange={(e) => setLogText(e.target.value)}
              rows={compact ? 3 : 4}
              className={`text-primary ${compact && "text-sm"}`}
            />

            {/* Only show share option for "found" logs */}
            {logType === 'found' && (
              <div className="flex items-center space-x-2 text-primary">
                <Checkbox
                  id="share-to-feed"
                  checked={shareToFeed}
                  onCheckedChange={(checked) => setShareToFeed(checked as boolean)}
                  disabled={isCreatingLog || isSharing}
                />
                <label
                  htmlFor="share-to-feed"
                  className={`flex items-center gap-1 text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 ${compact ? "text-xs" : ""}`}
                >
                  <Share2 className="h-3 w-3" />
                  {t('logs.post.shareToFeed')}
                </label>
              </div>
            )}

            <Button
              onClick={handleCreateLog}
              disabled={!logText.trim() || isCreatingLog || isSharing}
              size={compact ? "sm" : "default"}
              className="w-full"
            >
              {isCreatingLog || isSharing ? t('logs.post.posting') : t('logs.post.button')}
            </Button>

            {postingStatus && (
              <p className={`text-muted-foreground text-center ${compact ? "text-xs" : "text-sm"}`}>
                {postingStatus}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Login prompt for non-logged in users */}
      {!user && !hideForm && (
        <div className="lg:rounded-lg lg:border lg:bg-card lg:shadow-sm">
          {!compact && (
            <div className="lg:p-6 lg:pb-0 px-4 sm:p-4 lg:pt-6 sm:pt-2">
              <h3 className="text-lg font-semibold text-card-foreground">{t('logs.logYourFind.title')}</h3>
            </div>
          )}
          <div className={compact ? "p-4 space-y-3" : "lg:p-6 lg:pt-0 p-4 space-y-4 lg:pb-6 pb-2"}>
            {/* Special prompt for verified found logs */}
            {verificationKey && isVerificationValid ? (
              <div className="space-y-4">
                <div className="relative p-4 rounded-lg bg-gradient-to-br from-green-50 to-emerald-100 dark:from-green-950/50 dark:to-emerald-950/50 adventure:from-amber-50 adventure:to-orange-100 adventure:dark:from-amber-950/50 adventure:dark:to-orange-950/50 border border-green-200 dark:border-green-800 adventure:border-amber-200 adventure:dark:border-amber-800">
                  <div className="flex items-center gap-2 mb-2">
                    <ShieldCheck className="h-5 w-5 text-green-600 adventure:text-amber-700" />
                    <span className="font-semibold text-green-800 dark:text-green-200 adventure:text-amber-800 adventure:dark:text-amber-200">
                      {t('logs.verified.available')}
                    </span>
                  </div>
                  <p className="text-sm text-green-700 dark:text-green-300 adventure:text-amber-700 adventure:dark:text-amber-300 mb-3">
                    {t('logs.verified.description')}
                  </p>
                  <Button
                    onClick={handleSignupClick}
                    className="w-full bg-green-600 hover:bg-green-700 adventure:bg-amber-700 adventure:hover:bg-amber-800"
                  >
                    <UserPlus className="h-4 w-4 mr-2" />
                    {t('logs.verified.createAccount')}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  {t('logs.logYourFind.description')}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Button
                    onClick={handleNormalSignupClick}
                    variant="default"
                    className="w-full"
                  >
                    <UserPlus className="h-4 w-4 mr-2" />
                    {t('logs.logYourFind.createAccount')}
                  </Button>
                  <Button
                    onClick={handleLoginClick}
                    variant="outline"
                    className="w-full"
                  >
                    <LogIn className="h-4 w-4 mr-2" />
                    {t('logs.logYourFind.logIn')}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {logs && logs.length > 0 ? (
        <LogList logs={logs} compact={compact} onProfileClick={onProfileClick} />
      ) : (
        <EmptyStateCard
          icon={MessageSquare}
          title={t('logs.empty.title')}
          description={compact ? undefined : user ? t('logs.empty.description') : t('logs.empty.descriptionNotLoggedIn')}
          action={!user ? <LoginArea /> : undefined}
        />
      )}

      {/* Login Dialog */}
      <LoginDialog
        isOpen={showLoginDialog}
        onClose={handleLoginDialogClose}
        onLogin={handleLoginDialogClose}
        onSignup={() => {
          setShowLoginDialog(false);
          setShowVerifiedLoginPrompt(true);
        }}
      />

      {/* Signup Dialog */}
      <SignupDialog
        isOpen={showSignupDialog}
        onClose={handleSignupDialogClose}
      />

      {/* Verified Login Prompt Dialog */}
      <VerifiedLoginPromptDialog
        isOpen={showVerifiedLoginPrompt}
        onClose={handleVerifiedPromptClose}
        onLogin={handleLoginClick}
        onSignup={handleSignupClick}
        geocacheName={geocache.name}
      />
    </div>
  );
}