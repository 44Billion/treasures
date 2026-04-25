import React, { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router-dom";
import { MapPin, AlertTriangle, CheckCircle, Check, FileEdit, MapPinned, FileText, Gauge, Camera, ChevronLeft, ChevronRight, Cloud, EyeOff } from "lucide-react";
import { CompassSpinner } from "@/components/ui/loading";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PageHero } from "@/components/PageHero";
import { DesktopHeader } from "@/components/DesktopHeader";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useCreateGeocache } from "@/hooks/useCreateGeocache";
import { LocationPicker } from "@/components/LocationPicker";
import { useToast } from "@/hooks/useToast";
import { verifyLocation, getVerificationSummary, type LocationVerification } from "@/utils/osmVerification";
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
} from "@/components/ui/geocache-form.fields";
import { DifficultyTerrainRating } from "@/components/ui/difficulty-terrain-rating";
import "leaflet/dist/leaflet.css";
import "@/styles/leaflet-overrides.css";
import { LoginRequiredCard } from "@/components/LoginRequiredCard";
import { nip19 } from "nostr-tools";
import { parseVerificationFromHash } from "@/utils/verification";
import { naddrToGeocache } from "@/utils/naddr-utils";
import { useTreasureDrafts, loadLocalDraft, saveLocalDraft, clearLocalDraft, type TreasureDraftPayload } from "@/hooks/useTreasureDrafts";
import { useQueryClient } from "@tanstack/react-query";

// Step configuration for progress indicator
const STEP_KEYS = ['createCache.steps.location', 'createCache.steps.details', 'createCache.steps.challenge', 'createCache.steps.finish'] as const;

const STEPS = [
  { number: 1, labelKey: STEP_KEYS[0], icon: MapPinned },
  { number: 2, labelKey: STEP_KEYS[1], icon: FileText },
  { number: 3, labelKey: STEP_KEYS[2], icon: Gauge },
  { number: 4, labelKey: STEP_KEYS[3], icon: Camera },
] as const;

const TOTAL_STEPS = STEPS.length;

