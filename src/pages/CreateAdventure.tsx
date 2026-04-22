import React, { useState, useMemo, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";
import { MapPinned, FileText, ListChecks, Eye, Check, ChevronLeft, ChevronRight, X, MapPin, Compass, Image as ImageIcon } from "lucide-react";
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
import { GeocacheMap } from "@/components/GeocacheMap";
import { GeocachePopupCard } from "@/components/GeocachePopupCard";
import { OmniSearch } from "@/components/OmniSearch";
import { CompactGeocacheCard } from "@/components/ui/geocache-card";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useGeocaches } from "@/hooks/useGeocaches";
import { useCreateAdventure } from "@/hooks/useCreateAdventure";
import { useUploadFile } from "@/hooks/useUploadFile";
import { useToast } from "@/hooks/useToast";
import { NIP_GC_KINDS } from "@/utils/nip-gc";
import { calculateDistance } from "@/utils/geo";
import type { Geocache } from "@/types/geocache";

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
  const { user } = useCurrentUser();
  const { data: allGeocaches } = useGeocaches();
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
  const [selectedPopupGeocache, setSelectedPopupGeocache] = useState<Geocache | null>(null);
  const [popupContainer, setPopupContainer] = useState<HTMLDivElement | null>(null);

  const mapRef = useRef<L.Map | null>(null);

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

  // Derive the selected treasures from radius results minus exclusions
  const selectedCaches = useMemo(
    () => treasuresInRadius.filter(c => !excludedIds.has(c.id)),
    [treasuresInRadius, excludedIds]
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
      if (treasuresInRadius.length === 0) {
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

      const event = await createAdventure({
        title: title.trim(),
        description: description.trim(),
        summary: summary.trim() || undefined,
        image: image || undefined,
        location,
        geocacheRefs,
      });

      const naddr = nip19.naddrEncode({
        kind: NIP_GC_KINDS.ADVENTURE,
        pubkey: event.pubkey,
        identifier: event.tags.find(t => t[0] === 'd')?.[1] || '',
      });

      toast({
        title: "Adventure published!",
        description: "Redirecting to your adventure...",
      });

      navigate(`/adventure/${naddr}`);
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
        <PageHero icon={Compass} title="Create Adventure" description="Curate a treasure hunt for the community.">
          <div className="container mx-auto px-4 py-10 max-w-md">
            <LoginRequiredCard
              icon={Compass}
              description="Please log in with Nostr to create an adventure."
              className="max-w-md mx-auto"
            />
          </div>
        </PageHero>
      </>
    );
  }

  const stepDescriptions = [
    "Name your adventure and add a description.",
    "Set the center and radius to find nearby treasures.",
    "Review the treasures included in your adventure.",
    "Review everything and publish.",
  ];

  return (
    <>
      <DesktopHeader />
      <PageHero icon={Compass} title="Create Adventure" description={stepDescriptions[currentStep - 1]}>
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
                      {selectedCaches.length}/{treasuresInRadius.length} selected
                    </p>
                  </div>

                  {treasuresInRadius.length > 0 ? (
                    <div className="max-h-[50dvh] overflow-y-auto pr-1 grid grid-cols-1 md:grid-cols-2 gap-2 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-thumb]:rounded-full">
                      {treasuresInRadius.map((cache) => {
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
                      'Publishing...'
                    ) : (
                      <><Check className="h-4 w-4 mr-1" /> Publish Adventure</>
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
