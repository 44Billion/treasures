import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { MapPin, AlertTriangle, CheckCircle, Check, WifiOff, QrCode, Edit3 } from "lucide-react";
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
import { PageLayout } from "@/components/layout";
import { useCurrentUser } from "@/features/auth/hooks/useCurrentUser";
import { useCreateGeocache } from "@/features/geocache/hooks/useCreateGeocache";
import { LocationPicker } from "@/components/LocationPicker";
import { useToast } from "@/features/geocache/hooks/useToast";
import { verifyLocation, getVerificationSummary, type LocationVerification } from "@/features/geocache/utils/osmVerification";
import { LocationWarnings } from "@/components/LocationWarnings";
import { createDefaultGeocacheFormData } from "@/components/ui/geocache-form.utils";
import type { GeocacheFormData } from "@/components/ui/geocache-form.types";
import {
  CacheNameField,
  CacheDescriptionField,
  CacheHintField,
  CacheDifficultyField,
  CacheTerrainField,
  CacheTypeField,
  CacheSizeField,
  CacheImageManager,
  CacheHiddenField
} from "@/components/ui/geocache-form.fields";
import { DifficultyTerrainRating } from "@/components/ui/difficulty-terrain-rating";
import { mapIcons } from "@/features/map/utils/mapIcons";

import "leaflet/dist/leaflet.css";
import { LoginRequiredCard } from "@/components/LoginRequiredCard";
import { nip19 } from "nostr-tools";
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

