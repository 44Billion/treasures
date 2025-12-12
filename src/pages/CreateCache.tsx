import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router-dom";
import { MapPin, AlertTriangle, CheckCircle, Check, QrCode, Edit3, FileEdit } from "lucide-react";
import { CompassSpinner } from "@/components/ui/loading";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import { useTheme } from "@/shared/hooks/useTheme";
import { MAP_STYLES } from "@/features/map/constants/mapStyles";
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
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useCurrentUser();

  const { mutateAsync: createGeocache, isPending } = useCreateGeocache();
  const { toast } = useToast();
  const { theme, systemTheme } = useTheme();

  // Persistent form state - survives browser backgrounding
  const STORAGE_KEY = 'treasures-create-cache-draft';

  // Load saved draft on mount
  const loadDraft = () => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const draft = JSON.parse(saved);
        return {
          formData: draft.formData || createDefaultGeocacheFormData(),
          location: draft.location || null,
          images: draft.images || [],
          currentStep: draft.currentStep || 1,
        };
      }
    } catch (error) {
      console.error('Failed to load draft:', error);
    }
    return null;
  };

  const draft = loadDraft();
  const [formData, setFormData] = useState<GeocacheFormData>(draft?.formData || createDefaultGeocacheFormData());
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(draft?.location || null);
  const [images, setImages] = useState<string[]>(draft?.images || []);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [currentStep, setCurrentStep] = useState(draft?.currentStep || 1);
  const totalSteps = 4;
  const [locationVerification, setLocationVerification] = useState<LocationVerification | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  // Save draft to localStorage whenever form data changes
  useEffect(() => {
    const draft = {
      formData,
      location,
      images,
      currentStep,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  }, [formData, location, images, currentStep]);

  // Clear draft when successfully creating geocache
  const clearDraft = () => {
    localStorage.removeItem(STORAGE_KEY);
  };

  const [importedDTag, setImportedDTag] = useState<string | null>(null);
  const [importedVerificationKeyPair, setImportedVerificationKeyPair] = useState<any>(null);
  const [importedKind, setImportedKind] = useState<number | null>(null);
  const [showQROverlay, setShowQROverlay] = useState(false);
  const [showDraftNotice, setShowDraftNotice] = useState(!!draft);

  // Function to start fresh by clearing the draft
  const startFresh = () => {
    clearDraft();
    setFormData(createDefaultGeocacheFormData());
    setLocation(null);
    setImages([]);
    setCurrentStep(1);
    setShowDraftNotice(false);
  };

  // Map style management for confirmation dialog - using same logic as GeocacheMap
  const getDefaultMapStyle = () => {
    // First check app theme setting
    if (theme === "dark") {
      return "dark";
    } else if (theme === "light") {
      return "original";
    } else if (theme === "adventure") {
      return "adventure";
    } else if (theme === "system") {
      // Use system preference if theme is set to system
      return systemTheme === "dark" ? "dark" : "original";
    }

    // Fallback to system preference if theme is undefined (during mounting)
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return "dark";
    }
    return "original";
  };

  const [currentMapStyle, setCurrentMapStyle] = useState(getDefaultMapStyle());
  const [hasManuallySelectedStyle, setHasManuallySelectedStyle] = useState(false);
  const mapStyle = MAP_STYLES[currentMapStyle] || MAP_STYLES.original;

  // Listen for theme changes and update map style accordingly - using same logic as GeocacheMap
  useEffect(() => {
    const newDefaultStyle = () => {
      if (theme === "dark") {
        return "dark";
      } else if (theme === "light") {
        return "original";
      } else if (theme === "adventure") {
        return "adventure";
      } else if (theme === "system") {
        return systemTheme === "dark" ? "dark" : "original";
      }

      // Fallback to system preference if theme is undefined (during mounting)
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return "dark";
      }
      return "original";
    };

    const newStyle = newDefaultStyle();
    if (currentMapStyle !== newStyle) {
      setCurrentMapStyle(newStyle);
    }
  }, [theme, systemTheme, currentMapStyle]);

  // Also listen for system theme changes as backup - using same logic as GeocacheMap
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleThemeChange = (e: MediaQueryListEvent) => {
      // Only respond to system changes if app theme is set to system or undefined AND user hasn't manually selected a style
      if ((theme === "system" || !theme) && !hasManuallySelectedStyle) {
        const newDefaultStyle = e.matches ? "dark" : "original";
        if (currentMapStyle !== newDefaultStyle) {
          setCurrentMapStyle(newDefaultStyle);
        }
      }
    };

    mediaQuery.addEventListener('change', handleThemeChange);
    return () => mediaQuery.removeEventListener('change', handleThemeChange);
  }, [theme, currentMapStyle, hasManuallySelectedStyle]);

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
                title: t('createCache.claimUrl.imported.title'),
                description: t('createCache.claimUrl.imported.description'),
              });
            } else {
              console.log('❌ Pubkey mismatch:', {
                decodedPubkey: decodedNaddr.pubkey,
                userPubkey: user.pubkey
              });
              toast({
                title: t('createCache.claimUrl.invalid.title'),
                description: t('createCache.claimUrl.invalid.wrongAccount'),
                variant: "destructive",
              });
            }
          } catch (decodeError) {
            console.error('❌ Failed to decode naddr:', naddr, decodeError);
            toast({
              title: t('createCache.claimUrl.invalid.title'),
              description: t('createCache.claimUrl.invalid.decodeFailed'),
              variant: "destructive",
            });
          }
        } else {
          console.log('❌ Missing naddr or nsec:', { naddr, nsec });
          toast({
            title: t('createCache.claimUrl.invalid.title'),
            description: t('createCache.claimUrl.invalid.missingInfo'),
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error('❌ Failed to parse claim URL:', { claimUrlParam, error });
        toast({
          title: t('createCache.claimUrl.invalid.title'),
          description: t('createCache.claimUrl.invalid.notValid'),
          variant: "destructive",
        });
      }
    };

    processClaimUrl();
  }, [searchParams, user, importedDTag, importedVerificationKeyPair, toast, t]); // Add all dependencies

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

  // Re-verify location from draft when component mounts
  useEffect(() => {
    if (draft?.location && currentStep === 1) {
      handleLocationChange(draft.location);
    }
  }, []); // Only run once on mount

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Prevent default form submission - we handle creation in handleCreateGeocache
  };

  const handleCreateGeocache = async () => {
    if (!formData.name.trim()) {
      toast({
        title: t('createCache.validation.nameRequired.title'),
        description: t('createCache.validation.nameRequired.description'),
        variant: "destructive",
      });
      return;
    }

    if (!formData.description.trim()) {
      toast({
        title: t('createCache.validation.descriptionRequired.title'),
        description: t('createCache.validation.descriptionRequired.description'),
        variant: "destructive",
      });
      return;
    }

    if (!location) {
      toast({
        title: t('createCache.validation.locationRequired.title'),
        description: t('createCache.validation.locationRequired.description'),
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
          title: t('createCache.publish.success.title'),
          description: t('createCache.publish.success.redirecting'),
        });

        // Clear the draft since cache was created successfully
        clearDraft();

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
          title: t('createCache.publish.success.title'),
          description: t('createCache.publish.success.noLink'),
        });
        navigate('/');
      }
    } catch (error) {
      console.error('❌ Failed to create geocache:', error);
      // Show more detailed error to user
      toast({
        title: t('createCache.publish.failed.title'),
        description: error instanceof Error ? error.message : t('createCache.publish.failed.unknown'),
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
          description={t('createCache.loginRequired')}
          className="max-w-md mx-auto"
        />
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
                <h2 className="text-2xl text-foreground font-bold mb-2">{t('createCache.overlay.title')}</h2>
                <p className="text-sm text-muted-foreground">{t('createCache.overlay.description')}</p>
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
                        <h3 className="text-xl font-bold mb-1">{t('createCache.overlay.qrOption.title')}</h3>
                        <p className="text-sm text-muted-foreground">
                          {t('createCache.overlay.qrOption.description')}
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
                        <h3 className="text-xl font-bold mb-1">{t('createCache.overlay.formOption.title')}</h3>
                        <p className="text-sm text-muted-foreground">
                          {t('createCache.overlay.formOption.description')}
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
                  <h1 className="text-2xl font-bold text-foreground">{t('createCache.title')}</h1>
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
                {t('createCache.description')}
              </p>
            </div>

            {/* Desktop Card Header */}
            <Card className="hidden md:block">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-foreground">{t('createCache.title')}</CardTitle>
                <CardDescription>
                  Create a new geocache for others to discover. Choose your difficulty and terrain ratings carefully -
                  they help seekers know what to expect and prepare appropriately.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Draft Notice */}
              {showDraftNotice && (
                <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950/20">
                  <AlertDescription className="flex items-center justify-between">
                    <span className="text-sm flex items-center gap-2">
                      <FileEdit className="h-4 w-4" />
                      Continuing your draft from where you left off.
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={startFresh}
                      className="ml-2"
                    >
                      Start Fresh
                    </Button>
                  </AlertDescription>
                </Alert>
              )}

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
                    <h3 className="text-lg font-semibold mb-1 text-foreground">{t('createCache.step1.title')}</h3>
                    <p className="text-sm text-gray-600 dark:text-muted-foreground">{t('createCache.step1.description')}</p>
                  </div>

                  <LocationPicker
                    value={location}
                    onChange={handleLocationChange}
                  />

                  {isVerifying && (
                    <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground bg-muted/50 dark:bg-muted rounded-lg p-3">
                      <CompassSpinner size={16} variant="component" />
                      {t('createCache.step1.checking')}
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
                      {t('createCache.step1.permissionWarning')}
                    </AlertDescription>
                  </Alert>
                </div>
              )}

              {currentStep === 2 && (
                <div className="space-y-4">
                  <div className="text-center mb-4">
                    <h3 className="text-lg font-semibold mb-1 text-foreground">{t('createCache.step2.title')}</h3>
                    <p className="text-sm text-gray-600 dark:text-muted-foreground">{t('createCache.step2.description')}</p>
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
                    <h3 className="text-lg font-semibold mb-1 text-foreground">{t('createCache.step3.title')}</h3>
                    <p className="text-sm text-gray-600 dark:text-muted-foreground">{t('createCache.step3.description')}</p>
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
                    <h3 className="text-lg font-semibold mb-1 text-foreground">{t('createCache.step4.title')}</h3>
                    <p className="text-sm text-gray-600 dark:text-muted-foreground">{t('createCache.step4.description')}</p>
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
                    <h4 className="text-sm font-medium text-muted-foreground mb-3">{t('createCache.preview.title')}</h4>
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
                    ← {t('common.previous')}
                  </Button>
                )}

                {currentStep < totalSteps ? (
                  <Button
                    type="button"
                    onClick={() => {
                      // Validate current step
                      if (currentStep === 1 && !location) {
                        toast({
                          title: t('createCache.stepValidation.locationRequired.title'),
                          description: t('createCache.stepValidation.locationRequired.description'),
                          variant: "destructive",
                        });
                        return;
                      }
                      if (currentStep === 1 && location && !locationVerification) {
                        toast({
                          title: t('createCache.locationVerification.title'),
                          description: t('createCache.locationVerification.description'),
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
                          title: t('createCache.stepValidation.fieldsRequired.title'),
                          description: t('createCache.stepValidation.fieldsRequired.description'),
                          variant: "destructive",
                        });
                        return;
                      }
                      setCurrentStep(currentStep + 1);
                    }}
                    className="flex-1"
                  >
                    {t('common.next')} →
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
                        {t('createCache.verifyingLocation')}
                      </>
                    ) : isPending ? (
                      t('createCache.creating')
                    ) : (
                      t('createCache.createButton')
                    )}
                  </Button>
                )}

                <Button type="button" variant="outline" onClick={() => navigate("/")}>
                  {t('common.cancel')}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

            {/* Mobile Form - no card wrapper */}
            <div className="md:hidden px-4 pb-4 bg-background">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Draft Notice */}
            {showDraftNotice && (
              <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950/20">
                <AlertDescription className="flex items-center justify-between">
                  <span className="text-sm flex items-center gap-2">
                    <FileEdit className="h-4 w-4" />
                    Continuing your draft.
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={startFresh}
                    className="ml-2"
                  >
                    Start Fresh
                  </Button>
                </AlertDescription>
              </Alert>
            )}

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
                  <h4 className="text-sm font-medium text-muted-foreground mb-3">{t('createCache.preview.title')}</h4>
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
                        title: t('createCache.locationVerification.title'),
                        description: t('createCache.locationVerification.description'),
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
                      {t('createCache.verifyingLocation')}
                    </>
                  ) : isPending ? (
                    t('createCache.creating')
                  ) : (
                    t('createCache.createButton')
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
            <AlertDialogTitle>{t('createCache.confirmLocation.title')}</AlertDialogTitle>
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
                            attribution={mapStyle?.attribution}
                            url={mapStyle?.url || ""}
                            maxZoom={19}
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
                        <div className="font-medium mb-2 text-foreground">{t('createCache.confirmLocation.confirmLabel')}</div>
                        <div className="space-y-1 text-xs text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <Check className="h-4 w-4 text-green-600" />
                            <span>{t('createCache.confirmLocation.permission')}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Check className="h-4 w-4 text-green-600" />
                            <span>{t('createCache.confirmLocation.accessible')}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Check className="h-4 w-4 text-green-600" />
                            <span>{t('createCache.confirmLocation.safe')}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Check className="h-4 w-4 text-green-600" />
                            <span>{t('createCache.confirmLocation.accurate')}</span>
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
            <AlertDialogCancel onClick={handleLocationReview}>{t('createCache.confirmLocation.review')}</AlertDialogCancel>
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
                  {t('createCache.confirmLocation.useDespiteWarnings')}
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4" />
                  {t('createCache.confirmLocation.useLocation')}
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
