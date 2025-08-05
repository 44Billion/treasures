import { useState, useEffect } from "react";
import { useParams, Link, useNavigate, useLocation } from "react-router-dom";

import { useStore } from 'zustand';
import { useZapStore } from '@/shared/stores/useZapStore';
import { ZapButton } from "@/components/ZapButton";

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
import type { Geocache, GeocacheLog } from "@/types/geocache";

export default function CacheDetail() {
  const { naddr } = useParams<{ naddr: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const { user } = useCurrentUser();
  
  // Check if we have geocache data passed from navigation state (just created)
  const navigationState = location.state as { geocacheData?: any; justCreated?: boolean } | null;
  const passedGeocacheData = navigationState?.geocacheData;
  const justCreated = navigationState?.justCreated;
  
  // All hooks must be called unconditionally at the top level
  const { data: fetchedGeocache, isLoading, error, isError, refetch } = useGeocacheByNaddr(naddr || "");
  
  // Use passed data if available, otherwise use fetched data
  const geocache = passedGeocacheData || fetchedGeocache;
  
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
  // No need for individual useZaps call here
  const getZapTotal = useStore(useZapStore, (state) => state.getZapTotal);
  const totalZapAmount = getZapTotal(naddr ? `naddr:${naddr}` : `event:${geocache?.id}`) || 0;
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
      });
      setEditImages(geocache.images || []);
      setEditLocation(geocache.location);
      
      // Show toast if we're using passed data (just created)
      if (justCreated && passedGeocacheData) {
        toast({
          title: "Cache Created Successfully!",
          description: "Your geocache is now live. We're syncing with the network in the background...",
        });
      }
      
      // Note: Prefetching is now handled automatically by the store system
    }
  }, [geocache, justCreated, passedGeocacheData, toast]);

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
            title: "Verification Key Detected",
            description: "You can now submit verified logs for this cache! Scroll down to the logs section.",
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
            title: "Outdated QR Code",
            description: "This QR code has been replaced by the cache owner. Please look for a newer QR code at the cache location.",
            variant: "destructive",
          });
        }
      });
    }
  }, [geocache?.verificationPubkey, toast]);

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

  // Handle invalid naddr parameter
  if (!naddr) {
    return (
      <div className="min-h-screen bg-muted/50 dark:bg-muted">
        <DesktopHeader />
        <div className="container mx-auto px-4 py-16">
          <ErrorState
            title="Invalid Cache Link"
            description="No cache identifier provided in the URL."
            primaryAction={
              <Link to="/" className="block">
                <Button className="w-full">Browse Caches</Button>
              </Link>
            }
          />
        </div>
      </div>
    );
  }


  const handleDelete = () => {
    if (!geocache) return;
    confirmSingleDeletion(
      {
        id: geocache.id,
        name: geocache.name,
      },
      'Deleted by cache owner',
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
        title: "Cache name required",
        description: "Please enter a name for your geocache",
        variant: "destructive",
      });
      return;
    }

    if (!editFormData.description.trim()) {
      toast({
        title: "Description required", 
        description: "Please enter a description for your geocache",
        variant: "destructive",
      });
      return;
    }

    if (!editLocation) {
      toast({
        title: "Location required",
        description: "Please select a location for your geocache",
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

  // Show error with retry option if there was an error and no cached data
  if (isError && !geocache && !passedGeocacheData) {
    // Check if this is an invalid cache link error
    const isInvalidCacheLink = error && (error as Error).message === 'INVALID_CACHE_LINK';
    const isOfflineError = error && (error as Error).message === 'Geocache not available offline';
    
    return (
      <div className="min-h-screen bg-muted/50 dark:bg-muted">
        <DesktopHeader />
        <div className="container mx-auto px-4 py-16">
          <ErrorState
            title={
              isInvalidCacheLink ? "Invalid Cache Link" : 
              isOfflineError ? "Offline - Cache Not Available" :
              "Connection Issue"
            }
            description={
              isInvalidCacheLink 
                ? "This cache link is not valid. It may be corrupted or from an incompatible source."
                : isOfflineError
                ? "This geocache is not available offline. Please connect to the internet to load it."
                : "Unable to load geocache. This might be a temporary network issue."
            }
            error={error}
            primaryAction={
              <Link to="/" className="block">
                <Button className="w-full">
                  {isInvalidCacheLink ? "Browse Caches" : "Back to Home"}
                </Button>
              </Link>
            }
            secondaryAction={
              !isInvalidCacheLink ? (
                <Button onClick={() => refetch()} variant="outline" className="w-full">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  {isOfflineError ? "Retry When Online" : "Try Again"}
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
      console.log('DEBUG: Checking canCreateFromNaddr', { 
        user: !!user, 
        userPubkey: user?.pubkey, 
        naddr,
        isLoading,
        isError,
        geocache: !!geocache
      });
      
      if (!user || !naddr) {
        console.log('DEBUG: No user or naddr', { user: !!user, naddr });
        return false;
      }
      
      try {
        const decoded = naddrToGeocache(naddr);
        console.log('DEBUG: Decoded naddr', { decoded, userPubkey: user.pubkey, match: decoded.pubkey === user.pubkey });
        return decoded.pubkey === user.pubkey;
      } catch (error) {
        console.log('DEBUG: Error decoding naddr', error);
        return false;
      }
    })();

    console.log('DEBUG: canCreateFromNaddr result', canCreateFromNaddr);

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
                    Create This Geocache
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-center space-y-3">
                    <p className="text-muted-foreground">
                      This geocache doesn't exist yet, but the link belongs to you! 
                      You can create it now using this pre-generated claim URL.
                    </p>
                    
                    <Alert>
                      <QrCode className="h-4 w-4" />
                      <AlertDescription>
                        This appears to be from a QR code you generated in advance. 
                        Creating the geocache will make this claim URL work for finders.
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
                      Create Geocache
                    </Button>
                    
                    <Button 
                      onClick={() => navigate("/")} 
                      variant="outline" 
                      className="w-full"
                    >
                      Back to Home
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
            title="Geocache Not Found"
            description="This geocache may have been removed or doesn't exist."
            primaryAction={
              <Link to="/" className="block">
                <Button className="w-full">Back to Home</Button>
              </Link>
            }
            secondaryAction={
              <Button onClick={() => refetch()} variant="outline" className="w-full">
                <RefreshCw className="h-4 w-4 mr-2" />
                Check Again
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
    <div className="min-h-screen bg-muted">
      <DesktopHeader />

      <div className="container mx-auto px-2 sm:px-4 py-8">
        <div className="grid lg:grid-cols-3 gap-4 lg:gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-4 lg:space-y-6 min-w-0">
            <Card>
              <CardHeader>
                <div className="flex items-start gap-2 sm:gap-4">
                  <CardTitle className="text-2xl break-words flex-1">{geocache.name}</CardTitle>
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
                <div className="text-gray-600 dark:text-gray-400 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 text-sm pt-2">
                  <span className="flex items-center gap-1">
                    <User className="h-4 w-4" />
                    Hidden by{' '}
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
              </CardHeader>
              <CardContent className="overflow-hidden">
                {isEditing ? (
                  // Edit form
                  <div className="space-y-6">
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
                      <Label>Location *</Label>
                      <LocationPicker
                        value={editLocation}
                        onChange={setEditLocation}
                      />
                    </div>

                    {/* Location Verification for Edit */}
                    {editLocationVerification && (
                      <div className="border rounded-lg p-4 bg-muted/50 dark:bg-muted">
                        <h4 className="font-medium mb-2">Location Information</h4>
                        <LocationWarnings 
                          verification={editLocationVerification} 
                          className="space-y-2"
                        />
                      </div>
                    )}

                    {/* QR Code Management Section */}
                    {isOwner && geocache && (
                      <Card>
                        <CardHeader>
                          <CardTitle>QR Code Management</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-muted-foreground mb-4">
                            This is a creator-only tool to manage the verification QR code for this geocache. Regenerating will invalidate the previous QR code.
                          </p>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setRegenerateQRDialogOpen(true)}
                            disabled={isEditingGeocache}
                            className="w-full sm:w-auto"
                          >
                            <QrCode className="h-4 w-4 mr-2" />
                            Regenerate QR Code
                          </Button>
                        </CardContent>
                      </Card>
                    )}
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
                                <strong>Hint:</strong>{' '}
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
                                title={isHintVisible ? "Hide hint" : "Reveal hint"}
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
              </CardContent>
            </Card>

            {/* Map Section */}
            <Card>
              <CardHeader>
                <CardTitle>Map</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-96 rounded-lg overflow-hidden">
                  <GeocacheMap 
                    geocaches={[{
                      ...geocache,
                      location: isEditing && editLocation ? editLocation : geocache.location
                    }]} 
                    center={isEditing && editLocation ? editLocation : geocache.location}
                    zoom={15}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Logs Section */}
            <div className="space-y-4" data-logs-section>
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
          <div className="space-y-4 lg:space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Cache Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <DifficultyTerrainRating 
                  difficulty={geocache.difficulty}
                  terrain={geocache.terrain}
                  cacheSize={geocache.size}
                />
                
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Coordinates {isEditing && editLocation && (editLocation.lat !== geocache.location.lat || editLocation.lng !== geocache.location.lng) && (
                      <span className="text-orange-600 text-xs">(modified)</span>
                    )}
                  </p>
                  <p className="text-xs md:text-sm font-mono mt-1 break-all">
                    {isEditing && editLocation ? 
                      `${editLocation.lat.toFixed(6)}, ${editLocation.lng.toFixed(6)}` :
                      `${geocache.location.lat.toFixed(6)}, ${geocache.location.lng.toFixed(6)}`
                    }
                  </p>
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
                    Get Directions
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Location Information */}
            {locationVerification && (
              <Card>
                <CardHeader>
                  <CardTitle>Location Information</CardTitle>
                </CardHeader>
                <CardContent>
                  <LocationWarnings 
                    verification={locationVerification} 
                    className="space-y-2"
                    hideCreatorWarnings={true}
                  />
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Statistics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Total Finds</span>
                    <span className="font-medium">
                      {(logs as GeocacheLog[])?.filter((log: GeocacheLog) => log.type === "found").length || 0}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">DNFs</span>
                    <span className="font-medium">
                      {(logs as GeocacheLog[])?.filter((log: GeocacheLog) => log.type === "dnf").length || 0}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Total Logs</span>
                    <span className="font-medium">{(logs as GeocacheLog[])?.length || 0}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
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
        confirmText="Delete Geocache"
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