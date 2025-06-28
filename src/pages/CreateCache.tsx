import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { MapPin, AlertTriangle, CheckCircle, Check, WifiOff, Upload, FileText } from "lucide-react";
import { CompassSpinner } from "@/components/ui/loading";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { PageLayout } from "@/components/layout";
import { useCurrentUser } from "@/features/auth/hooks/useCurrentUser";
import { useCreateGeocache } from "@/features/geocache/hooks/useCreateGeocache";
import { LocationPicker } from "@/components/LocationPicker";
import { useToast } from "@/features/geocache/hooks/useToast";
import { verifyLocation, getVerificationSummary, type LocationVerification } from "@/features/geocache/utils/osmVerification";
import { LocationWarnings } from "@/components/LocationWarnings";
import { 
  createDefaultGeocacheFormData, 
  type GeocacheFormData,
  CacheNameField,
  CacheDescriptionField,
  CacheHintField,
  CacheDifficultyField,
  CacheTerrainField,
  CacheTypeField,
  CacheSizeField,
  CacheImageManager,
  CacheHiddenField
} from "@/components/ui/geocache-form";
import { DifficultyTerrainRating } from "@/components/ui/difficulty-terrain-rating";
import { mapIcons } from "@/features/map/utils/mapIcons";

import "leaflet/dist/leaflet.css";
import { LoginRequiredCard } from "@/components/LoginRequiredCard";
import { nip19 } from "nostr-tools";
import { getPublicKey } from "nostr-tools";
import { VerificationQRDialog } from "@/components/VerificationQRDialog";
import type { VerificationKeyPair } from "@/features/geocache/utils/verification";
import { parseVerificationFromHash } from "@/features/geocache/utils/verification";
import { naddrToGeocache } from "@/shared/utils/naddr-utils";
import { useOfflineMode } from "@/features/geocache/hooks/useOfflineStorage";

// CSS override for confirmation map
const confirmMapStyles = `
  .confirm-map-container.leaflet-container {
    min-height: 128px !important;
    height: 128px !important;
    max-height: 128px !important;
  }
`;

// Inject styles
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = confirmMapStyles;
  document.head.appendChild(style);
}

// Component to ensure map recognizes its actual size
function MapResizer({ location }: { location: { lat: number; lng: number } }) {
  const map = useMap();
  
  useEffect(() => {
    // Force map to recognize its actual container size immediately
    map.invalidateSize(true);
    // Set view again with exact coordinates to force proper centering
    map.setView([location.lat, location.lng], 16, { animate: false });
  }, [map, location]);
  
  return null;
}

interface PreGeneratedCache {
  name: string;
  dTag: string;
  verificationKeyPair: any;
  mockEvent: any;
  naddr: string;
  timestamp: number;
}

// Helper function to convert Uint8Array to hex string
const toHexString = (bytes: Uint8Array) =>
  bytes.reduce((str, byte) => str + byte.toString(16).padStart(2, '0'), '');

