import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useParams, Link, useNavigate, useLocation } from "react-router-dom";
import { Copy, Check } from "lucide-react";

import { useStore } from 'zustand';
import { useZapStore } from '@/shared/stores/useZapStore';
import { ZapButton } from "@/components/ZapButton";
import { GeocacheLoading } from "@/components/GeocacheLoading";
import { useDirectNavigation } from '@/shared/hooks/useDirectNavigation';

import { Navigation, Calendar, User, Edit, Trash2, RefreshCw, Save, RotateCcw, Eye, EyeOff, QrCode, Zap, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { DeleteConfirmationDialog } from "@/components/DeleteConfirmationDialog";
import { DesktopHeader } from "@/components/DesktopHeader";
import { ErrorState } from "@/components/ui/loading";
import { SaveButton } from "@/components/SaveButton";
import { useCurrentUser } from "@/features/auth/hooks/useCurrentUser";
import { useGeocacheByNaddr } from "@/features/geocache/hooks/useGeocacheByNaddr";
import { useGeocacheLogs } from "@/features/geocache/hooks/useGeocacheLogs";
import { useDeleteWithConfirmation } from "@/shared/hooks/useDeleteWithConfirmation";
import { useEditGeocache } from "@/features/geocache/hooks/useEditGeocache";
import { GeocacheMap } from "@/components/GeocacheMap";
import { LogsSection } from "@/features/logging/components/LogsSection";
import { useAuthor } from "@/features/auth/hooks/useAuthor";
import { useToast } from "@/shared/hooks/useToast";
import { formatDistanceToNow } from "@/shared/utils/date";

import { LocationWarnings } from "@/components/LocationWarnings";
import { verifyLocation, type LocationVerification } from "@/features/geocache/utils/osmVerification";
import { getTypeLabel, getSizeLabel } from "@/features/geocache/utils/geocache-utils";
import { getDefaultCacheValues } from "@/features/geocache/utils/geocache-constants";
import { DifficultyTerrainRating } from "@/components/ui/difficulty-terrain-rating";
import { GeocacheForm } from "@/components/ui/geocache-form";
import type { GeocacheFormData } from "@/components/ui/geocache-form.types";
import { LocationPicker } from "@/components/LocationPicker";
import { Label } from "@/components/ui/label";

import { ImageGallery } from "@/components/ImageGallery";
import { BlurredImage } from "@/components/BlurredImage";
import { ProfileDialog } from "@/components/ProfileDialog";
import { RegenerateQRDialog } from "@/components/RegenerateQRDialog";
import { CacheMenu } from "@/components/CacheMenu";
import { parseVerificationFromHash, verifyKeyPair } from "@/features/geocache/utils/verification";
import { naddrToGeocache } from "@/shared/utils/naddr-utils";
import { encodeGeohash } from "@/features/geocache/utils/nip-gc";
import type { Geocache, GeocacheLog } from "@/types/geocache";

export default function CacheDetail() {
  const { t } = useTranslation();
  const { naddr } = useParams<{ naddr: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const { user } = useCurrentUser();
  const isDirectNavigation = useDirectNavigation();

  // Check if we have geocache data passed from navigation state (just created)
  const navigationState = location.state as { geocacheData?: any; justCreated?: boolean } | null;
  const passedGeocacheData = navigationState?.geocacheData;
  const justCreated = navigationState?.justCreated;

  // State for tracking multi-relay attempts
  const [relayAttempts, setRelayAttempts] = useState<string[]>([]);
  const [isMultiRelayLoading, setIsMultiRelayLoading] = useState(false);

  // All hooks must be called unconditionally at the top level
  const { data: fetchedGeocache, isLoading, error, isError, refetch } = useGeocacheByNaddr(naddr || "", {
    onRelayAttempt: (relayUrl) => {
      setRelayAttempts(prev => [...prev, relayUrl]);
    },
    onMultiRelayStart: () => {
      setIsMultiRelayLoading(true);
    },
    onMultiRelayEnd: () => {
      setIsMultiRelayLoading(false);
    }
  });

  // Use passed data if available, otherwise use fetched data
  const geocache = passedGeocacheData || fetchedGeocache;

  // Show full-page loading for direct navigation when loading
  const shouldShowFullPageLoading = isDirectNavigation && isLoading && !passedGeocacheData && !geocache;

  // Create stable references for the logs query to prevent duplicate queries
  const geocacheId = geocache ? `${geocache.pubkey}:${geocache.dTag}` : '';
  const geocacheDTag = geocache?.dTag;
  const geocachePubkey = geocache?.pubkey;
  const geocacheRelays = geocache?.relays;
  const geocacheVerificationPubkey = geocache?.verificationPubkey;
  const geocacheKind = geocache?.kind;

  const { data: logs = [] } = useGeocacheLogs(
    geocacheId,
    geocacheDTag,
    geocachePubkey,
    geocacheRelays,
    geocacheVerificationPubkey,
    geocacheKind
  );

  // Zap data should now be pre-populated by useGeocacheByNaddr hook
  // Use memoized zap totals from store for better performance
  const zapStoreKey = naddr ? `naddr:${naddr}` : `event:${geocache?.id}`;
  const zapTotal = useStore(useZapStore, (state) => state.zapTotals[zapStoreKey] ?? 0);
  const totalZapAmount = geocache?.zapTotal ?? zapTotal;
  const {
    confirmSingleDeletion,
    isConfirmDialogOpen,
    isDeletingAny,
    executeDeletion,
    cancelDeletion,
    getConfirmationTitle,
    getConfirmationMessage,
  } = useDeleteWithConfirmation();
  const { mutate: editGeocache, isPending: isEditingGeocache } = useEditGeocache(geocache || null);
  const { toast } = useToast();

  const author = useAuthor(geocache?.pubkey || "");

  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const defaults = getDefaultCacheValues();
  const [editFormData, setEditFormData] = useState<GeocacheFormData>({
    name: "",
    description: "",
    hint: "",
    difficulty: defaults.difficulty,
    terrain: defaults.terrain,
    size: defaults.size,
    type: defaults.type,
    hidden: false,
    contentWarning: "",
  });
  const [editImages, setEditImages] = useState<string[]>([]);
  const [editLocation, setEditLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationVerification, setLocationVerification] = useState<LocationVerification | null>(null);
  const [editLocationVerification, setEditLocationVerification] = useState<LocationVerification | null>(null);

  // Image gallery state
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);

  // Hint visibility state
  const [isHintVisible, setIsHintVisible] = useState(false);

  // Profile dialog state
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [selectedProfilePubkey, setSelectedProfilePubkey] = useState<string | null>(null);

  // Regenerate QR dialog state
  const [regenerateQRDialogOpen, setRegenerateQRDialogOpen] = useState(false);

  // Verification state
  const [verificationKey, setVerificationKey] = useState<string | null>(null);
  const [isVerificationValid, setIsVerificationValid] = useState(false);

  // Copy to clipboard state
  const [copiedItem, setCopiedItem] = useState<string | null>(null);

  // Initialize edit form when geocache loads
  useEffect(() => {
    if (geocache) {
      setEditFormData({
        name: geocache.name,
        description: geocache.description,
        hint: geocache.hint || "",
        difficulty: geocache.difficulty.toString(),
        terrain: geocache.terrain.toString(),
        size: geocache.size,
        type: geocache.type,
        hidden: geocache.hidden || false,
        contentWarning: geocache.contentWarning || "",
      });
      setEditImages(geocache.images || []);
      setEditLocation(geocache.location);

      // Show toast if we're using passed data (just created)
      if (justCreated && passedGeocacheData) {
        toast({
          title: t('cacheDetail.toast.created.title'),
          description: t('cacheDetail.toast.created.description'),
        });
      }

      // Note: Prefetching is now handled automatically by the store system
    }
  }, [geocache, justCreated, passedGeocacheData, toast, t]);

  // Verify location when geocache loads
  useEffect(() => {
    if (geocache?.location) {
      verifyLocation(geocache.location.lat, geocache.location.lng)
        .then(setLocationVerification)
        .catch(() => {
          // Silently fail - location verification is optional for viewing
          setLocationVerification(null);
        });
    }
  }, [geocache?.location]);

  // Verify edit location when it changes
  useEffect(() => {
    if (editLocation && isEditing) {
      verifyLocation(editLocation.lat, editLocation.lng)
        .then(setEditLocationVerification)
        .catch(() => {
          // Silently fail - location verification is optional for editing
          setEditLocationVerification(null);
        });
    }
  }, [editLocation, isEditing]);

  // Check for verification key in URL hash
  useEffect(() => {
    const hash = window.location.hash;
    const nsec = parseVerificationFromHash(hash);

    if (nsec && geocache?.verificationPubkey) {
      verifyKeyPair(nsec, geocache.verificationPubkey).then(isValid => {
        setVerificationKey(nsec);
        setIsVerificationValid(isValid);

        if (isValid) {
          toast({
            title: t('cacheDetail.toast.verificationDetected.title'),
            description: t('cacheDetail.toast.verificationDetected.description'),
          });

          // Scroll to logs section after a short delay
          setTimeout(() => {
            const logsSection = document.querySelector('[data-logs-section]');
            if (logsSection) {
              logsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
          }, 1000);
        } else {
          // Check if this is an outdated verification key
          toast({
            title: t('cacheDetail.toast.outdatedQR.title'),
            description: t('cacheDetail.toast.outdatedQR.description'),
            variant: "destructive",
          });
        }
      });
    }
  }, [geocache?.verificationPubkey, toast, t]);

  // If we have passed geocache data (just created), trigger a refetch after a short delay
  // to ensure we eventually sync with the relay data
  useEffect(() => {
    if (justCreated && passedGeocacheData) {
      const timer = setTimeout(() => {
        console.log('🔄 Refetching geocache data from relay after creation...');
        refetch();
      }, 3000); // Wait 3 seconds before refetching

      return () => clearTimeout(timer);
    }
    return;
  }, [justCreated, passedGeocacheData, refetch]);

  // Reset relay attempts when naddr changes
  useEffect(() => {
    setRelayAttempts([]);
    setIsMultiRelayLoading(false);
  }, [naddr]);

  // Handle invalid naddr parameter - redirect to NotFound if it doesn't look like a valid naddr
  useEffect(() => {
    if (naddr && !naddr.startsWith('naddr1')) {
      // Invalid path - doesn't look like an naddr, redirect to NotFound
      navigate('/404', { replace: true });
    }
  }, [naddr, navigate]);

  // Show full-page loading animation for direct navigation
  if (shouldShowFullPageLoading) {
    return (
      <GeocacheLoading
        title={t('cacheDetail.loading.title')}
        description={t('cacheDetail.loading.description')}
        relayAttempts={relayAttempts}
        isMultiRelayLoading={isMultiRelayLoading}
      />
    );
  }

  if (!naddr || !naddr.startsWith('naddr1')) {
    // Show nothing while redirecting, or if naddr is invalid
    return null;
  }


  const handleDelete = () => {
    if (!geocache) return;
    confirmSingleDeletion(
      {
        id: geocache.id,
        name: geocache.name,
      },
      t('cacheDetail.delete.reason'),
      () => navigate("/")
    );
  };

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    // Reset form to original values
    if (geocache) {
      setEditFormData({
        name: geocache.name,
        description: geocache.description,
        hint: geocache.hint || "",
        difficulty: geocache.difficulty.toString(),
        terrain: geocache.terrain.toString(),
        size: geocache.size,
        type: geocache.type,
        hidden: geocache.hidden || false,
      });
      setEditImages(geocache.images || []);
      setEditLocation(geocache.location);
      setEditLocationVerification(null);
    }
  };

  const handleSaveEdit = () => {
    if (!editFormData.name.trim()) {
      toast({
        title: t('cacheDetail.toast.nameRequired.title'),
        description: t('cacheDetail.toast.nameRequired.description'),
        variant: "destructive",
      });
      return;
    }

    if (!editFormData.description.trim()) {
      toast({
        title: t('cacheDetail.toast.descriptionRequired.title'),
        description: t('cacheDetail.toast.descriptionRequired.description'),
        variant: "destructive",
      });
      return;
    }

    if (!editLocation) {
      toast({
        title: t('cacheDetail.toast.locationRequired.title'),
        description: t('cacheDetail.toast.locationRequired.description'),
        variant: "destructive",
      });
      return;
    }

    editGeocache({
      ...editFormData,
      images: editImages,
      hidden: editFormData.hidden,
      location: editLocation,
      difficulty: parseFloat(editFormData.difficulty),
      terrain: parseFloat(editFormData.terrain),
      size: editFormData.size as "micro" | "small" | "regular" | "large" | "other",
      type: editFormData.type as "traditional" | "multi" | "mystery",
    }, {
      onSuccess: () => {
        setIsEditing(false);
        setEditLocationVerification(null);
      },
    });
  };

  const handleImageClick = (index: number) => {
    setGalleryIndex(index);
    setGalleryOpen(true);
  };

  const handleProfileClick = (pubkey: string) => {
    setSelectedProfilePubkey(pubkey);
    setProfileDialogOpen(true);
  };

  const handleCopyToClipboard = async (text: string, itemType: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedItem(itemType);
      toast({
        title: t('cacheDetail.toast.copied.title'),
        description: t('cacheDetail.toast.copied.description', { item: itemType }),
      });
      setTimeout(() => setCopiedItem(null), 2000);
    } catch (error) {
      toast({
        title: t('cacheDetail.toast.copyFailed.title'),
        description: t('cacheDetail.toast.copyFailed.description'),
        variant: "destructive",
      });
    }
  };

  // Show error with retry option if there was an error and no cached data
  if (isError && !geocache && !passedGeocacheData) {
    // Check if this is an invalid cache link error
    const isInvalidCacheLink = error && (error as Error).message === 'INVALID_CACHE_LINK';

    return (
      <div className="min-h-screen bg-muted/50 dark:bg-muted">
        <DesktopHeader />
        <div className="container mx-auto px-4 py-16">
          <ErrorState
            title={
              isInvalidCacheLink ? t('cacheDetail.error.invalidLink.title') :
              t('cacheDetail.error.connection.title')
            }
            description={
              isInvalidCacheLink
                ? t('cacheDetail.error.invalidLink.corrupted')
                : t('cacheDetail.error.connection.description')
            }
            error={error}
            primaryAction={
              <Link to="/" className="block">
                <Button className="w-full">
                  {isInvalidCacheLink ? t('cacheDetail.error.invalidLink.browse') : t('cacheDetail.error.connection.backHome')}
                </Button>
              </Link>
            }
            secondaryAction={
              !isInvalidCacheLink ? (
                <Button onClick={() => refetch()} variant="outline" className="w-full">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  {t('cacheDetail.error.connection.tryAgain')}
                </Button>
              ) : undefined
            }
          />
        </div>
      </div>
    );
  }

  if (!isLoading && !isError && !geocache && !passedGeocacheData) {
    // Check if this naddr belongs to the current user and offer to create it
    const canCreateFromNaddr = (() => {
      if (!user || !naddr) {
        return false;
      }

      try {
        const decoded = naddrToGeocache(naddr);
        return decoded.pubkey === user.pubkey;
      } catch (error) {
        return false;
      }
    })();

    if (canCreateFromNaddr) {
      return (
        <div className="min-h-screen bg-muted/30 dark:bg-muted">
          <DesktopHeader />
          <div className="container mx-auto px-4 py-16">
            <div className="max-w-md mx-auto">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Plus className="h-5 w-5" />
                    {t('cacheDetail.create.title')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-center space-y-3">
                    <p className="text-muted-foreground whitespace-pre-line">
                      {t('cacheDetail.create.description')}
                    </p>

                    <Alert>
                      <QrCode className="h-4 w-4" />
                      <AlertDescription className="whitespace-pre-line">
                        {t('cacheDetail.create.qrAlert')}
                      </AlertDescription>
                    </Alert>
                  </div>

                  <div className="space-y-2">
                    <Button
                      onClick={() => {
                        // Create the full claim URL to pass to the create page
                        const claimUrl = `${window.location.origin}${window.location.pathname}${window.location.hash}`;
                        console.log('🔗 Creating claim URL:', claimUrl);
                        navigate(`/create-cache?claimUrl=${encodeURIComponent(claimUrl)}`);
                      }}
                      className="w-full"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      {t('cacheDetail.create.button')}
                    </Button>

                    <Button
                      onClick={() => navigate("/")}
                      variant="outline"
                      className="w-full"
                    >
                      {t('cacheDetail.create.backHome')}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-muted/30 dark:bg-muted">
        <DesktopHeader />
        <div className="container mx-auto px-4 py-16">
          <ErrorState
            title={t('cacheDetail.error.notFound.title')}
            description={t('cacheDetail.error.notFound.description')}
            primaryAction={
              <Link to="/" className="block">
                <Button className="w-full">{t('cacheDetail.error.notFound.backHome')}</Button>
              </Link>
            }
            secondaryAction={
              <Button onClick={() => refetch()} variant="outline" className="w-full">
                <RefreshCw className="h-4 w-4 mr-2" />
                {t('cacheDetail.error.notFound.checkAgain')}
              </Button>
            }
          />
        </div>
      </div>
    );
  }

  // Ensure geocache is not null from here onwards
  if (!geocache) {
    return null;
  }




  const isOwner = user && user.pubkey === geocache.pubkey;
  const authorName = author.data?.metadata?.name || geocache.pubkey.slice(0, 8);
  const profilePicture = author.data?.metadata?.picture;

  return (
    <div className="min-h-screen lg:bg-muted bg-card">
      <DesktopHeader />

      {/* Sticky footer for edit mode on mobile */}
      {isEditing && (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-card border-t shadow-lg z-50 p-4">
          <div className="flex gap-2">
            <Button
              onClick={handleSaveEdit}
              disabled={isEditingGeocache}
              className="flex-1"
            >
              <Save className="h-4 w-4 mr-2" />
              {isEditingGeocache ? t('common.loading') : t('common.save')}
            </Button>
            <Button
              variant="outline"
              onClick={handleCancelEdit}
              disabled={isEditingGeocache}
              className="flex-1"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              {t('common.cancel')}
            </Button>
          </div>
        </div>
      )}

      <div className="sm:container mx-auto lg:px-2 sm:px-4 lg:py-8 py-0">
        <div className="grid lg:grid-cols-3 gap-4 lg:gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-4 lg:space-y-6 min-w-0">
            {/* Mobile: No card wrapper, Desktop: Card wrapper */}
            <div className="lg:rounded-lg lg:border lg:bg-card lg:shadow-sm lg:mt-4">
              {/* Map Banner */}
              <div className="relative h-72 lg:mb-4 lg:rounded-t-lg overflow-hidden bg-gray-100 lg:mt-0">
                <GeocacheMap
                  geocaches={[{
                    ...geocache,
                    location: isEditing && editLocation ? editLocation : geocache.location
                  }]}
                  center={isEditing && editLocation ? editLocation : geocache.location}
                  zoom={14}
                />
              </div>

              <div className="pt-6 sm:pt-0 lg:p-6 p-4 lg:pt-6">
                <div className="flex items-start gap-2 sm:gap-4">
                  <h1 className="text-2xl break-words flex-1 font-bold text-foreground">{geocache.name}</h1>
                  <div className="flex gap-1 sm:gap-2 flex-shrink-0 ml-2">
                    <ZapButton target={geocache} />
                    {!isOwner && <SaveButton geocache={geocache} />}
                    {isOwner && (
                      <>
                        {isEditing ? (
                          <>
                            <Button size="sm" onClick={handleSaveEdit} disabled={isEditingGeocache}>
                              <Save className="h-4 w-4" />
                            </Button>
                            <Button variant="outline" size="sm" onClick={handleCancelEdit} disabled={isEditingGeocache}>
                              <RotateCcw className="h-4 w-4" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button variant="outline" size="sm" onClick={handleEdit} disabled={isEditingGeocache}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={handleDelete}
                              disabled={isDeletingAny}
                            >
                              {isDeletingAny ? (
                                <RefreshCw className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </Button>
                          </>
                        )}
                      </>
                    )}
                    <CacheMenu geocache={geocache} variant="compact" />
                  </div>
                </div>

                {/* Author and date info below title */}
                <div className="text-muted-foreground flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 text-sm pt-2">
                  <span className="flex items-center gap-1">
                    <User className="h-4 w-4" />
                    {t('cacheDetail.author.hiddenBy')}{' '}
                    <button
                      onClick={() => handleProfileClick(geocache.pubkey)}
                      className="hover:underline cursor-pointer"
                    >
                      {authorName}
                    </button>
                    {profilePicture && (
                      <img
                        src={profilePicture}
                        alt={authorName}
                        className="h-4 w-4 rounded-full object-cover"
                      />
                    )}
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      {formatDistanceToNow(new Date(geocache.created_at * 1000), { addSuffix: true })}
                    </span>
                    <span className="flex items-center gap-1">
                      <Zap className="h-4 w-4" />
                      {totalZapAmount.toLocaleString()} sats
                    </span>
                  </div>
                </div>
              </div>

              <div className="lg:p-6 lg:pt-0 p-4 pt-0 lg:pb-6 pb-2">
                {isEditing ? (
                  // Edit form
                  <div className="space-y-6 pb-20 lg:pb-6">
                    <GeocacheForm
                      formData={editFormData}
                      onFormDataChange={setEditFormData}
                      images={editImages}
                      onImagesChange={setEditImages}
                      fieldPrefix="edit"
                      isSubmitting={isEditingGeocache}
                    />

                    {/* Location */}
                    <div>
                      <Label>{t('cacheDetail.details.coordinates')} *</Label>
                      <LocationPicker
                        value={editLocation}
                        onChange={setEditLocation}
                      />
                    </div>

                    {/* Location Verification for Edit */}
                    {editLocationVerification && (
                      <div className="border rounded-lg p-4 bg-muted/50 dark:bg-muted">
                        <h4 className="font-medium mb-2 text-foreground">{t('cacheDetail.location.title')}</h4>
                        <LocationWarnings
                          verification={editLocationVerification}
                          className="space-y-2"
                        />
                      </div>
                    )}

                    {/* QR Code Management Section */}
                    {isOwner && geocache && (
                      <div className="lg:rounded-lg lg:border lg:bg-card lg:shadow-sm lg:p-6 p-4">
                        <h3 className="text-lg font-semibold mb-4 text-card-foreground">{t('cacheDetail.qrManagement.title')}</h3>
                        <p className="text-sm text-muted-foreground mb-4">
                          {t('cacheDetail.qrManagement.description')}
                        </p>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setRegenerateQRDialogOpen(true)}
                          disabled={isEditingGeocache}
                          className="w-full sm:w-auto"
                        >
                          <QrCode className="h-4 w-4 mr-2" />
                          {t('cacheDetail.qrManagement.regenerate')}
                        </Button>
                      </div>
                    )}

                    {/* Save/Cancel buttons at bottom (desktop only, mobile has sticky footer) */}
                    <div className="hidden lg:flex gap-2 pt-4 border-t">
                      <Button
                        onClick={handleSaveEdit}
                        disabled={isEditingGeocache}
                        className="flex-1"
                      >
                        <Save className="h-4 w-4 mr-2" />
                        {isEditingGeocache ? t('common.loading') : t('common.save')}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={handleCancelEdit}
                        disabled={isEditingGeocache}
                        className="flex-1"
                      >
                        <RotateCcw className="h-4 w-4 mr-2" />
                        {t('common.cancel')}
                      </Button>
                    </div>
                  </div>
                ) : (
                  // View mode
                  <>
                    <div className="flex flex-wrap gap-2 mb-4">
                      <Badge variant="outline">D{geocache.difficulty}</Badge>
                      <Badge variant="outline">T{geocache.terrain}</Badge>
                      <Badge variant="secondary">{getSizeLabel(geocache.size)}</Badge>
                      <Badge variant="secondary">{getTypeLabel(geocache.type)}</Badge>
                    </div>

                    <div className="prose max-w-none">
                      <p className="text-foreground whitespace-pre-wrap break-words">{geocache.description}</p>

                      {geocache.hint && (
                        <Alert className="mt-4 py-2">
                          <AlertDescription className="break-words">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex-1">
                                <strong>{t('cacheDetail.hint.label')}</strong>{' '}
                                <span
                                  className={`transition-all duration-200 ${
                                    isHintVisible ? '' : 'blur-sm'
                                  }`}
                                >
                                  {geocache.hint}
                                </span>
                              </div>
                              <button
                                onClick={() => setIsHintVisible(!isHintVisible)}
                                className="flex-shrink-0 p-0.5 -mr-4 sm:-mr-0 rounded hover:bg-muted transition-colors"
                                title={isHintVisible ? t('cacheDetail.hint.hide') : t('cacheDetail.hint.reveal')}
                                type="button"
                              >
                                {isHintVisible ? (
                                  <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
                                ) : (
                                  <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                                )}
                              </button>
                            </div>
                          </AlertDescription>
                        </Alert>
                      )}
                    </div>

                    {geocache.images && geocache.images.length > 0 && (
                      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {geocache.images.map((url: string, index = 0) => (
                          <BlurredImage
                            key={index}
                            src={url}
                            alt={`Cache image ${index + 1}`}
                            className="rounded-lg w-full h-48"
                            onClick={() => handleImageClick(index)}
                            blurIntensity="medium"
                            defaultBlurred={true}
                          />
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>



            {/* Logs Section */}
            <div className="space-y-4 lg:mt-0 mt-2" data-logs-section>
              {/* Render logs section */}
              <LogsSection
                logs={logs as GeocacheLog[]}
                geocache={geocache as Geocache}
                onProfileClick={handleProfileClick}
                isOwner={isOwner}
                verificationKey={verificationKey || undefined}
                isVerificationValid={isVerificationValid}
              />
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4 lg:space-y-6 lg:mt-4">
            {/* Cache Details - Mobile: No card wrapper, Desktop: Card wrapper */}
            <div className="lg:rounded-lg lg:border lg:bg-card lg:shadow-sm lg:p-6 p-4 lg:mt-0 mt-2">
              <h3 className="text-lg font-semibold mb-4 text-card-foreground">{t('cacheDetail.details.title')}</h3>
              <div className="space-y-4">
                <DifficultyTerrainRating
                  difficulty={geocache.difficulty}
                  terrain={geocache.terrain}
                  cacheSize={geocache.size}
                />

                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    {t('cacheDetail.details.coordinates')} {isEditing && editLocation && (editLocation.lat !== geocache.location.lat || editLocation.lng !== geocache.location.lng) && (
                      <span className="text-orange-600 text-xs">{t('cacheDetail.details.coordinatesModified')}</span>
                    )}
                  </p>
                  <button
                    onClick={() => {
                      const location = isEditing && editLocation ? editLocation : geocache.location;
                      handleCopyToClipboard(
                        `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`,
                        t('cacheDetail.details.coordinates')
                      );
                    }}
                    className="flex items-center gap-2 text-xs md:text-sm font-mono mt-1 break-all text-foreground hover:bg-muted/50 p-1 rounded transition-colors w-full text-left"
                    title={t('cacheDetail.details.clickToCopy', { item: t('cacheDetail.details.coordinates') })}
                  >
                    <span className="flex-1">
                      {isEditing && editLocation ?
                        `${editLocation.lat.toFixed(6)}, ${editLocation.lng.toFixed(6)}` :
                        `${geocache.location.lat.toFixed(6)}, ${geocache.location.lng.toFixed(6)}`
                      }
                    </span>
                    {copiedItem === t('cacheDetail.details.coordinates') ? (
                      <Check className="h-3 w-3 text-green-600 flex-shrink-0" />
                    ) : (
                      <Copy className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                    )}
                  </button>
                  <p className="text-xs font-medium text-muted-foreground mt-3">
                    {t('cacheDetail.details.geohash')} {isEditing && editLocation && (editLocation.lat !== geocache.location.lat || editLocation.lng !== geocache.location.lng) && (
                      <span className="text-orange-600 text-xs">{t('cacheDetail.details.geohashModified')}</span>
                    )}
                  </p>
                  <button
                    onClick={() => {
                      const location = isEditing && editLocation ? editLocation : geocache.location;
                      handleCopyToClipboard(
                        encodeGeohash(location.lat, location.lng, 9),
                        t('cacheDetail.details.geohash')
                      );
                    }}
                    className="flex items-center gap-2 text-xs md:text-sm font-mono mt-1 break-all text-foreground hover:bg-muted/50 p-1 rounded transition-colors w-full text-left"
                    title={t('cacheDetail.details.clickToCopy', { item: t('cacheDetail.details.geohash') })}
                  >
                    <span className="flex-1">
                      {isEditing && editLocation ?
                        encodeGeohash(editLocation.lat, editLocation.lng, 9) :
                        encodeGeohash(geocache.location.lat, geocache.location.lng, 9)
                      }
                    </span>
                    {copiedItem === t('cacheDetail.details.geohash') ? (
                      <Check className="h-3 w-3 text-green-600 flex-shrink-0" />
                    ) : (
                      <Copy className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                    )}
                  </button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2 w-full"
                    onClick={() => {
                      const location = isEditing && editLocation ? editLocation : geocache.location;
                      window.open(
                        `https://www.openstreetmap.org/directions?from=&to=${location.lat}%2C${location.lng}#map=15/${location.lat}/${location.lng}`,
                        "_blank"
                      );
                    }}
                  >
                    <Navigation className="h-4 w-4 mr-2" />
                    {t('cacheDetail.details.getDirections')}
                  </Button>
                </div>
              </div>
            </div>

            {/* Location Information - Mobile: No card wrapper, Desktop: Card wrapper */}
            {locationVerification && (
              <div className="lg:rounded-lg lg:border lg:bg-card lg:shadow-sm lg:p-6 p-4 lg:mt-0 mt-2">
                <h3 className="text-lg font-semibold mb-4 text-card-foreground">{t('cacheDetail.location.title')}</h3>
                <LocationWarnings
                  verification={locationVerification}
                  className="space-y-2"
                  hideCreatorWarnings={true}
                />
              </div>
            )}

            {/* Statistics - Mobile: No card wrapper, Desktop: Card wrapper */}
            <div className="lg:rounded-lg lg:border lg:bg-card lg:shadow-sm lg:p-6 p-4 lg:mt-0 mt-2">
              <h3 className="text-lg font-semibold mb-4 text-card-foreground">{t('cacheDetail.stats.title')}</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">{t('cacheDetail.stats.totalFinds')}</span>
                  <span className="font-medium text-card-foreground">
                    {(logs as GeocacheLog[])?.filter((log: GeocacheLog) => log.type === "found").length || 0}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">{t('cacheDetail.stats.dnfs')}</span>
                  <span className="font-medium text-card-foreground">
                    {(logs as GeocacheLog[])?.filter((log: GeocacheLog) => log.type === "dnf").length || 0}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">{t('cacheDetail.stats.totalLogs')}</span>
                  <span className="font-medium text-card-foreground">{(logs as GeocacheLog[])?.length || 0}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Image Gallery */}
      {geocache.images && (
        <ImageGallery
          images={geocache.images}
          isOpen={galleryOpen}
          onClose={() => setGalleryOpen(false)}
          initialIndex={galleryIndex}
        />
      )}

      {/* Profile Dialog */}
      <ProfileDialog
        pubkey={selectedProfilePubkey}
        isOpen={profileDialogOpen}
        onOpenChange={setProfileDialogOpen}
      />

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmationDialog
        isOpen={isConfirmDialogOpen}
        onOpenChange={() => {}} // Controlled by the hook
        title={getConfirmationTitle()}
        description={getConfirmationMessage()}
        isDeleting={isDeletingAny}
        onConfirm={executeDeletion}
        onCancel={cancelDeletion}
        confirmText={t('cacheDetail.delete.confirmText')}
      />

      {/* Regenerate QR Dialog */}
      {geocache && (
        <RegenerateQRDialog
          isOpen={regenerateQRDialogOpen}
          onOpenChange={setRegenerateQRDialogOpen}
          naddr={naddr}
          pubkey={geocache.pubkey}
          dTag={geocache.dTag}
          relays={geocache.relays}
          name={geocache.name}
        />
      )}
    </div>
  );
}