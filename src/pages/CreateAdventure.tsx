import React, { useState, useMemo, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { createPortal } from "react-dom";
import { MapPinned, FileText, ListChecks, Eye, Check, ChevronLeft, ChevronRight, X, MapPin, Compass, Image as ImageIcon, Sword, Map, Moon, Satellite } from "lucide-react";
import { nip19 } from "nostr-tools";
import L from "leaflet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { PageHero } from "@/components/PageHero";
import { DesktopHeader } from "@/components/DesktopHeader";
import { LoginRequiredCard } from "@/components/LoginRequiredCard";
import { PageLoading } from "@/components/ui/loading";
import { GeocacheMap } from "@/components/GeocacheMap";
import { GeocachePopupCard } from "@/components/GeocachePopupCard";
import { OmniSearch } from "@/components/OmniSearch";
import { CompactGeocacheCard } from "@/components/ui/geocache-card";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useGeocaches } from "@/hooks/useGeocaches";
import { useAdventure } from "@/hooks/useAdventure";
import { useCreateAdventure } from "@/hooks/useCreateAdventure";
import { useUploadFile } from "@/hooks/useUploadFile";
import { useToast } from "@/hooks/useToast";
import { NIP_GC_KINDS } from "@/utils/nip-gc";
import { calculateDistance } from "@/utils/geo";
import type { Geocache } from "@/types/geocache";
import type { AdventureTheme, AdventureMapStyle } from "@/types/adventure";

// Step configuration — mirrors CreateCache pattern
const STEPS = [
  { number: 1, label: "Details", icon: FileText },
  { number: 2, label: "Location", icon: MapPinned },
  { number: 3, label: "Treasures", icon: ListChecks },
  { number: 4, label: "Review", icon: Eye },
] as const;

const TOTAL_STEPS = STEPS.length;

const DEFAULT_RADIUS_KM = 5;
const MAX_RADIUS_KM = 100;

