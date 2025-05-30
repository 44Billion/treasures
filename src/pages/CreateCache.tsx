import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { MapPin, Upload, X, AlertTriangle, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { MapContainer, TileLayer, Marker } from "react-leaflet";
import L from "leaflet";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { LoginArea } from "@/components/auth/LoginArea";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useCreateGeocache } from "@/hooks/useCreateGeocache";
import { LocationPicker } from "@/components/LocationPicker";
import { useUploadFile } from "@/hooks/useUploadFile";
import { useToast } from "@/hooks/useToast";
import { verifyLocation, getVerificationSummary, type LocationVerification } from "@/lib/osmVerification";
import { LocationWarnings } from "@/components/LocationWarnings";

import "leaflet/dist/leaflet.css";

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
  const { mutateAsync: uploadFile, isPending: isUploading } = useUploadFile();
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    hint: "",
    difficulty: "1",
    terrain: "1",
    size: "regular",
    type: "traditional",
  });

  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [images, setImages] = useState<string[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [locationVerification, setLocationVerification] = useState<LocationVerification | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid file type",
        description: "Please upload an image file",
        variant: "destructive",
      });
      return;
    }

    setUploadingImage(true);
    try {
      const [[_, url]] = await uploadFile(file);
      setImages([...images, url]);
    } catch (error) {
      toast({
        title: "Upload failed",
        description: "Failed to upload image. Please try again.",
        variant: "destructive",
      });
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

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
      
      // Check if location is severely restricted
      const summary = getVerificationSummary(verification);
      if (summary.status === 'restricted') {
        toast({
          title: "Restricted Location",
          description: summary.message,
          variant: "destructive",
        });
        setIsVerifying(false);
        return;
      }
      
      // Show confirmation dialog
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
      <div className="min-h-screen bg-gray-50">
        <header className="hidden md:block border-b bg-white">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <Link to="/" className="flex items-center gap-2">
                <MapPin className="h-8 w-8 text-green-600" />
                <h1 className="text-2xl font-bold text-gray-900">Treasures</h1>
              </Link>
              <LoginArea />
            </div>
          </div>
        </header>
        
        <div className="container mx-auto px-4 py-16 pb-20 md:pb-16">
          <Card className="max-w-md mx-auto">
            <CardContent className="pt-6 text-center">
              <MapPin className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-lg font-medium mb-2">Login Required</p>
              <p className="text-gray-600 mb-4">You need to be logged in to create a geocache.</p>
              <div className="flex justify-center">
                <LoginArea />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="hidden md:block border-b bg-white">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2">
              <MapPin className="h-8 w-8 text-green-600" />
              <h1 className="text-2xl font-bold text-gray-900">Treasures</h1>
            </Link>
            <LoginArea />
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 pb-20 md:pb-8">
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
              {/* Basic Information */}
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">Cache Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Give your cache a memorable name"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="description">Description *</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Describe your cache, its location, and any special instructions"
                    rows={4}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="hint">Hint (Optional)</Label>
                  <Input
                    id="hint"
                    value={formData.hint}
                    onChange={(e) => setFormData({ ...formData, hint: e.target.value })}
                    placeholder="Provide a cryptic hint to help seekers"
                  />
                </div>
              </div>

              {/* Cache Details */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="type">Cache Type</Label>
                  <Select value={formData.type} onValueChange={(value) => setFormData({ ...formData, type: value })}>
                    <SelectTrigger id="type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="traditional">Traditional</SelectItem>
                      <SelectItem value="multi">Multi-cache</SelectItem>
                      <SelectItem value="mystery">Mystery/Puzzle</SelectItem>
                      <SelectItem value="earth">EarthCache</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="size">Cache Size</Label>
                  <Select value={formData.size} onValueChange={(value) => setFormData({ ...formData, size: value })}>
                    <SelectTrigger id="size">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="micro">Micro</SelectItem>
                      <SelectItem value="small">Small</SelectItem>
                      <SelectItem value="regular">Regular</SelectItem>
                      <SelectItem value="large">Large</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="difficulty">Difficulty</Label>
                  <Select value={formData.difficulty} onValueChange={(value) => setFormData({ ...formData, difficulty: value })}>
                    <SelectTrigger id="difficulty">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 - Easy</SelectItem>
                      <SelectItem value="2">2 - Moderate</SelectItem>
                      <SelectItem value="3">3 - Hard</SelectItem>
                      <SelectItem value="4">4 - Very Hard</SelectItem>
                      <SelectItem value="5">5 - Expert</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="terrain">Terrain</Label>
                  <Select value={formData.terrain} onValueChange={(value) => setFormData({ ...formData, terrain: value })}>
                    <SelectTrigger id="terrain">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 - Easy</SelectItem>
                      <SelectItem value="2">2 - Moderate</SelectItem>
                      <SelectItem value="3">3 - Hard</SelectItem>
                      <SelectItem value="4">4 - Very Hard</SelectItem>
                      <SelectItem value="5">5 - Expert</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Location */}
              <div>
                <Label>Location *</Label>
                <LocationPicker
                  value={location}
                  onChange={setLocation}
                />
              </div>

              {/* Images */}
              <div>
                <Label>Images</Label>
                <div className="space-y-2">
                  {images.map((url, index) => (
                    <div key={index} className="flex items-center gap-2 p-2 border rounded">
                      <img src={url} alt="" className="h-16 w-16 object-cover rounded" />
                      <span className="flex-1 text-sm truncate">{url}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setImages(images.filter((_, i) => i !== index))}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  
                  <div className="flex items-center gap-2">
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      disabled={uploadingImage || isUploading}
                      className="hidden"
                      id="image-upload"
                    />
                    <Label
                      htmlFor="image-upload"
                      className="cursor-pointer inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      {uploadingImage ? "Uploading..." : "Upload Image"}
                    </Label>
                  </div>
                </div>
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
                      <div className="bg-gray-50 p-2 rounded text-center">
                        <div className="font-mono text-xs text-gray-700">
                          {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
                        </div>
                      </div>
                    </div>
                    
                    {/* Confirmation */}
                    <div className="flex items-center">
                      <div className="text-sm">
                        <div className="font-medium mb-2 text-gray-700">By submitting, you confirm:</div>
                        <div className="space-y-1 text-xs text-gray-600">
                          <div>✓ You have permission to place this cache</div>
                          <div>✓ The location is publicly accessible</div>
                          <div>✓ The location is safe and appropriate</div>
                          <div>✓ The coordinates are accurate</div>
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
              disabled={Boolean(locationVerification && getVerificationSummary(locationVerification).status === 'restricted')}
              className="bg-green-600 hover:bg-green-700"
            >
              ✓ Confirm & Create Cache
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}