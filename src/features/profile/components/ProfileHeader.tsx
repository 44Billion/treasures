import { Calendar, MapPin, User, CheckCircle, ShieldCheck, Copy, Check, AlertCircle, Clock, Bookmark } from "lucide-react";
import { CompassSpinner } from "@/shared/components/ui/loading";
import { formatDistanceToNow } from "@/shared/utils/date";
import { useNip05Status } from "../hooks/useNip05Verification";
import { useState } from "react";
import type { ProfileHeaderProps } from "../types";

export function ProfileHeader({
  pubkey,
  metadata,
  createdAt,
  hiddenCount,
  foundCount,
  savedCount,
  variant = "dialog",
  className = "",
  children,
  onCopy,
  showExtendedDetails = false
}: ProfileHeaderProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  
  const displayName = metadata?.display_name || metadata?.name || pubkey.slice(0, 8);
  const profilePicture = metadata?.picture;
  const nip05 = metadata?.nip05;
  const website = metadata?.website;
  
  const { 
    isVerified, 
    isLoading: isLoadingNip05,
    error: nip05Error,
    isTimeout,
    isNetworkError,
    isInvalidFormat
  } = useNip05Status(nip05, pubkey);

  const handleCopy = async (text: string, field: string) => {
    if (onCopy) {
      onCopy(text, field);
    } else {
      // Fallback copy functionality
      try {
        await navigator.clipboard.writeText(text);
        setCopiedField(field);
        setTimeout(() => setCopiedField(null), 2000);
      } catch (error) {
        console.warn('Failed to copy to clipboard:', error);
      }
    }
  };

  const isPageVariant = variant === "page";
  const avatarSize = isPageVariant ? "w-20 h-20 sm:w-24 sm:h-24" : "w-20 h-20";
  const titleSize = isPageVariant ? "text-lg sm:text-xl" : "text-lg";
  const bannerHeight = isPageVariant ? "h-24 sm:h-32" : "h-24";

  return (
    <div className={`relative ${className}`}>
      {/* Banner */}
      {metadata?.banner ? (
        <div 
          className={`${bannerHeight} rounded-lg bg-cover bg-center bg-muted mb-8`}
          style={{ backgroundImage: `url(${metadata.banner})` }}
        />
      ) : isPageVariant ? (
        <div className={`${bannerHeight} bg-gradient-to-r from-green-100 to-emerald-100 rounded-lg mb-8`} />
      ) : (
        <div className={`${bannerHeight} bg-gradient-to-r from-gray-100 to-gray-200 rounded-lg mb-8`} />
      )}
      
      {/* Avatar positioned to overlap banner */}
      <div className="absolute left-4 -mt-20">
        {profilePicture ? (
          <img 
            src={profilePicture} 
            alt={displayName}
            className={`${avatarSize} rounded-full object-cover border-4 border-white shadow-sm`}
          />
        ) : (
          <div className={`${avatarSize} rounded-full bg-muted border-4 border-background shadow-sm flex items-center justify-center`}>
            <User className="w-6 h-6 sm:w-8 sm:h-8 text-muted-foreground" />
          </div>
        )}
      </div>
      
      {/* Profile info positioned below avatar */}
      <div className="pt-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div>
              <h2 className={`${titleSize} font-semibold text-foreground truncate leading-none`}>{displayName}</h2>
              {nip05 && (
                <button
                  onClick={() => handleCopy(pubkey, 'npub')}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors group -mt-1"
                  title="Click to copy npub"
                >
                {isLoadingNip05 ? (
                  <CompassSpinner size={12} variant="component" />
                ) : isVerified ? (
                  <ShieldCheck className="h-3 w-3 text-green-600" />
                ) : nip05Error ? (
                  isTimeout ? (
                    <Clock className="h-3 w-3 text-amber-500" />
                  ) : isNetworkError ? (
                    <AlertCircle className="h-3 w-3 text-orange-500" />
                  ) : isInvalidFormat ? (
                    <AlertCircle className="h-3 w-3 text-red-500" />
                  ) : (
                    <AlertCircle className="h-3 w-3 text-red-500" />
                  )
                ) : null}
                <span>{nip05}</span>
                {copiedField === 'npub' ? (
                  <Check className="h-3 w-3 text-green-600" />
                ) : (
                  <Copy className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                )}
              </button>
              )}
            </div>
          </div>
          {children && (
            <div className="flex-shrink-0">
              {children}
            </div>
          )}
        </div>
        
        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-1 sm:gap-4 mt-2 text-xs sm:text-sm text-muted-foreground">
          {createdAt && (
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3 sm:h-4 sm:w-4" />
              Joined {formatDistanceToNow(new Date(createdAt * 1000), { addSuffix: true })}
            </span>
          )}
          <span className="flex items-center gap-1">
            <MapPin className="h-3 w-3 sm:h-4 sm:w-4" />
            {hiddenCount} Hidden
          </span>
          <span className="flex items-center gap-1">
            <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4" />
            {foundCount} Found
          </span>
          {savedCount !== undefined && (
            <span className="flex items-center gap-1">
              <Bookmark className="h-3 w-3 sm:h-4 sm:w-4" />
              {savedCount} Saved
            </span>
          )}
        </div>

        {/* Extended details section for page variant */}
        {showExtendedDetails && (
          <div className="mt-4 space-y-2">
            {/* Bio */}
            {metadata?.about && (
              <p className="text-sm text-foreground line-clamp-2">
                {metadata.about}
              </p>
            )}



            {/* Additional profile details - Lightning address hidden for now */}
            {/* <div className="flex flex-wrap gap-4 text-xs text-gray-600">
              {(metadata?.lud16 || metadata?.lud06) && (
                <button
                  onClick={() => handleCopy(metadata.lud16 || metadata.lud06 || '', 'Lightning Address')}
                  className="flex items-center gap-1 hover:text-gray-800 transition-colors"
                  title="Click to copy Lightning address"
                >
                  <span className="text-yellow-500">⚡</span>
                  <span className="font-mono">{metadata.lud16 || metadata.lud06}</span>
                </button>
              )}
            </div> */}
          </div>
        )}

      </div>
    </div>
  );
}