// Helper function to convert Uint8Array to hex string - kept for potential future use
// const toHexString = (bytes: Uint8Array) =>
//   bytes.reduce((str, byte) => str + byte.toString(16).padStart(2, '0'), '');

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

  const [importedDTag, setImportedDTag] = useState<string | null>(null);
  const [importedVerificationKeyPair, setImportedVerificationKeyPair] = useState<any>(null);
  const [importedKind, setImportedKind] = useState<number | null>(null);
  const [showQROverlay, setShowQROverlay] = useState(false);

  // Check for claim URL in params (from pre-generated QR code)
  useEffect(() => {
    const processClaimUrl = async () => {
      const claimUrlParam = searchParams.get('claimUrl');
      console.log('🔗 Processing claim URL:', { claimUrlParam, user: !!user });
      
      // Guard against processing the same claim URL multiple times
      if (!claimUrlParam || !user || importedDTag || importedVerificationKeyPair) {
        console.log('🛑 Skipping claim URL processing:', {
          hasClaimUrl: !!claimUrlParam,
          hasUser: !!user,
          hasImportedDTag: !!importedDTag,
          hasImportedKeyPair: !!importedVerificationKeyPair
        });
        return;
      }
      
      try {
        console.log('🔗 Raw claimUrlParam:', claimUrlParam);
        
        // Handle both full URLs and relative URLs
        let claimUrl: URL;
        if (claimUrlParam.startsWith('http')) {
          claimUrl = new URL(claimUrlParam);
        } else {
          // If it's a relative path, construct a full URL
          claimUrl = new URL(claimUrlParam, window.location.origin);
        }
        
        console.log('🌐 Constructed claim URL:', {
          href: claimUrl.href,
          origin: claimUrl.origin,
          pathname: claimUrl.pathname,
          hash: claimUrl.hash,
          search: claimUrl.search
        });
        
        // Extract naddr from pathname - it should be the entire path without leading slash
        const pathname = claimUrl.pathname;
        console.log('📄 Raw pathname:', pathname);
        
        // Handle case where pathname might be like "/naddr1..." or just "naddr1..."
        let naddr = pathname;
        if (pathname.startsWith('/')) {
          naddr = pathname.slice(1);
        }
        
        // If the naddr starts with the origin, remove it (this would be the bug)
        if (naddr.startsWith(claimUrl.origin)) {
          naddr = naddr.slice(claimUrl.origin.length);
          if (naddr.startsWith('/')) {
            naddr = naddr.slice(1);
          }
        }
        
        console.log('🎯 Extracted naddr:', naddr);
        
        // Extract nsec from hash
        const nsec = parseVerificationFromHash(claimUrl.hash);
        console.log('🔑 Extracted nsec:', nsec ? nsec.substring(0, 20) + '...' : null);
        
        if (naddr && nsec) {
          try {
            console.log('🔍 Attempting to decode naddr:', naddr);
            const decodedNaddr = naddrToGeocache(naddr);
            
            console.log('✅ Decoded naddr successfully:', {
              pubkey: decodedNaddr.pubkey,
              identifier: decodedNaddr.identifier,
              kind: decodedNaddr.kind,
              userPubkey: user.pubkey,
              matches: decodedNaddr.pubkey === user.pubkey
            });
            
            if (decodedNaddr.pubkey === user.pubkey) {
              // Decode the nsec to get the private key bytes
              const { data: privateKeyBytes } = nip19.decode(nsec);
              
              // Import the private key and derive the public key
              const { getPublicKey } = await import('nostr-tools');
              
              // The privateKeyBytes is already a Uint8Array, which is what getPublicKey expects
              const publicKeyHex = getPublicKey(privateKeyBytes as Uint8Array);
              
              console.log('🔑 Derived key pair:', {
                publicKey: publicKeyHex,
                publicKeyShort: `${publicKeyHex.substring(0, 10)}...`,
                nsec: nsec.substring(0, 20) + '...'
              });
              
              // Store the complete, valid keypair
              setImportedVerificationKeyPair({
                nsec: nsec,
                privateKey: privateKeyBytes, // Keep as Uint8Array to match interface
                publicKey: publicKeyHex,
                npub: nip19.npubEncode(publicKeyHex), // Add npub to match interface
              });
              
              setImportedDTag(decodedNaddr.identifier);
              setImportedKind(decodedNaddr.kind);
              
              toast({
                title: "Claim URL Imported",
                description: "Your pre-generated cache settings have been loaded. Please fill in the location and other details.",
              });
            } else {
              console.log('❌ Pubkey mismatch:', {
                decodedPubkey: decodedNaddr.pubkey,
                userPubkey: user.pubkey
              });
              toast({
                title: "Invalid Claim URL",
                description: "This claim URL doesn't belong to your account.",
                variant: "destructive",
              });
            }
          } catch (decodeError) {
            console.error('❌ Failed to decode naddr:', naddr, decodeError);
            toast({
              title: "Invalid Claim URL",
              description: "Unable to decode the cache identifier.",
              variant: "destructive",
            });
          }
        } else {
          console.log('❌ Missing naddr or nsec:', { naddr, nsec });
          toast({
            title: "Invalid Claim URL",
            description: "The claim URL is missing required information.",
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error('❌ Failed to parse claim URL:', { claimUrlParam, error });
        toast({
          title: "Invalid Claim URL",
          description: "The provided claim URL is not valid.",
          variant: "destructive",
        });
      }
    };
    
    processClaimUrl();
  }, [searchParams, user, importedDTag, importedVerificationKeyPair, toast]); // Add all dependencies

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
      console.log('🚀 Starting geocache creation...', {
        name: formData.name,
        location,
        importedDTag,
        importedKind,
        difficulty: parseInt(formData.difficulty),
        terrain: parseInt(formData.terrain),
        verificationKeyPair: importedVerificationKeyPair,
      });

      // Location was already confirmed on step 1, so create directly
      const result = await createGeocache({
        ...formData,
        location,
        images,
        difficulty: parseInt(formData.difficulty),
        terrain: parseInt(formData.terrain),
        dTag: importedDTag || undefined, // Use imported dTag if available
        verificationKeyPair: importedVerificationKeyPair || undefined, // Use imported verification keypair if available
        kind: importedKind || undefined, // Use imported kind if available
      });

      console.log('✅ Geocache creation successful:', result);

      const { event } = result;

      // We have the geocache data already, so we can navigate directly with the data
      const { geocache } = result;
      
      // Generate naddr for the created cache (for URL consistency)
      const dTag = event.tags.find((t: string[]) => t[0] === 'd')?.[1];
      console.log('🏷️ Extracted dTag:', dTag);
      
      if (dTag && geocache) {
        const relays = event.tags.filter((t: string[]) => t[0] === 'relay').map((t: string[]) => t[1]);
        console.log('🔗 Extracted relays:', relays);
        
        const { geocacheToNaddr } = await import('@/shared/utils/naddr-utils');
        
        // If this was created from a claim URL, don't include relays in the naddr
        // Otherwise, include relays for regular cache creation
        const includeRelays = !importedDTag; // Only include relays if not from claim URL
        const naddr = geocacheToNaddr(event.pubkey, dTag, relays as string[], event.kind, includeRelays);
        
        console.log('🎯 Generated naddr:', naddr);
        console.log('🧭 Navigating to:', `/${naddr}`);
        console.log('📡 Include relays:', includeRelays);
        
        toast({
          title: "Cache Published Successfully!",
          description: "Your geocache is now live. Redirecting...",
        });
        
        // Navigate to the newly created cache with the data we already have
        // This prevents the "not found" issue while relay propagation happens
        navigate(`/${naddr}`, { 
          state: { 
            geocacheData: geocache,
            justCreated: true 
          } 
        });
      } else {
        console.error('❌ No dTag found in event tags:', event.tags);
        // Fallback: navigate to home if we can't generate naddr
        toast({
          title: "Cache Published Successfully!",
          description: "Your geocache is now live, but we couldn't generate the direct link.",
        });
        navigate('/');
      }
    } catch (error) {
      console.error('❌ Failed to create geocache:', error);
      // Show more detailed error to user
      toast({
        title: "Failed to create geocache",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
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
    <PageLayout maxWidth="2xl" background="default" className={showQROverlay ? "h-screen" : "pb-4 md:pb-0"}>
      {/* QR Code Choice - Bigger prettier buttons */}
      {showQROverlay ? (
        <div className="h-full flex items-center justify-center">
          <div className="max-w-lg mx-auto space-y-4 px-4">
              <div className="text-center mb-8">
                <h2 className="text-2xl text-foreground font-bold mb-2">Create a Geocache</h2>
                <p className="text-sm text-muted-foreground">Choose how you'd like to get started. Create a QR code that you can scan to create your geocache later, or create your full listing now.</p>
              </div>
              
              <div className="space-y-4">
                <Card className="overflow-hidden hover:shadow-lg transition-all duration-200 hover:scale-[1.02] cursor-pointer">
                  <CardContent 
                    className="p-6"
                    onClick={() => navigate('/generate-qr')}
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-full">
                        <QrCode className="h-6 w-6 text-green-600 dark:text-green-400" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-xl font-bold mb-1">QR code now!</h3>
                        <p className="text-sm text-muted-foreground">
                          Quick and easy - get a Treasures Claim QR code instantly. Scan your QR code later to create your geocache.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="overflow-hidden hover:shadow-lg transition-all duration-200 hover:scale-[1.02] cursor-pointer">
                  <CardContent 
                    className="p-6"
                    onClick={() => setShowQROverlay(false)}
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                        <Edit3 className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-xl font-bold mb-1">I'll fill it out here.</h3>
                        <p className="text-sm text-muted-foreground">
                          Already set? Create and publish your geocache listing for the world to find.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
          </div>
        </div>
      ) : (
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
                    onClick={() => navigate('/generate-qr')}
                  >
                    <QrCode className="h-4 w-4" />
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
                    fieldId="cache-type"
                    value={formData.type}
                    onChange={(value) => setFormData({...formData, type: value})}
                  />
                  
                  <CacheDifficultyField
                    fieldId="cache-difficulty"
                    value={formData.difficulty}
                    onChange={(value) => setFormData({...formData, difficulty: value})}
                  />
                  
                  <CacheTerrainField
                    fieldId="cache-terrain"
                    value={formData.terrain}
                    onChange={(value) => setFormData({...formData, terrain: value})}
                  />
                  
                  <CacheSizeField
                    fieldId="cache-size"
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
                  fieldId="cache-type-mobile"
                  value={formData.type}
                  onChange={(value) => setFormData({...formData, type: value})}
                />
                
                <CacheDifficultyField
                  fieldId="cache-difficulty-mobile"
                  value={formData.difficulty}
                  onChange={(value) => setFormData({...formData, difficulty: value})}
                />
                
                <CacheTerrainField
                  fieldId="cache-terrain-mobile"
                  value={formData.terrain}
                  onChange={(value) => setFormData({...formData, terrain: value})}
                />
                
                <CacheSizeField
                  fieldId="cache-size-mobile"
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
        </div>
      )}
    </PageLayout>
  );
}
