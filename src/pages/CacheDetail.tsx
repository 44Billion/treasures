import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { MapPin, Navigation, Calendar, User, Trophy, Edit, Trash2, RefreshCw, Upload, X, Save, RotateCcw, Compass as CompassIcon, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CacheDetailTabs } from "@/components/ui/mobile-button-patterns";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DeleteConfirmationDialog } from "@/components/DeleteConfirmationDialog";
import { DesktopHeader } from "@/components/DesktopHeader";
import { FullPageLoading, ErrorState } from "@/components/ui/loading";
import { SaveButton } from "@/components/SaveButton";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useGeocacheByNaddr } from "@/hooks/useGeocacheByNaddr";
import { useGeocacheLogs } from "@/hooks/useGeocacheLogs";
import { useDeleteWithConfirmation } from "@/hooks/useDeleteWithConfirmation";
import { useEditGeocache } from "@/hooks/useEditGeocache";
import { GeocacheMap } from "@/components/GeocacheMap";
import { LogsSection } from "@/components/LogsSection";
import { useAuthor } from "@/hooks/useAuthor";
import { useToast } from "@/hooks/useToast";
import { formatDistanceToNow } from "@/lib/date";

import { LocationWarnings } from "@/components/LocationWarnings";
import { verifyLocation, type LocationVerification } from "@/lib/osmVerification";
import { Compass } from "@/components/Compass";
import { getDifficultyLabel, getTypeLabel, getSizeLabel } from "@/lib/geocache-utils";
import { getDefaultCacheValues } from "@/lib/geocache-constants";
import { DifficultyTerrainRating } from "@/components/ui/difficulty-terrain-rating";
import { GeocacheForm, type GeocacheFormData } from "@/components/ui/geocache-form";

import { ImageGallery } from "@/components/ImageGallery";
import { ProfileDialog } from "@/components/ProfileDialog";
import { parseVerificationFromHash, verifyKeyPair } from "@/lib/verification";

