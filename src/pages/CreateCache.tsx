import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router-dom";
import { MapPin, AlertTriangle, CheckCircle, Check, QrCode, FileEdit, MapPinned, FileText, Gauge, Camera } from "lucide-react";
import { CompassSpinner } from "@/components/ui/loading";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PageLayout } from "@/components/PageLayout";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useCreateGeocache } from "@/hooks/useCreateGeocache";
import { LocationPicker } from "@/components/LocationPicker";
import { useToast } from "@/hooks/useToast";
import { verifyLocation, getVerificationSummary, type LocationVerification } from "@/utils/osmVerification";
import { LocationWarnings } from "@/components/LocationWarnings";
import { createDefaultGeocacheFormData } from "@/components/ui/geocache-form.utils";
import type { GeocacheFormData } from "@/components/ui/geocache-form.types";
import {
  CacheNameField,
  CacheDescriptionField,
  CacheHintField,
  ContentWarningField,
  CacheDifficultyField,
  CacheTerrainField,
  CacheTypeField,
  CacheSizeField,
  CacheImageManager,
  CacheHiddenField
} from "@/components/ui/geocache-form.fields";
import { DifficultyTerrainRating } from "@/components/ui/difficulty-terrain-rating";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

import "leaflet/dist/leaflet.css";
import { LoginRequiredCard } from "@/components/LoginRequiredCard";
import { nip19 } from "nostr-tools";
import { parseVerificationFromHash } from "@/utils/verification";
import { naddrToGeocache } from "@/utils/naddr-utils";

// Step configuration for progress indicator
const STEPS = [
  { number: 1, label: "Location", icon: MapPinned },
  { number: 2, label: "Details", icon: FileText },
  { number: 3, label: "Challenge", icon: Gauge },
  { number: 4, label: "Finish", icon: Camera },
] as const;

const TOTAL_STEPS = STEPS.length;