export default function CreateCache() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useCurrentUser();

  const { mutateAsync: createGeocache, isPending } = useCreateGeocache();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // NIP-37 draft management
  const { saveDraft, deleteDraft, relayDrafts } = useTreasureDrafts();
  const isSavingDraft = saveDraft.isPending;

  // Check if we're loading a specific relay draft via ?draft=<slug>
  const draftSlugParam = searchParams.get('draft');
  const loadedRelayDraft = draftSlugParam && relayDrafts.data
    ? relayDrafts.data.find(d => d.slug === draftSlugParam)
    : null;

  // Load saved draft on mount (localStorage, or relay draft if specified)
  const localDraft = loadLocalDraft();
  const initialDraft = loadedRelayDraft || localDraft;
  const [editingDraftSlug, setEditingDraftSlug] = useState<string | null>(draftSlugParam);
  const [editingDraftEventId, setEditingDraftEventId] = useState<string | null>(loadedRelayDraft?.eventId ?? null);

  const [formData, setFormData] = useState<GeocacheFormData>(
    initialDraft?.formData || createDefaultGeocacheFormData(),
  );
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(
    initialDraft?.location || null,
  );
  const [images, setImages] = useState<string[]>(initialDraft?.images || []);
  const [currentStep, setCurrentStep] = useState(initialDraft?.currentStep || 1);
  const [locationVerification, setLocationVerification] = useState<LocationVerification | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  // Hydrate from relay draft once it loads (async)
  useEffect(() => {
    if (loadedRelayDraft && draftSlugParam) {
      setFormData(loadedRelayDraft.formData);
      setLocation(loadedRelayDraft.location);
      setImages(loadedRelayDraft.images);
      setCurrentStep(loadedRelayDraft.currentStep);
      setEditingDraftSlug(loadedRelayDraft.slug);
      setEditingDraftEventId(loadedRelayDraft.eventId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadedRelayDraft?.slug]);

  // Auto-save to localStorage whenever form data changes
  useEffect(() => {
    const defaults = createDefaultGeocacheFormData();
    const hasCustomFormData =
      formData.name !== defaults.name ||
      formData.description !== defaults.description ||
      formData.hint !== defaults.hint ||
      formData.contentWarning !== defaults.contentWarning;
    const hasCustomInfo = hasCustomFormData || location !== null || images.length > 0;

    if (!hasCustomInfo) {
      clearLocalDraft();
      return;
    }

    saveLocalDraft({ formData, location, images, currentStep });
  }, [formData, location, images, currentStep]);

  // Build the current draft payload (reused by save + publish cleanup)
  const currentPayload = useCallback((): TreasureDraftPayload => ({
    formData,
    location,
    images,
    currentStep,
  }), [formData, location, images, currentStep]);

  // Explicit "Save as Draft" — writes to both localStorage and relay, then navigates to profile
  const handleSaveDraft = useCallback(async () => {
    // Basic validation — need at least name + description + location
    if (!formData.name.trim() || !formData.description.trim() || !location) {
      toast({
        title: t('createCache.draft.incomplete'),
        description: t('createCache.draft.incompleteDescription'),
        variant: "destructive",
      });
      return;
    }

    try {
      const result = await saveDraft.mutateAsync({ payload: currentPayload(), slug: editingDraftSlug || undefined });
      // Remember the slug so subsequent saves overwrite the same draft
      setEditingDraftSlug(result.slug);
      clearLocalDraft();
      toast({
        title: t('createCache.draft.saved'),
        description: t('createCache.draft.savedDescription'),
      });
      navigate('/profile');
    } catch (err) {
      console.error('[CreateCache] Failed to save relay draft:', err);
      toast({
        title: t('createCache.draft.savedLocally'),
        description: t('createCache.draft.savedLocallyDescription'),
      });
    }
  }, [saveDraft, currentPayload, toast, navigate, formData, location, editingDraftSlug, t]);

  // Clear the local form draft (relay drafts are managed from the profile)
  const clearFormDraft = useCallback(() => {
    clearLocalDraft();
  }, []);

  const [importedDTag, setImportedDTag] = useState<string | null>(null);
  const [importedVerificationKeyPair, setImportedVerificationKeyPair] = useState<any>(null);
  const [importedKind, setImportedKind] = useState<number | null>(null);
  const hasDraft = !!localDraft;
  const [showDraftNotice, setShowDraftNotice] = useState(hasDraft);

  // Function to start fresh by clearing the draft
  const startFresh = () => {
    clearFormDraft();
    setFormData(createDefaultGeocacheFormData());
    setLocation(null);
    setImages([]);
    setCurrentStep(1);
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
    if (localDraft?.location && currentStep === 1) {
      handleLocationChange(localDraft.location);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
  };

  const handleCreateGeocache = async () => {
    // Basic guard — the wizard steps already enforce these, but check just in case
    if (!formData.name.trim() || !formData.description.trim() || !location) {
      toast({
        title: t('createCache.validation.locationRequired.title'),
        description: t('createCache.validation.completeAllFields'),
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

        clearFormDraft();

        // Delete the relay draft if we were editing one
        // Delete the relay draft if we were editing one
        if (editingDraftSlug && editingDraftEventId) {
          try {
            await deleteDraft.mutateAsync({ slug: editingDraftSlug, eventId: editingDraftEventId });
          } catch {
            // Best-effort — continue with navigation
          }
        }

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
      <>
        <DesktopHeader />
        <PageHero title={t('createCache.title')} description={t('createCache.subtitle')}>
          <div className="container mx-auto px-4 py-10 max-w-md">
            <LoginRequiredCard
              icon={MapPin}
              description={t('createCache.loginRequired')}
              className="max-w-md mx-auto"
            />
          </div>
        </PageHero>
      </>
    );
  }

  // Determine verification status for inline confirmation
  const verificationSummary = locationVerification ? getVerificationSummary(locationVerification) : null;
  const hasWarnings = verificationSummary?.status === 'restricted' || verificationSummary?.status === 'warning';

  const stepDescriptions = [
    t('createCache.step1.description'),
    t('createCache.step2.description'),
    t('createCache.step3.description'),
    t('createCache.step4.description'),
  ];

  return (
    <>
      <DesktopHeader />
      <PageHero title={editingDraftSlug ? <>Editing<br />{formData.name || 'Draft'}</> : t('createCache.title')} description={stepDescriptions[currentStep - 1]}>
        <div className="container mx-auto px-4 max-w-2xl pb-12">
          {/* Form - single responsive layout */}
          <div className="rounded-xl border bg-card p-5 md:p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Draft Notice */}
              {showDraftNotice && (
                <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950/20">
                  <AlertDescription className="flex items-center justify-between">
                    <span className="text-sm flex items-center gap-2">
                      <FileEdit className="h-4 w-4" />
                       {editingDraftSlug
                        ? t('createCache.draft.editingNotice')
                        : t('createCache.draft.continuingNotice')}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={startFresh}
                      className="ml-2"
                    >
                      {t('createCache.draft.startFresh')}
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
                          {t(step.labelKey)}
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

                  {/* What you'll need hint - only shown on first visit */}
                  {!hasDraft && !location && (
                    <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950/20">
                      <AlertDescription className="text-sm">
                        <span className="font-medium">{t('createCache.whatYouNeed')}</span> {t('createCache.whatYouNeedDescription')}
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

                  {/* Inline location status */}
                  {location && locationVerification && !isVerifying && (
                    <div className={`rounded-lg border p-4 ${
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
                          <span className="text-sm font-medium text-foreground">
                            {hasWarnings ? t('createCache.locationHasIssues') : t('createCache.locationLooksGood')}
                          </span>
                          <p className="text-xs text-muted-foreground">
                            {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
                          </p>

                          {/* Warning reasons */}
                          {hasWarnings && locationVerification.warnings.length > 0 && (
                            <ul className="text-xs text-yellow-800 dark:text-yellow-300 space-y-1">
                              {locationVerification.warnings.map((w, i) => (
                                <li key={i} className="flex items-start gap-1.5">
                                  <span className="mt-0.5 shrink-0">•</span>
                                  <span>{w.replace(/⚠️\s*/, '')}</span>
                                </li>
                              ))}
                            </ul>
                          )}

                          <p className="text-[11px] text-muted-foreground leading-snug pt-1">
                            {t('createCache.locationConfirmation')}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* === STEP 2: Cache Details + Type + Size === */}
              {currentStep === 2 && (
                <div className="space-y-4">

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
                    <p className="text-xs text-muted-foreground mb-3">{t('createCache.containerQuestion')}</p>
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
                    <h4 className="text-sm font-medium text-muted-foreground mb-3">{t('createCache.ratingPreview')}</h4>
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

                  <CacheImageManager
                    images={images}
                    onImagesChange={setImages}
                    disabled={isPending || isVerifying}
                  />

                  <ContentWarningField
                    value={formData.contentWarning || ""}
                    onChange={(value) => setFormData({...formData, contentWarning: value})}
                  />

                  {/* Full Preview Card */}
                  <div className="bg-muted/20 border border-muted rounded-lg p-4">
                    <h4 className="text-sm font-medium text-muted-foreground mb-3">{t('createCache.preview.title')}</h4>
                    <div className="space-y-3">
                      <h5 className="font-medium text-foreground text-lg">{formData.name || t('createCache.previewCacheName')}</h5>
                      <p className="text-sm text-muted-foreground">{formData.description || t('createCache.previewDescription')}</p>
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
              {currentStep < TOTAL_STEPS ? (
                <div className="flex gap-3 pt-4 pb-4 md:pb-0">
                  {currentStep > 1 && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setCurrentStep(currentStep - 1)}
                      className="flex-1"
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      {t('common.previous')}
                    </Button>
                  )}
                  <Button
                    type="button"
                    onClick={validateAndAdvance}
                    disabled={currentStep === 1 && (isVerifying || (!!location && !locationVerification))}
                    className="flex-1"
                  >
                    {currentStep === 1 && isVerifying ? (
                      <>
                        <CompassSpinner size={16} variant="button" className="mr-2" />
                        {t('createCache.checkingLocation')}
                      </>
                    ) : (
                      <>{t('common.next')} <ChevronRight className="h-4 w-4 ml-1" /></>
                    )}
                  </Button>
                </div>
              ) : (
                <div className="space-y-3 pt-4 pb-4 md:pb-0">
                  {/* Row 1: Previous + Draft */}
                  <div className="flex gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setCurrentStep(currentStep - 1)}
                      className="flex-1"
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      {t('common.previous')}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleSaveDraft}
                      disabled={isSavingDraft || isPending || isVerifying}
                      className="flex-1"
                    >
                      {isSavingDraft ? (
                        <>
                          <Cloud className="h-4 w-4 mr-1 animate-pulse" />
                          {t('common.saving')}
                        </>
                      ) : (
                        <>
                          <EyeOff className="h-4 w-4 mr-1" />
                          {t('createCache.draft.saveDraft')}
                        </>
                      )}
                    </Button>
                  </div>

                  {/* Row 2: Publish (full width, primary) */}
                  <Button
                    type="button"
                    onClick={handleCreateGeocache}
                    disabled={isPending || isVerifying}
                    className="w-full"
                  >
                    {isVerifying ? (
                      <>
                        <CompassSpinner size={16} variant="button" className="mr-2" />
                        {t('createCache.verifyingLocation')}
                      </>
                    ) : isPending ? (
                      t('createCache.creating')
                    ) : (
                      <><Check className="h-4 w-4 mr-1" /> {t('createCache.createButton')}</>
                    )}
                  </Button>
                </div>
              )}
            </form>
          </div>
        </div>
      </PageHero>
    </>
  );
}