export default function CreateCache() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useCurrentUser();
  const { isOfflineMode } = useOfflineMode();
  const { mutateAsync: createGeocache, isPending } = useCreateGeocache();
  const { toast } = useToast();

  const [formData, setFormData] = useState<GeocacheFormData>(createDefaultGeocacheFormData());
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [images, setImages] = useState<string[]>([]);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 4;
  const [locationVerification, setLocationVerification] = useState<LocationVerification | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [showQRDialog, setShowQRDialog] = useState(false);
  const [createdNaddr, setCreatedNaddr] = useState<string>('');
  const [verificationKeyPair, setVerificationKeyPair] = useState<VerificationKeyPair | null>(null);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importData, setImportData] = useState<string>('');
  const [importedDTag, setImportedDTag] = useState<string | null>(null);
  const [importedVerificationKeyPair, setImportedVerificationKeyPair] = useState<any>(null);

  // Check for import data in URL params
  useEffect(() => {
    const importParam = searchParams.get('import');
    if (importParam) {
      try {
        const decoded = atob(importParam);
        handleImportData(decoded);
      } catch (error) {
        toast({
          title: "Import Failed",
          description: "Invalid import data in URL",
          variant: "destructive",
        });
      }
    }
  }, [searchParams]);

  // Check for claim URL in params (from pre-generated QR code)
  useEffect(() => {
    const claimUrlParam = searchParams.get('claimUrl');
    if (claimUrlParam && user) {
      try {
        const claimUrl = new URL(claimUrlParam);
        const naddr = claimUrl.pathname.slice(1); // Remove leading slash
        const nsec = parseVerificationFromHash(claimUrl.hash);
        
        if (naddr && nsec) {
          try {
            const decodedNaddr = naddrToGeocache(naddr);
            
            if (decodedNaddr.pubkey === user.pubkey) {
              // Decode the nsec to get the private key bytes
              const { data: privateKeyBytes } = nip19.decode(nsec);
              // Derive the public key (getPublicKey expects a hex string)
              const privateKeyHex = toHexString(privateKeyBytes as Uint8Array);
              const publicKey = getPublicKey(privateKeyHex);
              
              // Store the complete, valid keypair
              setImportedVerificationKeyPair({
                nsec: nsec,
                publicKey: publicKey,
              });
              
              setImportedDTag(decodedNaddr.identifier);
              
              toast({
                title: "Claim URL Imported",
                description: "Your pre-generated cache settings have been loaded. Please fill in the location and other details.",
              });
            } else {
              toast({
                title: "Invalid Claim URL",
                description: "This claim URL doesn't belong to your account.",
                variant: "destructive",
              });
            }
          } catch (decodeError) {
            toast({
              title: "Invalid Claim URL",
              description: "Unable to decode the cache identifier.",
              variant: "destructive",
            });
          }
        }
      } catch (error) {
        toast({
          title: "Invalid Claim URL",
          description: "The provided claim URL is not valid.",
          variant: "destructive",
        });
      }
    }
  }, [searchParams, user]);

  const handleImportData = (data: string) => {
    try {
      const parsed: PreGeneratedCache = JSON.parse(data);
      
      // Validate the structure
      if (!parsed.name || !parsed.dTag || !parsed.verificationKeyPair || !parsed.naddr) {
        throw new Error("Invalid cache data structure");
      }

      // Import the data - just pre-fill the name, user can fill in the rest
      setFormData({
        ...formData,
        name: parsed.name
      });
      
      // Store the dTag and verification keypair for later use
      setImportedDTag(parsed.dTag);
      setImportedVerificationKeyPair(parsed.verificationKeyPair);
      
      // Stay on step 1 so user can fill in location and other details
      setCurrentStep(1);

      toast({
        title: "Cache Name Imported",
        description: `Cache name "${parsed.name}" has been imported. Please fill in the location and other details.`,
      });

      setShowImportDialog(false);
      setImportData('');
    } catch (error) {
      toast({
        title: "Import Failed",
        description: error instanceof Error ? error.message : "Invalid JSON data",
        variant: "destructive",
      });
    }
  };

  const handleImportFromDialog = () => {
    if (!importData.trim()) return;
    handleImportData(importData);
  };

  // Handle location verification when location changes
  const handleLocationChange = async (newLocation: { lat: number; lng: number } | null) => {
    setLocation(newLocation);
    
    if (newLocation && currentStep === 1) {
      setIsVerifying(true);
      try {
        const verification = await verifyLocation(newLocation.lat, newLocation.lng);
        setLocationVerification(verification);
      } catch (error) {
        // Set a fallback verification with warning
        setLocationVerification({
          isRestricted: false,
          warnings: ['Unable to verify location restrictions. Please manually verify the location is appropriate.'],
          nearbyFeatures: [],
          accessibility: {
            wheelchair: undefined,
            parking: undefined,
            publicTransport: undefined,
            fee: undefined,
            openingHours: undefined,
          },
          terrain: {
            surface: undefined,
            hazards: [],
            lit: undefined,
            covered: undefined,
          },
          legal: {
            restrictions: [],
          },
          environmental: {
            nesting: undefined,
            protected: undefined,
            leaveNoTrace: undefined,
          },
          safety: {
            surveillance: undefined,
            cellCoverage: undefined,
            lighting: undefined,
          },
        });
      } finally {
        setIsVerifying(false);
      }
    } else if (!newLocation) {
      setLocationVerification(null);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Prevent default form submission - we handle creation in handleCreateGeocache
  };

  const handleCreateGeocache = async () => {
    if (!formData.name.trim()) {
      toast({
        title: "Cache name required",
        description: "Please enter a name for your geocache",
        variant: "destructive",
      });
      return;
    }

    if (!formData.description.trim()) {
      toast({
        title: "Description required", 
        description: "Please enter a description for your geocache",
        variant: "destructive",
      });
      return;
    }

    if (!location) {
      toast({
        title: "Location required",
        description: "Please select a location for your geocache",
        variant: "destructive",
      });
      return;
    }

    try {
      // Location was already confirmed on step 1, so create directly
      const { event, verificationKeyPair } = await createGeocache({
        ...formData,
        location,
        images,
        difficulty: parseInt(formData.difficulty),
        terrain: parseInt(formData.terrain),
        dTag: importedDTag || undefined, // Use imported dTag if available
        verificationKeyPair: importedVerificationKeyPair || undefined, // Use imported verification keypair if available
      });

      // Generate naddr for the created cache
      const dTag = event.tags.find((t: string[]) => t[0] === 'd')?.[1];
      if (dTag) {
        const relays = event.tags.filter((t: string[]) => t[0] === 'relay').map((t: string[]) => t[1]);
        const { geocacheToNaddr } = await import('@/shared/utils/naddr-utils');
        const naddr = geocacheToNaddr(event.pubkey, dTag, relays);
        
        // Only show the QR dialog if we didn't import pre-generated data
        // (since the user already has the QR code from the pre-generation)
        if (!importedDTag) {
          setCreatedNaddr(naddr);
          setVerificationKeyPair(verificationKeyPair);
          setShowQRDialog(true);
        } else {
          // For imported caches, just navigate directly to the cache page
          toast({
            title: "Cache Published Successfully!",
            description: "Your pre-generated cache is now live. The QR code you generated earlier will work perfectly.",
          });
          navigate(`/${naddr}`);
        }
      }
    } catch (error) {
      // Error handling is already done in the mutation
      console.error('Failed to create geocache:', error);
    }
  };

  const handleLocationConfirm = () => {
    setShowConfirmDialog(false);
    // Move to next step after confirming location
    setCurrentStep(2);
  };

  const handleLocationReview = () => {
    setShowConfirmDialog(false);
    // User stays on step 1 to modify the location
  };

  if (!user) {
    return (
      <PageLayout maxWidth="md" className="py-16">
        <LoginRequiredCard
          icon={MapPin}
          description="You need to be logged in to create a geocache."
          className="max-w-md mx-auto"
        />
      </PageLayout>
    );
  }

  if (isOfflineMode) {
    return (
      <PageLayout maxWidth="md" className="py-16">
        <Card className="max-w-md mx-auto">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <div className="mx-auto w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
                <WifiOff className="h-6 w-6 text-gray-500" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground">Offline Mode</h3>
                <p className="text-sm text-muted-foreground mt-2">
                  Creating geocaches requires an internet connection. Please check your connection and try again.
                </p>
              </div>
              <Button onClick={() => navigate("/")} variant="outline" className="w-full">
                Go Back
              </Button>
            </div>
          </CardContent>
        </Card>
      </PageLayout>
    );
  }

  return (
    <PageLayout maxWidth="2xl" background="default" className="pb-4 md:pb-0">
      {/* Mobile: No card wrapper, desktop: Card wrapper */}
      <div className="max-w-2xl mx-auto create-cache-container">
        {/* Header - mobile only */}
        <div className="md:hidden px-4 py-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-foreground">Hide a New Geocache</h1>
            </div>
            <div className="flex gap-2 ml-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowImportDialog(true)}
              >
                <Upload className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/generate-qr')}
              >
                <FileText className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <p className="text-muted-foreground">
            Create a new geocache for others to discover. Choose your difficulty and terrain ratings carefully - 
            they help seekers know what to expect and prepare appropriately.
          </p>
        </div>
        
        {/* Desktop Card Header */}
        <Card className="hidden md:block">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-foreground">Hide a New Geocache</CardTitle>
                <CardDescription>
                  Create a new geocache for others to discover. Choose your difficulty and terrain ratings carefully - 
                  they help seekers know what to expect and prepare appropriately.
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowImportDialog(true)}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Import
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate('/generate-qr')}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Generate QR
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Progress Indicator */}
              <div className="flex items-center justify-center mb-4 px-4 overflow-hidden create-cache-progress">
                <div className="flex items-center w-full max-w-xs min-w-0">
                  {[1, 2, 3, 4].map((step, index) => (
                    <React.Fragment key={step}>
                      <div className={`w-6 h-6 xs:w-7 xs:h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs xs:text-sm font-medium shrink-0 ${
                        step < currentStep ? 'bg-green-500 text-white' :
                        step === currentStep ? 'bg-primary dark:text-black text-white' :
                        'bg-secondary text-gray-500'
                      }`}>
                        {step < currentStep ? '✓' : step}
                      </div>
                      {index < totalSteps - 1 && (
                        <div className={`h-0.5 xs:h-1 mx-0.5 xs:mx-1 sm:mx-2 flex-1 min-w-[0.5rem] ${
                          step < currentStep ? 'bg-green-500' : 'bg-secondary'
                        }`} />
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </div>

              {/* Step Content */}
              {currentStep === 1 && (
                <div className="space-y-4">
                  <div className="text-center mb-4">
                    <h3 className="text-lg font-semibold mb-1 text-foreground">Choose the location</h3>
                    <p className="text-sm text-gray-600 dark:text-muted-foreground">Where will seekers find your geocache?</p>
                  </div>
                  
                  <LocationPicker
                    value={location}
                    onChange={handleLocationChange}
                  />
                  
                  {isVerifying && (
                    <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground bg-muted/50 dark:bg-muted rounded-lg p-3">
                      <CompassSpinner size={16} variant="component" />
                      Checking location restrictions...
                    </div>
                  )}
                  
                  {locationVerification && (
                    <LocationWarnings 
                      verification={locationVerification} 
                      hideCreatorWarnings={true}
                    />
                  )}
                  
                  <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950/20">
                    <AlertDescription className="text-sm">
                      Ensure you have permission to place a cache here and that it's publicly accessible.
                    </AlertDescription>
                  </Alert>
                </div>
              )}

              {currentStep === 2 && (
                <div className="space-y-4">
                  <div className="text-center mb-4">
                    <h3 className="text-lg font-semibold mb-1 text-foreground">Tell us about your cache</h3>
                    <p className="text-sm text-gray-600 dark:text-muted-foreground">Give your geocache a name and description</p>
                  </div>
                  
                  <CacheNameField
                    value={formData.name}
                    onChange={(value) => setFormData({...formData, name: value})}
                    required={true}
                  />
                  
                  <CacheDescriptionField
                    value={formData.description}
                    onChange={(value) => setFormData({...formData, description: value})}
                    required={true}
                  />
                  
                  <CacheHintField
                    value={formData.hint}
                    onChange={(value) => setFormData({...formData, hint: value})}
                  />
                </div>
              )}

              {currentStep === 3 && (
                <div className="space-y-4">
                  <div className="text-center mb-4">
                    <h3 className="text-lg font-semibold mb-1 text-foreground">Set the challenge level</h3>
                    <p className="text-sm text-gray-600 dark:text-muted-foreground">Help seekers know what to expect</p>
                  </div>
                  
                  <CacheTypeField
                    value={formData.type}
                    onChange={(value) => setFormData({...formData, type: value})}
                  />
                  
                  <CacheDifficultyField
                    value={formData.difficulty}
                    onChange={(value) => setFormData({...formData, difficulty: value})}
                  />
                  
                  <CacheTerrainField
                    value={formData.terrain}
                    onChange={(value) => setFormData({...formData, terrain: value})}
                  />
                  
                  <CacheSizeField
                    value={formData.size}
                    onChange={(value) => setFormData({...formData, size: value})}
                  />
                </div>
              )}

              {currentStep === 4 && (
                <div className="space-y-4">
                  <div className="text-center mb-4">
                    <h3 className="text-lg font-semibold mb-1 text-foreground">Add photos & final touches</h3>
                    <p className="text-sm text-gray-600 dark:text-muted-foreground">Help seekers identify the area</p>
                  </div>
                  
                  <CacheImageManager
                    images={images}
                    onImagesChange={setImages}
                    disabled={isPending || isVerifying}
                  />
                  
                  <CacheHiddenField
                    checked={formData.hidden || false}
                    onChange={(checked) => setFormData({...formData, hidden: checked})}
                  />
                  
                  {/* Preview */}
                  <div className="bg-muted/20 border border-muted rounded-lg p-4">
                    <h4 className="text-sm font-medium text-muted-foreground mb-3">Preview: How your cache will appear</h4>
                    <div className="space-y-2">
                      <h5 className="font-medium text-foreground">{formData.name || "Your Cache Name"}</h5>
                      <p className="text-sm text-muted-foreground">{formData.description || "Your description..."}</p>
                      <DifficultyTerrainRating
                        difficulty={parseInt(formData.difficulty) || 1}
                        terrain={parseInt(formData.terrain) || 1}
                        cacheSize={formData.size}
                        showLabels={true}
                        size="small"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Navigation Buttons */}
              <div className="flex gap-4 pt-4">
                {currentStep > 1 && (
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setCurrentStep(currentStep - 1)}
                    className="flex-1"
                  >
                    ← Previous
                  </Button>
                )}
                
                {currentStep < totalSteps ? (
                  <Button 
                    type="button" 
                    onClick={() => {
                      // Validate current step
                      if (currentStep === 1 && !location) {
                        toast({
                          title: "Please select a location",
                          description: "Location is required to continue",
                          variant: "destructive",
                        });
                        return;
                      }
                      if (currentStep === 1 && location && !locationVerification) {
                        toast({
                          title: "Verifying location",
                          description: "Please wait while we verify your location",
                          variant: "default",
                        });
                        return;
                      }
                      if (currentStep === 1 && location && locationVerification) {
                        // Show confirmation dialog for step 1
                        setShowConfirmDialog(true);
                        return;
                      }
                      if (currentStep === 2 && (!formData.name.trim() || !formData.description.trim())) {
                        toast({
                          title: "Please complete required fields",
                          description: "Name and description are required",
                          variant: "destructive",
                        });
                        return;
                      }
                      setCurrentStep(currentStep + 1);
                    }}
                    className="flex-1"
                  >
                    Next →
                  </Button>
                ) : (
                  <Button 
                    type="button" 
                    onClick={handleCreateGeocache}
                    disabled={isPending || isVerifying} 
                    className="flex-1"
                  >
                    {isVerifying ? (
                      <>
                        <CompassSpinner size={16} variant="component" className="mr-2" />
                        Verifying Location...
                      </>
                    ) : isPending ? (
                      "Creating..."
                    ) : (
                      "Create"
                    )}
                  </Button>
                )}
                
                <Button type="button" variant="outline" onClick={() => navigate("/")}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
        
        {/* Mobile Form - no card wrapper */}
        <div className="md:hidden px-4 pb-4 bg-background">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Progress Indicator */}
            <div className="flex items-center justify-center mb-4 px-2 overflow-hidden create-cache-progress">
              <div className="flex items-center w-full max-w-xs min-w-0">
                {[1, 2, 3, 4].map((step, index) => (
                  <React.Fragment key={step}>
                    <div className={`w-6 h-6 xs:w-7 xs:h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs xs:text-sm font-medium shrink-0 ${
                      step < currentStep ? 'bg-green-500 text-white' :
                      step === currentStep ? 'bg-primary dark:text-black text-white' :
                      'bg-secondary text-gray-500'
                    }`}>
                      {step < currentStep ? '✓' : step}
                    </div>
                    {index < totalSteps - 1 && (
                      <div className={`h-0.5 xs:h-1 mx-0.5 xs:mx-1 sm:mx-2 flex-1 min-w-[0.5rem] ${
                        step < currentStep ? 'bg-green-500' : 'bg-secondary'
                      }`} />
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>

            {/* Step Content */}
            {currentStep === 1 && (
              <div className="space-y-4">
                <div className="text-center mb-4">
                  <h3 className="text-lg font-semibold mb-1 text-foreground">Choose the location</h3>
                  <p className="text-sm text-gray-600 dark:text-muted-foreground">Where will seekers find your geocache?</p>
                </div>
                
                <LocationPicker
                  value={location}
                  onChange={handleLocationChange}
                />
                
                {isVerifying && (
                  <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground bg-muted/50 dark:bg-muted rounded-lg p-3">
                    <CompassSpinner size={16} variant="component" />
                    Checking location restrictions...
                  </div>
                )}
                
                {locationVerification && (
                  <LocationWarnings 
                    verification={locationVerification} 
                    hideCreatorWarnings={true}
                  />
                )}
                
                <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950/20">
                  <AlertDescription className="text-sm">
                    Ensure you have permission to place a cache here and that it's publicly accessible.
                  </AlertDescription>
                </Alert>
              </div>
            )}

            {currentStep === 2 && (
              <div className="space-y-4">
                <div className="text-center mb-4">
                  <h3 className="text-lg font-semibold mb-1 text-foreground">Tell us about your cache</h3>
                  <p className="text-sm text-gray-600 dark:text-muted-foreground">Give your geocache a name and description</p>
                </div>
                
                <CacheNameField
                  value={formData.name}
                  onChange={(value) => setFormData({...formData, name: value})}
                  required={true}
                />
                
                <CacheDescriptionField
                  value={formData.description}
                  onChange={(value) => setFormData({...formData, description: value})}
                  required={true}
                />
                
                <CacheHintField
                  value={formData.hint}
                  onChange={(value) => setFormData({...formData, hint: value})}
                />
              </div>
            )}

            {currentStep === 3 && (
              <div className="space-y-4">
                <div className="text-center mb-4">
                  <h3 className="text-lg font-semibold mb-1 text-foreground">Set the challenge level</h3>
                  <p className="text-sm text-gray-600 dark:text-muted-foreground">Help seekers know what to expect</p>
                </div>
                
                <CacheTypeField
                  value={formData.type}
                  onChange={(value) => setFormData({...formData, type: value})}
                />
                
                <CacheDifficultyField
                  value={formData.difficulty}
                  onChange={(value) => setFormData({...formData, difficulty: value})}
                />
                
                <CacheTerrainField
                  value={formData.terrain}
                  onChange={(value) => setFormData({...formData, terrain: value})}
                />
                
                <CacheSizeField
                  value={formData.size}
                  onChange={(value) => setFormData({...formData, size: value})}
                />
              </div>
            )}

            {currentStep === 4 && (
              <div className="space-y-4">
                <div className="text-center mb-4">
                  <h3 className="text-lg font-semibold mb-1 text-foreground">Add photos & final touches</h3>
                  <p className="text-sm text-gray-600 dark:text-muted-foreground">Help seekers identify the area</p>
                </div>
                
                <CacheImageManager
                  images={images}
                  onImagesChange={setImages}
                  disabled={isPending || isVerifying}
                />
                
                <CacheHiddenField
                  checked={formData.hidden || false}
                  onChange={(checked) => setFormData({...formData, hidden: checked})}
                />
                
                {/* Preview */}
                <div className="bg-muted/20 border border-muted rounded-lg p-4">
                  <h4 className="text-sm font-medium text-muted-foreground mb-3">Preview: How your cache will appear</h4>
                  <div className="space-y-2">
                    <h5 className="font-medium text-foreground">{formData.name || "Your Cache Name"}</h5>
                    <p className="text-sm text-muted-foreground">{formData.description || "Your description..."}</p>
                    <DifficultyTerrainRating
                      difficulty={parseInt(formData.difficulty) || 1}
                      terrain={parseInt(formData.terrain) || 1}
                      cacheSize={formData.size}
                      showLabels={true}
                      size="small"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex gap-4 pt-4">
              {currentStep > 1 && (
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setCurrentStep(currentStep - 1)}
                  className="flex-1"
                >
                  ← Previous
                </Button>
              )}
              
              {currentStep < totalSteps ? (
                <Button 
                  type="button" 
                  onClick={() => {
                    // Validate current step
                    if (currentStep === 1 && !location) {
                      toast({
                        title: "Please select a location",
                        description: "Location is required to continue",
                        variant: "destructive",
                      });
                      return;
                    }
                    if (currentStep === 1 && location && !locationVerification) {
                      toast({
                        title: "Verifying location",
                        description: "Please wait while we verify your location",
                        variant: "default",
                      });
                      return;
                    }
                    if (currentStep === 1 && location && locationVerification) {
                      // Show confirmation dialog for step 1
                      setShowConfirmDialog(true);
                      return;
                    }
                    if (currentStep === 2 && (!formData.name.trim() || !formData.description.trim())) {
                      toast({
                        title: "Please complete required fields",
                        description: "Name and description are required",
                        variant: "destructive",
                      });
                      return;
                    }
                    setCurrentStep(currentStep + 1);
                  }}
                  className="flex-1"
                >
                  Next →
                </Button>
              ) : (
                <Button 
                  type="button" 
                  onClick={handleCreateGeocache}
                  disabled={isPending || isVerifying} 
                  className="flex-1"
                >
                  {isVerifying ? (
                    <>
                      <CompassSpinner size={16} variant="component" className="mr-2" />
                      Verifying Location...
                    </>
                  ) : isPending ? (
                    "Creating..."
                  ) : (
                    "Create"
                  )}
                </Button>
              )}
              
              <Button type="button" variant="outline" onClick={() => navigate("/")}>
                Cancel
              </Button>
            </div>
          </form>
        </div>
      </div>

      {/* Location Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent className="max-w-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Cache Location</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                {location && (
                  <div className="grid grid-cols-2 gap-3">
                    {/* Map Preview & Coordinates */}
                    <div className="space-y-2">
                      <div className="h-32 w-full rounded-md overflow-hidden border">
                        <div className="h-32 w-full" style={{ minHeight: '128px' }}>
                          <MapContainer
                            center={[location.lat, location.lng]}
                            zoom={16}
                            style={{ height: "128px", width: "100%", minHeight: "128px" }}
                            className="confirm-map-container"
                            scrollWheelZoom={false}
                            dragging={false}
                            zoomControl={false}
                            doubleClickZoom={false}
                            attributionControl={false}
                            touchZoom={false}
                          >
                          <TileLayer
                            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                          />
                          <MapResizer location={location} />
                          <Marker 
                            position={[location.lat, location.lng]} 
                            icon={mapIcons.droppedPin}
                          />
                        </MapContainer>
                        </div>
                      </div>
                      <div className="bg-muted/50 dark:bg-muted p-2 rounded text-center">
                        <div className="font-mono text-xs">
                          {location.lat}, {location.lng}
                        </div>
                      </div>
                    </div>
                    
                    {/* Confirmation */}
                    <div className="flex items-center">
                      <div className="text-sm">
                        <div className="font-medium mb-2 text-foreground">Please confirm:</div>
                        <div className="space-y-1 text-xs text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <Check className="h-4 w-4 text-green-600" />
                            <span>You have permission to place this cache</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Check className="h-4 w-4 text-green-600" />
                            <span>The location is publicly accessible</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Check className="h-4 w-4 text-green-600" />
                            <span>The location is safe and appropriate</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Check className="h-4 w-4 text-green-600" />
                            <span>The coordinates are accurate</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Location Analysis */}
                {locationVerification && (
                  <LocationWarnings 
                    verification={locationVerification} 
                    className="space-y-2"
                    hideCreatorWarnings={false}
                  />
                )}


              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel onClick={handleLocationReview}>Review Location</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleLocationConfirm}
              className={`flex items-center gap-2 ${
                locationVerification && getVerificationSummary(locationVerification).status === 'restricted'
                  ? 'bg-yellow-600 hover:bg-yellow-700'
                  : 'bg-green-600 hover:bg-green-700'
              }`}
            >
              {locationVerification && getVerificationSummary(locationVerification).status === 'restricted' ? (
                <>
                  <AlertTriangle className="h-4 w-4" />
                  Use Despite Warnings
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4" />
                  Use This Location
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Verification QR Dialog */}
      {verificationKeyPair && (
        <VerificationQRDialog
          isOpen={showQRDialog}
          onOpenChange={(open) => {
            setShowQRDialog(open);
            if (!open) {
              // Navigate to the cache after closing the QR dialog
              if (createdNaddr) {
                navigate(`/${createdNaddr}`);
              }
            }
          }}
          naddr={createdNaddr}
          verificationKeyPair={verificationKeyPair}
          cacheName={formData.name}
        />
      )}

      {/* Import Dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Import Pre-Generated Cache</DialogTitle>
            <DialogDescription>
              Paste the JSON data from a previously generated cache to pre-fill this form.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="import-textarea">Cache Data (JSON)</Label>
              <Textarea
                id="import-textarea"
                value={importData}
                onChange={(e) => setImportData(e.target.value)}
                placeholder="Paste your exported cache JSON data here..."
                rows={12}
                className="font-mono text-xs"
              />
            </div>
            
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setShowImportDialog(false);
                  setImportData('');
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleImportFromDialog}
                disabled={!importData.trim()}
              >
                <Upload className="h-4 w-4 mr-2" />
                Import Data
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </PageLayout>
  );
}