export default function CreateCache() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useCurrentUser();

  const { mutateAsync: createGeocache, isPending } = useCreateGeocache();
  const { toast } = useToast();

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
  const [currentStep, setCurrentStep] = useState(draft?.currentStep || 1);
  const [locationVerification, setLocationVerification] = useState<LocationVerification | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [locationConfirmed, setLocationConfirmed] = useState(false);

  // Save draft to localStorage whenever form data changes
  useEffect(() => {
    const draftData = {
      formData,
      location,
      images,
      currentStep,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(draftData));
  }, [formData, location, images, currentStep]);

  // Clear draft when successfully creating geocache
  const clearDraft = () => {
    localStorage.removeItem(STORAGE_KEY);
  };

  const [importedDTag, setImportedDTag] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [importedVerificationKeyPair, setImportedVerificationKeyPair] = useState<any>(null);
  const [importedKind, setImportedKind] = useState<number | null>(null);
  const [showDraftNotice, setShowDraftNotice] = useState(!!draft);

  // Function to start fresh by clearing the draft
  const startFresh = () => {
    clearDraft();
    setFormData(createDefaultGeocacheFormData());
    setLocation(null);
    setImages([]);
    setCurrentStep(1);
    setLocationConfirmed(false);
    setLocationVerification(null);
    setShowDraftNotice(false);
  };

  // Check for claim URL in params (from pre-generated QR code)
  useEffect(() => {
    const processClaimUrl = async () => {
      const claimUrlParam = searchParams.get('claimUrl');

      // Guard against processing the same claim URL multiple times
      if (!claimUrlParam || !user || importedDTag || importedVerificationKeyPair) {
        return;
      }

      try {
        // Handle both full URLs and relative URLs
        let claimUrl: URL;
        if (claimUrlParam.startsWith('http')) {
          claimUrl = new URL(claimUrlParam);
        } else {
          claimUrl = new URL(claimUrlParam, window.location.origin);
        }

        // Extract naddr from pathname
        const pathname = claimUrl.pathname;
        let naddr = pathname;
        if (pathname.startsWith('/')) {
          naddr = pathname.slice(1);
        }

        // If the naddr starts with the origin, remove it
        if (naddr.startsWith(claimUrl.origin)) {
          naddr = naddr.slice(claimUrl.origin.length);
          if (naddr.startsWith('/')) {
            naddr = naddr.slice(1);
          }
        }

        // Extract nsec from hash
        const nsec = parseVerificationFromHash(claimUrl.hash);

        if (naddr && nsec) {
          try {
            const decodedNaddr = naddrToGeocache(naddr);

            if (decodedNaddr.pubkey === user.pubkey) {
              // Decode the nsec to get the private key bytes
              const { data: privateKeyBytes } = nip19.decode(nsec);

              // Import the private key and derive the public key
              const { getPublicKey } = await import('nostr-tools');
              const publicKeyHex = getPublicKey(privateKeyBytes as Uint8Array);

              // Store the complete, valid keypair
              setImportedVerificationKeyPair({
                nsec: nsec,
                privateKey: privateKeyBytes,
                publicKey: publicKeyHex,
                npub: nip19.npubEncode(publicKeyHex),
              });

              setImportedDTag(decodedNaddr.identifier);
              setImportedKind(decodedNaddr.kind);

              toast({
                title: t('createCache.claimUrl.imported.title'),
                description: t('createCache.claimUrl.imported.description'),
              });
            } else {
              toast({
                title: t('createCache.claimUrl.invalid.title'),
                description: t('createCache.claimUrl.invalid.wrongAccount'),
                variant: "destructive",
              });
            }
          } catch (decodeError) {
            console.error('Failed to decode naddr:', naddr, decodeError);
            toast({
              title: t('createCache.claimUrl.invalid.title'),
              description: t('createCache.claimUrl.invalid.decodeFailed'),
              variant: "destructive",
            });
          }
        } else {
          toast({
            title: t('createCache.claimUrl.invalid.title'),
            description: t('createCache.claimUrl.invalid.missingInfo'),
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error('Failed to parse claim URL:', error);
        toast({
          title: t('createCache.claimUrl.invalid.title'),
          description: t('createCache.claimUrl.invalid.notValid'),
          variant: "destructive",
        });
      }
    };

    processClaimUrl();
  }, [searchParams, user, importedDTag, importedVerificationKeyPair, toast, t]);

  // Handle location verification when location changes
  const handleLocationChange = async (newLocation: { lat: number; lng: number } | null) => {
    setLocation(newLocation);
    setLocationConfirmed(false); // Reset confirmation when location changes

    if (newLocation && currentStep === 1) {
      setIsVerifying(true);
      try {
        const verification = await verifyLocation(newLocation.lat, newLocation.lng);
        setLocationVerification(verification);
      } catch {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
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
      const result = await createGeocache({
        ...formData,
        location,
        images,
        difficulty: parseInt(formData.difficulty),
        terrain: parseInt(formData.terrain),
        dTag: importedDTag || undefined,
        verificationKeyPair: importedVerificationKeyPair || undefined,
        kind: importedKind || undefined,
      });

      const { event, geocache } = result;

      // Generate naddr for the created cache
      const dTag = event.tags.find((tag: string[]) => tag[0] === 'd')?.[1];

      if (dTag && geocache) {
        const relays = event.tags.filter((tag: string[]) => tag[0] === 'relay').map((tag: string[]) => tag[1]);
        const { geocacheToNaddr } = await import('@/utils/naddr-utils');

        const includeRelays = !importedDTag;
        const naddr = geocacheToNaddr(event.pubkey, dTag, relays as string[], event.kind, includeRelays);

        toast({
          title: t('createCache.publish.success.title'),
          description: t('createCache.publish.success.redirecting'),
        });

        clearDraft();

        navigate(`/${naddr}`, {
          state: {
            geocacheData: geocache,
            justCreated: true
          }
        });
      } else {
        toast({
          title: t('createCache.publish.success.title'),
          description: t('createCache.publish.success.noLink'),
        });
        navigate('/');
      }
    } catch (error) {
      console.error('Failed to create geocache:', error);
      toast({
        title: t('createCache.publish.failed.title'),
        description: error instanceof Error ? error.message : t('createCache.publish.failed.unknown'),
        variant: "destructive",
      });
    }
  };

  // Step validation logic
  const validateAndAdvance = () => {
    if (currentStep === 1) {
      if (!location) {
        toast({
          title: t('createCache.stepValidation.locationRequired.title'),
          description: t('createCache.stepValidation.locationRequired.description'),
          variant: "destructive",
        });
        return;
      }
      if (!locationVerification) {
        toast({
          title: t('createCache.locationVerification.title'),
          description: t('createCache.locationVerification.description'),
          variant: "default",
        });
        return;
      }
      if (!locationConfirmed) {
        toast({
          title: "Please confirm the location",
          description: "Check the box to confirm the location is appropriate before continuing.",
          variant: "destructive",
        });
        return;
      }
      // Check for restricted location warning
      const summary = getVerificationSummary(locationVerification);
      if (summary.status === 'restricted' && !locationConfirmed) {
        toast({
          title: "Location has restrictions",
          description: "Please review and confirm the location despite warnings.",
          variant: "destructive",
        });
        return;
      }
      setCurrentStep(2);
      return;
    }

    if (currentStep === 2) {
      if (!formData.name.trim() || !formData.description.trim()) {
        toast({
          title: t('createCache.stepValidation.fieldsRequired.title'),
          description: t('createCache.stepValidation.fieldsRequired.description'),
          variant: "destructive",
        });
        return;
      }
      setCurrentStep(3);
      return;
    }

    if (currentStep === 3) {
      setCurrentStep(4);
      return;
    }
  };

  // Login gate
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

  // Determine verification status for inline confirmation
  const verificationSummary = locationVerification ? getVerificationSummary(locationVerification) : null;
  const hasWarnings = verificationSummary?.status === 'restricted';

  return (
    <PageLayout maxWidth="2xl" background="default" className="pb-4 md:pb-0">
      <div className="max-w-2xl mx-auto create-cache-container">
        {/* Header */}
        <div className="px-4 py-6 md:px-0">
          <div className="flex items-start justify-between mb-2">
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-foreground">{t('createCache.title')}</h1>
            </div>
            <div className="flex gap-2 ml-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/generate-qr')}
                title="Generate QR Codes"
              >
                <QrCode className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            {t('createCache.description')}
          </p>
        </div>

        {/* Form - single responsive layout */}
        <div className="md:rounded-lg md:border md:bg-card md:shadow-sm">
          <div className="px-4 md:p-6">
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

              {/* Progress Indicator with Labels */}
              <div className="flex items-center justify-center mb-4 px-2 overflow-hidden create-cache-progress">
                <div className="flex items-center w-full max-w-md min-w-0">
                  {STEPS.map((step, index) => (
                    <React.Fragment key={step.number}>
                      <div className="flex flex-col items-center shrink-0">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                          step.number < currentStep ? 'bg-primary text-primary-foreground' :
                          step.number === currentStep ? 'bg-primary text-primary-foreground' :
                          'bg-secondary text-muted-foreground'
                        }`}>
                          {step.number < currentStep ? (
                            <Check className="h-4 w-4" />
                          ) : (
                            <step.icon className="h-4 w-4" />
                          )}
                        </div>
                        {/* Show label for current step always, others on md+ */}
                        <span className={`text-[10px] mt-1 font-medium whitespace-nowrap ${
                          step.number === currentStep
                            ? 'text-primary'
                            : step.number < currentStep
                              ? 'text-primary/70 hidden md:block'
                              : 'text-muted-foreground hidden md:block'
                        }`}>
                          {step.label}
                        </span>
                      </div>
                      {index < TOTAL_STEPS - 1 && (
                        <div className={`h-0.5 mx-1 sm:mx-2 flex-1 min-w-[1rem] mb-4 md:mb-5 ${
                          step.number < currentStep ? 'bg-primary' : 'bg-secondary'
                        }`} />
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </div>

              {/* === STEP 1: Choose Location === */}
              {currentStep === 1 && (
                <div className="space-y-4">
                  <div className="text-center mb-4">
                    <h3 className="text-lg font-semibold mb-1 text-foreground">{t('createCache.step1.title')}</h3>
                    <p className="text-sm text-muted-foreground">{t('createCache.step1.description')}</p>
                  </div>

                  {/* What you'll need hint - only shown on first visit */}
                  {!draft && !location && (
                    <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950/20">
                      <AlertDescription className="text-sm">
                        <span className="font-medium">What you&apos;ll need:</span> A GPS location where you&apos;ve placed (or plan to place) your cache, a name and description, and optionally some photos of the area.
                      </AlertDescription>
                    </Alert>
                  )}

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
                      hideCreatorWarnings={false}
                    />
                  )}

                  {/* Inline location confirmation (replaces AlertDialog) */}
                  {location && locationVerification && !isVerifying && (
                    <div className={`rounded-lg border p-4 space-y-3 ${
                      hasWarnings
                        ? 'border-yellow-300 bg-yellow-50 dark:bg-yellow-950/20'
                        : 'border-green-200 bg-green-50 dark:bg-green-950/20'
                    }`}>
                      <div className="flex items-start gap-3">
                        {hasWarnings ? (
                          <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 shrink-0 mt-0.5" />
                        ) : (
                          <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
                        )}
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-foreground">
                              {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
                            </span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id="location-confirm"
                              checked={locationConfirmed}
                              onCheckedChange={(checked) => setLocationConfirmed(checked === true)}
                            />
                            <Label htmlFor="location-confirm" className="text-sm cursor-pointer text-foreground leading-snug">
                              {hasWarnings
                                ? "I acknowledge the warnings and confirm this location is appropriate, publicly accessible, and safe for seekers."
                                : "I confirm this location has permission, is publicly accessible, and is safe for seekers."
                              }
                            </Label>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* === STEP 2: Cache Details + Type + Size === */}
              {currentStep === 2 && (
                <div className="space-y-4">
                  <div className="text-center mb-4">
                    <h3 className="text-lg font-semibold mb-1 text-foreground">{t('createCache.step2.title')}</h3>
                    <p className="text-sm text-muted-foreground">{t('createCache.step2.description')}</p>
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

                  {/* Divider */}
                  <div className="border-t pt-4">
                    <p className="text-xs text-muted-foreground mb-3">What kind of container are seekers looking for?</p>
                  </div>

                  <CacheTypeField
                    fieldId="cache-type"
                    value={formData.type}
                    onChange={(value) => setFormData({...formData, type: value})}
                  />

                  <CacheSizeField
                    fieldId="cache-size"
                    value={formData.size}
                    onChange={(value) => setFormData({...formData, size: value})}
                  />
                </div>
              )}

              {/* === STEP 3: Difficulty + Terrain === */}
              {currentStep === 3 && (
                <div className="space-y-4">
                  <div className="text-center mb-4">
                    <h3 className="text-lg font-semibold mb-1 text-foreground">{t('createCache.step3.title')}</h3>
                    <p className="text-sm text-muted-foreground">{t('createCache.step3.description')}</p>
                  </div>

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

                  {/* Live rating preview */}
                  <div className="bg-muted/20 border border-muted rounded-lg p-4">
                    <h4 className="text-sm font-medium text-muted-foreground mb-3">How this will appear to seekers</h4>
                    <DifficultyTerrainRating
                      difficulty={parseInt(formData.difficulty) || 1}
                      terrain={parseInt(formData.terrain) || 1}
                      cacheSize={formData.size}
                      showLabels={true}
                      size="default"
                    />
                  </div>
                </div>
              )}

              {/* === STEP 4: Photos & Final Touches === */}
              {currentStep === 4 && (
                <div className="space-y-4">
                  <div className="text-center mb-4">
                    <h3 className="text-lg font-semibold mb-1 text-foreground">{t('createCache.step4.title')}</h3>
                    <p className="text-sm text-muted-foreground">{t('createCache.step4.description')}</p>
                  </div>

                  <CacheImageManager
                    images={images}
                    onImagesChange={setImages}
                    disabled={isPending || isVerifying}
                  />

                  <ContentWarningField
                    value={formData.contentWarning || ""}
                    onChange={(value) => setFormData({...formData, contentWarning: value})}
                  />

                  <CacheHiddenField
                    checked={formData.hidden || false}
                    onChange={(checked) => setFormData({...formData, hidden: checked})}
                  />

                  {/* Full Preview Card */}
                  <div className="bg-muted/20 border border-muted rounded-lg p-4">
                    <h4 className="text-sm font-medium text-muted-foreground mb-3">{t('createCache.preview.title')}</h4>
                    <div className="space-y-3">
                      <h5 className="font-medium text-foreground text-lg">{formData.name || "Your Cache Name"}</h5>
                      <p className="text-sm text-muted-foreground">{formData.description || "Your description..."}</p>
                      {images.length > 0 && (
                        <div className="flex gap-2 flex-wrap">
                          {images.filter(url => url).map((url, index) => (
                            <img
                              key={index}
                              src={url}
                              alt={`Preview ${index + 1}`}
                              className="h-16 w-16 rounded object-cover border"
                            />
                          ))}
                        </div>
                      )}
                      <DifficultyTerrainRating
                        difficulty={parseInt(formData.difficulty) || 1}
                        terrain={parseInt(formData.terrain) || 1}
                        cacheSize={formData.size}
                        showLabels={true}
                        size="small"
                      />
                      {formData.hint && (
                        <p className="text-xs text-muted-foreground italic">Hint: {formData.hint}</p>
                      )}
                      {location && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Navigation Buttons */}
              <div className="flex gap-3 pt-4 pb-4 md:pb-0">
                {currentStep > 1 && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setCurrentStep(currentStep - 1)}
                    className="flex-1"
                  >
                    &larr; {t('common.previous')}
                  </Button>
                )}

                {currentStep < TOTAL_STEPS ? (
                  <Button
                    type="button"
                    onClick={validateAndAdvance}
                    className="flex-1"
                  >
                    {t('common.next')} &rarr;
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
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