export default function CacheDetail() {
  const { naddr } = useParams<{ naddr: string }>();
  const navigate = useNavigate();
  const { user } = useCurrentUser();
  const { data: geocache, isLoading, error, isError, refetch } = useGeocacheByNaddr(naddr!);
  const { data: logs = [], refetch: refetchLogs } = useGeocacheLogs(
    geocache ? `${geocache.pubkey}:${geocache.dTag}` : '', 
    geocache?.dTag, 
    geocache?.pubkey,
    geocache?.relays,
    geocache?.verificationPubkey
  );
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
  });
  const [editImages, setEditImages] = useState<string[]>([]);
  const [locationVerification, setLocationVerification] = useState<LocationVerification | null>(null);
  
  // Image gallery state
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);
  
  // Hint visibility state
  const [isHintVisible, setIsHintVisible] = useState(false);
  
  // Profile dialog state
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [selectedProfilePubkey, setSelectedProfilePubkey] = useState<string | null>(null);
  
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
      });
      setEditImages(geocache.images || []);
    }
  }, [geocache]);

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

  // Check for verification key in URL hash
  useEffect(() => {
    const hash = window.location.hash;
    const nsec = parseVerificationFromHash(hash);
    
    if (nsec && geocache?.verificationPubkey) {
      const isValid = verifyKeyPair(nsec, geocache.verificationPubkey);
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
        toast({
          title: "Invalid Verification Key",
          description: "The verification key doesn't match this cache.",
          variant: "destructive",
        });
      }
    }
  }, [geocache?.verificationPubkey, toast]);


  const handleDelete = () => {
    if (!geocache) return;
    confirmSingleDeletion(
      {
        id: geocache.id,
        name: geocache.name,
        event: geocache.event,
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
      });
      setEditImages(geocache.images || []);
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

    editGeocache({
      ...editFormData,
      difficulty: parseInt(editFormData.difficulty),
      terrain: parseInt(editFormData.terrain),
      images: editImages,
    }, {
      onSuccess: () => {
        setIsEditing(false);
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

  if (isLoading) {
    return (
      <FullPageLoading 
        title="Loading geocache..."
        description="Checking multiple relays for the best connection..."
      />
    );
  }

  // Show error with retry option if there was an error and no cached data
  if (isError && !geocache) {
    return (
      <div className="min-h-screen bg-muted/30">
        <DesktopHeader />
        <div className="container mx-auto px-4 py-16">
          <ErrorState
            title="Connection Issue"
            description="Unable to load geocache. This might be a temporary network issue."
            error={error}
            primaryAction={
              <Button onClick={() => refetch()} className="w-full">
                <RefreshCw className="h-4 w-4 mr-2" />
                Try Again
              </Button>
            }
            secondaryAction={
              <Link to="/" className="block">
                <Button variant="outline" className="w-full">Back to Home</Button>
              </Link>
            }
          />
        </div>
      </div>
    );
  }

  if (!isLoading && !isError && !geocache) {
    return (
      <div className="min-h-screen bg-muted/30">
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
    <div className="min-h-screen bg-muted/30">
      <DesktopHeader />

      <div className="container mx-auto px-2 sm:px-4 py-8">
        <div className="grid lg:grid-cols-3 gap-4 lg:gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-4 lg:space-y-6 min-w-0">
            <Card>
              <CardHeader>
                <div className="flex items-start gap-2 sm:gap-4">
                  <div className="min-w-0 flex-1">
                    <CardTitle className="text-2xl break-words">{geocache.name}</CardTitle>
                    
                    <div className="space-y-1 mt-2 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="flex items-center gap-1">
                          <User className="h-4 w-4" />
                          <span>
                            Hidden by{' '}
                            <button
                              onClick={() => handleProfileClick(geocache.pubkey)}
                              className="hover:underline cursor-pointer"
                            >
                              {authorName}
                            </button>
                          </span>
                          {profilePicture && (
                            <img 
                              src={profilePicture} 
                              alt={authorName}
                              className="h-4 w-4 rounded-full object-cover"
                            />
                          )}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          {formatDistanceToNow(new Date(geocache.created_at * 1000), { addSuffix: true })}
                        </span>
                      </div>
                    </div>

                  </div>
                  <div className="flex gap-1 sm:gap-2 flex-shrink-0 ml-2">
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
                  </div>
                </div>
              </CardHeader>
              <CardContent className="overflow-hidden">
                {isEditing ? (
                  // Edit form
                  <GeocacheForm
                    formData={editFormData}
                    onFormDataChange={setEditFormData}
                    images={editImages}
                    onImagesChange={setEditImages}
                    fieldPrefix="edit"
                    isSubmitting={isEditingGeocache}
                  />
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
                      <p className="whitespace-pre-wrap break-words">{geocache.description}</p>
                      
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
                        {geocache.images.map((url, index) => (
                          <img
                            key={index}
                            src={url}
                            alt={`Cache image ${index + 1}`}
                            className="rounded-lg w-full h-48 object-cover cursor-pointer hover:opacity-90 transition-opacity"
                            onClick={() => handleImageClick(index)}
                          />
                        ))}
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            <CacheDetailTabs logCount={logs?.length || 0}>
              <TabsContent value="logs" className="space-y-4" data-logs-section>
                <LogsSection 
                  logs={logs}
                  geocache={geocache}
                  onProfileClick={handleProfileClick}
                  isOwner={isOwner}
                  verificationKey={verificationKey || undefined}
                  isVerificationValid={isVerificationValid}
                />
              </TabsContent>
              
              <TabsContent value="map">
                <div className="h-96 rounded-lg overflow-hidden">
                  <GeocacheMap 
                    geocaches={[geocache]} 
                    center={geocache.location}
                    zoom={15}
                  />
                </div>
              </TabsContent>
            </CacheDetailTabs>
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
                  <p className="text-sm font-medium text-muted-foreground">Coordinates</p>
                  <p className="text-xs md:text-sm font-mono mt-1 break-all">
                    {geocache.location.lat.toFixed(6)}, {geocache.location.lng.toFixed(6)}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2 w-full"
                    onClick={() => {
                      window.open(
                        `https://www.openstreetmap.org/directions?from=&to=${geocache.location.lat}%2C${geocache.location.lng}#map=15/${geocache.location.lat}/${geocache.location.lng}`,
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
                      {logs?.filter(log => log.type === "found").length || 0}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">DNFs</span>
                    <span className="font-medium">
                      {logs?.filter(log => log.type === "dnf").length || 0}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Total Logs</span>
                    <span className="font-medium">{logs?.length || 0}</span>
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
    </div>
  );
}