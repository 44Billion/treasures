import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { MapPin, Upload, X, AlertTriangle, CheckCircle, XCircle, Loader2, Check } from "lucide-react";
import { MapContainer, TileLayer, Marker } from "react-leaflet";
import L from "leaflet";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
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
import { DesktopHeader } from "@/components/DesktopHeader";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useCreateGeocache } from "@/hooks/useCreateGeocache";
import { LocationPicker } from "@/components/LocationPicker";
import { useToast } from "@/hooks/useToast";
import { verifyLocation, getVerificationSummary, type LocationVerification } from "@/lib/osmVerification";
import { LocationWarnings } from "@/components/LocationWarnings";
import { GeocacheForm, createDefaultGeocacheFormData, type GeocacheFormData } from "@/components/ui/geocache-form";

import "leaflet/dist/leaflet.css";
import { LoginRequiredCard } from "@/components/LoginRequiredCard";

// Custom marker icon for the confirmation map
const confirmLocationIcon = L.divIcon({
  html: `
    <div style="position: relative;">
      <svg width="32" height="40" viewBox="0 0 32 40" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M16 0C9.373 0 4 5.373 4 12c0 9 12 24 12 24s12-15 12-24c0-6.627-5.373-12-12-12z" fill="#ef4444"/>
        <circle cx="16" cy="12" r="4" fill="white"/>
      </svg>
    </div>
  `,
  className: "location-picker-icon",
  iconSize: [32, 40],
  iconAnchor: [16, 40],
});

export default function CreateCache() {
  const navigate = useNavigate();
  const { user } = useCurrentUser();
  const { mutate: createGeocache, isPending } = useCreateGeocache();
  const { toast } = useToast();

  const [formData, setFormData] = useState<GeocacheFormData>(createDefaultGeocacheFormData());
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [images, setImages] = useState<string[]>([]);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [locationVerification, setLocationVerification] = useState<LocationVerification | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

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

    // Verify location before showing dialog
    setIsVerifying(true);
    try {
      const verification = await verifyLocation(location.lat, location.lng);
      setLocationVerification(verification);
      
      // Always show confirmation dialog, even for restricted locations
      // The dialog will display appropriate warnings
      setShowConfirmDialog(true);
    } catch (error) {
      console.error('Error verifying location:', error);
      // Still show dialog but with a warning
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
      setShowConfirmDialog(true);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleConfirmSubmit = () => {
    setShowConfirmDialog(false);
    
    if (!location) return;
    
    createGeocache({
      ...formData,
      location,
      images,
      difficulty: parseInt(formData.difficulty),
      terrain: parseInt(formData.terrain),
    });
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-muted/30 pb-4 md:pb-0">
        <DesktopHeader />
        
        <div className="container mx-auto px-4 py-16">
          <LoginRequiredCard
            icon={MapPin}
            description="You need to be logged in to create a geocache."
            className="max-w-md mx-auto"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 pb-4 md:pb-0">
      <DesktopHeader />

      <div className="container mx-auto px-4 py-8">
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle>Hide a New Treasure</CardTitle>
            <CardDescription>
              Create a new geocache for others to discover. Make sure to provide accurate information
              and follow local regulations.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Main Form */}
              <GeocacheForm
                formData={formData}
                onFormDataChange={setFormData}
                images={images}
                onImagesChange={setImages}
                showRequiredMarkers={true}
                isSubmitting={isPending || isVerifying}
              />

              {/* Location */}
              <div>
                <Label>Location *</Label>
                <LocationPicker
                  value={location}
                  onChange={setLocation}
                />
              </div>

              <Alert>
                <AlertDescription>
                  By creating this geocache, you confirm that you have permission to place it at this location
                  and that it complies with all local laws and regulations.
                </AlertDescription>
              </Alert>

              <div className="flex gap-4">
                <Button type="submit" disabled={isPending || isVerifying} className="flex-1">
                  {isVerifying ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Verifying Location...
                    </>
                  ) : isPending ? (
                    "Creating..."
                  ) : (
                    "Create Geocache"
                  )}
                </Button>
                <Button type="button" variant="outline" onClick={() => navigate("/")}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
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
                      <div className="h-32 rounded-md overflow-hidden border">
                        <MapContainer
                          center={[location.lat, location.lng]}
                          zoom={17}
                          style={{ height: "100%", width: "100%" }}
                          scrollWheelZoom={false}
                          dragging={false}
                          zoomControl={false}
                          doubleClickZoom={false}
                          attributionControl={false}
                        >
                          <TileLayer
                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                            maxZoom={19}
                          />
                          <Marker 
                            position={[location.lat, location.lng]} 
                            icon={confirmLocationIcon}
                          />
                        </MapContainer>
                      </div>
                      <div className="bg-muted/50 p-2 rounded text-center">
                        <div className="font-mono text-xs text-foreground">
                          {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
                        </div>
                      </div>
                    </div>
                    
                    {/* Confirmation */}
                    <div className="flex items-center">
                      <div className="text-sm">
                        <div className="font-medium mb-2 text-foreground">By submitting, you confirm:</div>
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
                  />
                )}


              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel>Review Location</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmSubmit}
              className={`flex items-center gap-2 ${
                locationVerification && getVerificationSummary(locationVerification).status === 'restricted'
                  ? 'bg-yellow-600 hover:bg-yellow-700'
                  : 'bg-green-600 hover:bg-green-700'
              }`}
            >
              {locationVerification && getVerificationSummary(locationVerification).status === 'restricted' ? (
                <>
                  <AlertTriangle className="h-4 w-4" />
                  Create Despite Warnings
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4" />
                  Confirm & Create Cache
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}