export default function CreateAdventure() {
  const navigate = useNavigate();
  const { naddr } = useParams<{ naddr: string }>();
  const isEditMode = !!naddr;

  const { user } = useCurrentUser();
  const { data: allGeocaches } = useGeocaches();
  const { data: existingAdventure, isLoading: isLoadingAdventure } = useAdventure(naddr || '');
  const { mutateAsync: createAdventure, isPending } = useCreateAdventure();
  const { mutateAsync: uploadFile, isPending: isUploading } = useUploadFile();
  const { toast } = useToast();

  const [currentStep, setCurrentStep] = useState(1);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [summary, setSummary] = useState('');
  const [image, setImage] = useState('');
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [radiusKm, setRadiusKm] = useState(DEFAULT_RADIUS_KM);
  const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set());
  const [adventureTheme, setAdventureTheme] = useState<AdventureTheme | undefined>(undefined);
  const [adventureMapStyle, setAdventureMapStyle] = useState<AdventureMapStyle | undefined>(undefined);
  // In edit mode, manually included geocache IDs (from the existing adventure)
  const [manuallyIncludedIds, setManuallyIncludedIds] = useState<Set<string>>(new Set());
  const [selectedPopupGeocache, setSelectedPopupGeocache] = useState<Geocache | null>(null);
  const [popupContainer, setPopupContainer] = useState<HTMLDivElement | null>(null);
  const [hasPrePopulated, setHasPrePopulated] = useState(false);

  const mapRef = useRef<L.Map | null>(null);

  // Pre-populate form when editing an existing adventure
  useEffect(() => {
    if (!isEditMode || !existingAdventure || hasPrePopulated) return;

    setTitle(existingAdventure.title);
    setDescription(existingAdventure.description);
    setSummary(existingAdventure.summary || '');
    setImage(existingAdventure.image || '');
    setLocation(existingAdventure.location || null);
    setAdventureTheme(existingAdventure.theme);
    setAdventureMapStyle(existingAdventure.mapStyle);

    // Mark existing geocaches as manually included
    if (existingAdventure.geocaches) {
      setManuallyIncludedIds(new Set(existingAdventure.geocaches.map(g => g.id)));
    }

    setHasPrePopulated(true);
  }, [isEditMode, existingAdventure, hasPrePopulated]);

  const handleMarkerClick = (geocache: Geocache, container?: HTMLDivElement) => {
    if (!geocache && !container) {
      setSelectedPopupGeocache(null);
      setPopupContainer(null);
      return;
    }
    setSelectedPopupGeocache(geocache);
    setPopupContainer(container || null);
  };

  const handleLocationSearch = (loc: { lat: number; lng: number; name: string }) => {
    setLocation({ lat: loc.lat, lng: loc.lng });
  };

  // Treasures within the radius — client-side distance filter
  const treasuresInRadius = useMemo(() => {
    if (!location || !allGeocaches) return [];
    return allGeocaches
      .map(cache => ({
        ...cache,
        distance: calculateDistance(location.lat, location.lng, cache.location.lat, cache.location.lng),
      }))
      .filter(cache => cache.distance <= radiusKm)
      .sort((a, b) => a.distance - b.distance);
  }, [location, allGeocaches, radiusKm]);

  // In edit mode, resolve manually included geocaches from existing adventure data
  const manuallyIncludedCaches = useMemo(() => {
    if (!isEditMode || manuallyIncludedIds.size === 0) return [];
    // Pull from existing adventure geocaches (already resolved) or from allGeocaches
    const caches: Geocache[] = [];
    const radiusIds = new Set(treasuresInRadius.map(c => c.id));
    for (const id of manuallyIncludedIds) {
      // Skip if already in radius results (avoid duplicates)
      if (radiusIds.has(id)) continue;
      const fromAdventure = existingAdventure?.geocaches?.find(g => g.id === id);
      const fromAll = allGeocaches?.find(g => g.id === id);
      const cache = fromAdventure || fromAll;
      if (cache) caches.push(cache);
    }
    return caches;
  }, [isEditMode, manuallyIncludedIds, treasuresInRadius, existingAdventure, allGeocaches]);

  // Combine radius-based and manually included caches, minus exclusions
  const allAvailableCaches = useMemo(() => {
    const combined = [...treasuresInRadius, ...manuallyIncludedCaches];
    // Deduplicate by id
    const seen = new Set<string>();
    return combined.filter(c => {
      if (seen.has(c.id)) return false;
      seen.add(c.id);
      return true;
    });
  }, [treasuresInRadius, manuallyIncludedCaches]);

  // Derive the selected treasures from all available minus exclusions
  const selectedCaches = useMemo(
    () => allAvailableCaches.filter(c => !excludedIds.has(c.id)),
    [allAvailableCaches, excludedIds]
  );

  const handleToggleCache = (cacheId: string) => {
    setExcludedIds(prev => {
      const next = new Set(prev);
      if (next.has(cacheId)) {
        next.delete(cacheId);
      } else {
        next.add(cacheId);
      }
      return next;
    });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const tags = await uploadFile(file);
      const url = tags[0]?.[1];
      if (url) {
        setImage(url);
      }
    } catch {
      toast({
        title: "Upload failed",
        description: "Could not upload image. Please try again.",
        variant: "destructive",
      });
    }
  };



  // Step validation & advance
  const validateAndAdvance = () => {
    if (currentStep === 1) {
      if (!title.trim()) {
        toast({
          title: "Title required",
          description: "Give your adventure a name before continuing.",
          variant: "destructive",
        });
        return;
      }
      setCurrentStep(2);
      return;
    }

    if (currentStep === 2) {
      if (!location) {
        toast({
          title: "Location required",
          description: "Drop a pin on the map to set the adventure center.",
          variant: "destructive",
        });
        return;
      }
      if (allAvailableCaches.length === 0) {
        toast({
          title: "No treasures found",
          description: "Try increasing the radius or choosing a different location.",
          variant: "destructive",
        });
        return;
      }
      setCurrentStep(3);
      return;
    }

    if (currentStep === 3) {
      if (selectedCaches.length === 0) {
        toast({
          title: "Treasures required",
          description: "Keep at least one treasure in your adventure.",
          variant: "destructive",
        });
        return;
      }
      setCurrentStep(4);
      return;
    }
  };

  const handlePublish = async () => {
    if (!user || !location) return;

    try {
      const geocacheRefs = selectedCaches.map(cache => {
        const kind = cache.kind || NIP_GC_KINDS.GEOCACHE;
        return `${kind}:${cache.pubkey}:${cache.dTag}`;
      });

      const adventureData = {
        title: title.trim(),
        description: description.trim(),
        summary: summary.trim() || undefined,
        image: image || undefined,
        location,
        theme: adventureTheme,
        mapStyle: adventureMapStyle,
        geocacheRefs,
        // In edit mode, include the existing dTag so the event replaces the original
        ...(isEditMode && existingAdventure ? { dTag: existingAdventure.dTag } : {}),
      };

      const event = await createAdventure(adventureData);

      const resultNaddr = nip19.naddrEncode({
        kind: NIP_GC_KINDS.ADVENTURE,
        pubkey: event.pubkey,
        identifier: event.tags.find(t => t[0] === 'd')?.[1] || '',
      });

      toast({
        title: isEditMode ? "Adventure updated!" : "Adventure published!",
        description: isEditMode ? "Redirecting to your adventure..." : "Redirecting to your adventure...",
      });

      navigate(`/adventure/${resultNaddr}`);
    } catch (error) {
      const errorObj = error as { message?: string };
      toast({
        title: "Failed to publish",
        description: errorObj.message || "Something went wrong. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Login gate
  if (!user) {
    return (
      <>
        <DesktopHeader />
        <PageHero icon={Compass} title={isEditMode ? "Edit Adventure" : "Create Adventure"} description={isEditMode ? "Update your adventure." : "Curate a treasure hunt for the community."}>
          <div className="container mx-auto px-4 py-10 max-w-md">
            <LoginRequiredCard
              icon={Compass}
              description={isEditMode ? "Please log in with Nostr to edit this adventure." : "Please log in with Nostr to create an adventure."}
              className="max-w-md mx-auto"
            />
          </div>
        </PageHero>
      </>
    );
  }

  // Loading state for edit mode
  if (isEditMode && isLoadingAdventure) {
    return (
      <>
        <DesktopHeader />
        <div className="flex items-center justify-center min-h-[60vh]">
          <PageLoading title="Loading adventure..." size="lg" />
        </div>
      </>
    );
  }

  // Not found / not owner in edit mode
  if (isEditMode && existingAdventure && existingAdventure.pubkey !== user.pubkey) {
    return (
      <>
        <DesktopHeader />
        <PageHero icon={Compass} title="Edit Adventure" description="You can only edit your own adventures.">
          <div className="container mx-auto px-4 py-10 max-w-md">
            <div className="text-center space-y-4">
              <p className="text-muted-foreground">This adventure belongs to another user.</p>
              <Button asChild variant="outline">
                <a href={`/adventure/${naddr}`}>View Adventure</a>
              </Button>
            </div>
          </div>
        </PageHero>
      </>
    );
  }

  if (isEditMode && !isLoadingAdventure && !existingAdventure) {
    return (
      <>
        <DesktopHeader />
        <PageHero icon={Compass} title="Edit Adventure" description="Adventure not found.">
          <div className="container mx-auto px-4 py-10 max-w-md">
            <div className="text-center space-y-4">
              <p className="text-muted-foreground">This adventure may have been removed or the link is invalid.</p>
              <Button asChild variant="outline">
                <a href="/adventures">Browse Adventures</a>
              </Button>
            </div>
          </div>
        </PageHero>
      </>
    );
  }

  const stepDescriptions = [
    "Name your adventure and add a description.",
    "Set the center and radius to find nearby treasures.",
    "Review the treasures included in your adventure.",
    isEditMode ? "Review everything and save." : "Review everything and publish.",
  ];

  return (
    <>
      <DesktopHeader />
      <PageHero icon={Compass} title={isEditMode ? "Edit Adventure" : "Create Adventure"} description={stepDescriptions[currentStep - 1]}>
        <div className="container mx-auto px-4 max-w-2xl pb-12">
          <div className="rounded-xl border bg-card p-5 md:p-6">
            <form onSubmit={(e) => e.preventDefault()} className="space-y-6">

              {/* Progress Indicator */}
              <div className="flex items-center justify-center mb-4 px-2 overflow-hidden">
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

              {/* === STEP 1: Details === */}
              {currentStep === 1 && (
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="adventure-title">Title *</Label>
                    <Input
                      id="adventure-title"
                      value={title}
                      onChange={e => setTitle(e.target.value)}
                      placeholder="Texas Ren Fest Treasure Hunt"
                      maxLength={100}
                    />
                  </div>

                  <div>
                    <Label htmlFor="adventure-summary">Short Summary</Label>
                    <Input
                      id="adventure-summary"
                      value={summary}
                      onChange={e => setSummary(e.target.value)}
                      placeholder="Find all the hidden treasures at the festival!"
                      maxLength={200}
                    />
                    <p className="text-xs text-muted-foreground mt-1">Shown on cards in the browse page.</p>
                  </div>

                  <div>
                    <Label htmlFor="adventure-description">Full Description</Label>
                    <Textarea
                      id="adventure-description"
                      value={description}
                      onChange={e => setDescription(e.target.value)}
                      placeholder="Describe the adventure — rules, tips, what to expect..."
                      rows={5}
                    />
                  </div>

                  <div>
                    <Label>Banner Image</Label>
                    {image ? (
                      <div className="relative mt-2">
                        <img src={image} alt="Banner preview" className="w-full aspect-[2/1] object-cover rounded-lg border" />
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          className="absolute top-2 right-2 h-7 w-7"
                          onClick={() => setImage('')}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <label className="mt-2 flex flex-col items-center justify-center w-full aspect-[3/1] border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                        <div className="flex flex-col items-center gap-2 text-muted-foreground">
                          {isUploading ? (
                            <span className="text-sm">Uploading...</span>
                          ) : (
                            <>
                              <ImageIcon className="h-8 w-8" />
                              <span className="text-sm">Click to upload</span>
                            </>
                          )}
                        </div>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleImageUpload}
                          disabled={isUploading}
                        />
                      </label>
                    )}
                  </div>

                  {/* Theme selector */}
                  <div>
                    <Label>Page Theme</Label>
                    <p className="text-xs text-muted-foreground mb-2">Default theme shown to visitors (won't override their preference).</p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setAdventureTheme(undefined)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors ${
                          !adventureTheme ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-muted/50'
                        }`}
                      >
                        None
                      </button>
                      <button
                        type="button"
                        onClick={() => setAdventureTheme('adventure')}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors ${
                          adventureTheme === 'adventure' ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-muted/50'
                        }`}
                      >
                        <Sword className="h-4 w-4" />
                        Adventure
                      </button>
                    </div>
                  </div>

                  {/* Map style selector */}
                  <div>
                    <Label>Map Style</Label>
                    <p className="text-xs text-muted-foreground mb-2">Default map style for the adventure page.</p>
                    <div className="flex flex-wrap gap-2">
                      {([
                        { key: undefined, label: 'Default', icon: null },
                        { key: 'original' as const, label: 'Original', icon: Map },
                        { key: 'dark' as const, label: 'Dark', icon: Moon },
                        { key: 'satellite' as const, label: 'Satellite', icon: Satellite },
                        { key: 'adventure' as const, label: 'Quest', icon: Sword },
                      ] as const).map(({ key, label, icon: Icon }) => (
                        <button
                          key={label}
                          type="button"
                          onClick={() => setAdventureMapStyle(key)}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors ${
                            adventureMapStyle === key ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-muted/50'
                          }`}
                        >
                          {Icon && <Icon className="h-4 w-4" />}
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* === STEP 2: Location + Radius === */}
              {currentStep === 2 && (
                <div className="space-y-4">
                  {/* Location search */}
                  <OmniSearch
                    onLocationSelect={handleLocationSearch}
                    onGeocacheSelect={() => {}}
                    onTextSearch={() => {}}
                    geocaches={[]}
                    placeholder="Search for a location..."
                    mobilePlaceholder="Search location..."
                  />

                  <p className="text-sm text-muted-foreground text-center">
                    {location ? 'Tap the map to move the center' : 'Search above or tap the map to set the center'}
                  </p>

                  <div className="h-96 rounded-lg overflow-hidden border">
                    <GeocacheMap
                      geocaches={treasuresInRadius}
                      center={location || undefined}
                      zoom={location ? (radiusKm <= 5 ? 13 : radiusKm <= 25 ? 11 : 9) : 3}
                      userLocation={null}
                      searchLocation={location}
                      searchRadius={radiusKm}
                      onMarkerClick={handleMarkerClick}
                      onSearchInView={undefined}
                      showStyleSelector={true}
                      isNearMeActive={false}
                      mapRef={mapRef}
                      isMapCenterLocked={false}
                      onMapClick={setLocation}
                    />
                  </div>

                  {/* Radius slider */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Radius</Label>
                      <span className="text-sm font-medium text-primary">{radiusKm} km</span>
                    </div>
                    <Slider
                      min={1}
                      max={MAX_RADIUS_KM}
                      step={1}
                      value={[radiusKm]}
                      onValueChange={([v]) => { if (v !== undefined) setRadiusKm(v); }}
                    />
                    {location && (
                      <p className="text-xs text-muted-foreground">
                        {treasuresInRadius.length} {treasuresInRadius.length === 1 ? 'treasure' : 'treasures'} found within {radiusKm} km
                      </p>
                    )}
                  </div>

                  {location && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="h-4 w-4" />
                      <span>{location.lat.toFixed(5)}, {location.lng.toFixed(5)}</span>
                    </div>
                  )}
                </div>
              )}

              {/* === STEP 3: Review Treasures === */}
              {currentStep === 3 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      Tap a treasure to deselect it.
                    </p>
                    <p className="text-sm font-medium text-primary">
                      {selectedCaches.length}/{allAvailableCaches.length} selected
                    </p>
                  </div>

                  {allAvailableCaches.length > 0 ? (
                    <div className="max-h-[50dvh] overflow-y-auto pr-1 grid grid-cols-1 md:grid-cols-2 gap-2 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-thumb]:rounded-full">
                      {allAvailableCaches.map((cache) => {
                        const isSelected = !excludedIds.has(cache.id);
                        return (
                          <div
                            key={cache.id}
                            onClick={() => handleToggleCache(cache.id)}
                            className={`rounded-lg border-[3px] p-0.5 cursor-pointer transition-all duration-200 ${
                              isSelected
                                ? 'border-primary/40 bg-primary/5'
                                : 'border-muted bg-muted/20 opacity-50 grayscale'
                            }`}
                          >
                            <div className="pointer-events-none">
                              <CompactGeocacheCard
                                cache={cache}
                                onClick={() => {}}
                                actions={<></>}
                                showStats={false}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground border rounded-lg">
                      <p className="text-sm">No treasures in this area. Go back and adjust the radius.</p>
                    </div>
                  )}
                </div>
              )}

              {/* === STEP 4: Review === */}
              {currentStep === 4 && (
                <div className="space-y-4">
                  <div className="bg-muted/20 border border-muted rounded-lg p-4">
                    <h4 className="text-sm font-medium text-muted-foreground mb-3">Preview</h4>
                    <div className="space-y-3">
                      {image && (
                        <img src={image} alt="Banner" className="w-full aspect-[2/1] object-cover rounded-lg" />
                      )}
                      <h5 className="font-medium text-foreground text-lg">{title || "Your Adventure"}</h5>
                      {summary && <p className="text-sm text-muted-foreground">{summary}</p>}
                      {description && <p className="text-sm whitespace-pre-wrap">{description}</p>}
                      {location && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {location.lat.toFixed(4)}, {location.lng.toFixed(4)} · {radiusKm} km radius
                        </p>
                      )}
                      {(adventureTheme || adventureMapStyle) && (
                        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                          {adventureTheme && (
                            <span className="flex items-center gap-1">
                              <Sword className="h-3 w-3" /> Theme: {adventureTheme}
                            </span>
                          )}
                          {adventureMapStyle && (
                            <span className="flex items-center gap-1">
                              <Map className="h-3 w-3" /> Map: {adventureMapStyle}
                            </span>
                          )}
                        </div>
                      )}
                      <div className="border-t pt-3">
                        <p className="text-sm font-medium mb-2">{selectedCaches.length} Treasures:</p>
                        <ol className="space-y-1">
                          {selectedCaches.map((cache, i) => (
                            <li key={cache.id} className="text-sm text-muted-foreground">
                              {i + 1}. {cache.name}
                            </li>
                          ))}
                        </ol>
                      </div>
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
                      Back
                    </Button>
                  )}
                  <Button
                    type="button"
                    onClick={validateAndAdvance}
                    className="flex-1"
                  >
                    Next <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              ) : (
                <div className="space-y-3 pt-4 pb-4 md:pb-0">
                  <div className="flex gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setCurrentStep(currentStep - 1)}
                      className="flex-1"
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      Back
                    </Button>
                  </div>
                  <Button
                    type="button"
                    onClick={handlePublish}
                    disabled={isPending}
                    className="w-full"
                  >
                    {isPending ? (
                      isEditMode ? 'Saving...' : 'Publishing...'
                    ) : (
                      <><Check className="h-4 w-4 mr-1" /> {isEditMode ? 'Save Changes' : 'Publish Adventure'}</>
                    )}
                  </Button>
                </div>
              )}
            </form>
          </div>
        </div>
      </PageHero>

      {/* React portal into Leaflet popup */}
      {selectedPopupGeocache && popupContainer && createPortal(
        <GeocachePopupCard
          geocache={selectedPopupGeocache}
          compact
          onClose={() => {
            setSelectedPopupGeocache(null);
            setPopupContainer(null);
            if (mapRef.current) {
              mapRef.current.closePopup();
            }
          }}
        />,
        popupContainer
      )}
    </>
  );
}
