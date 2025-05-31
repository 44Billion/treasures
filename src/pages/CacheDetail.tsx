import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { MapPin, Navigation, Calendar, User, MessageSquare, Trophy, Edit, Trash2, RefreshCw, Upload, X, Save, RotateCcw, Compass as CompassIcon, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { DesktopHeader } from "@/components/DesktopHeader";
import { LoadingState, ErrorState } from "@/components/ui/loading-states";
import { SaveButton } from "@/components/SaveButton";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useGeocacheByDTag } from "@/hooks/useGeocacheByDTag";
import { useGeocacheLogs } from "@/hooks/useGeocacheLogs";
import { useCreateLog } from "@/hooks/useCreateLog";
import { useDeleteGeocache } from "@/hooks/useDeleteGeocache";
import { useEditGeocache } from "@/hooks/useEditGeocache";
import { useUploadFile } from "@/hooks/useUploadFile";
import { GeocacheMap } from "@/components/GeocacheMap";
import { LogList } from "@/components/LogList";
import { useAuthor } from "@/hooks/useAuthor";
import { useToast } from "@/hooks/useToast";
import { formatDistanceToNow } from "@/lib/date";
import { EventSourceInfo } from "@/components/EventSourceInfo";
import { LocationWarnings } from "@/components/LocationWarnings";
import { verifyLocation, type LocationVerification } from "@/lib/osmVerification";
import { Compass } from "@/components/Compass";
import { getDifficultyLabel, getTypeLabel, getSizeLabel } from "@/lib/geocache-utils";
import { DifficultyTerrainRating } from "@/components/ui/difficulty-terrain-rating";

import { ImageGallery } from "@/components/ImageGallery";

export default function CacheDetail() {
  const { dtag } = useParams<{ dtag: string }>();
  const navigate = useNavigate();
  const { user } = useCurrentUser();
  const { data: geocache, isLoading, error, isError, refetch } = useGeocacheByDTag(dtag!);
  const { data: logs = [], refetch: refetchLogs } = useGeocacheLogs(
    geocache ? `${geocache.pubkey}:${geocache.dTag}` : '', 
    geocache?.dTag, 
    geocache?.pubkey,
    geocache?.relays
  );
  const { mutate: createLog, isPending: isCreatingLog } = useCreateLog();
  const { mutate: deleteGeocache } = useDeleteGeocache();
  const { mutate: editGeocache, isPending: isEditingGeocache } = useEditGeocache(geocache || null);
  const { mutateAsync: uploadFile, isPending: isUploading } = useUploadFile();
  const { toast } = useToast();
  
  const author = useAuthor(geocache?.pubkey || "");
  const [logText, setLogText] = useState("");
  const [logType, setLogType] = useState<"found" | "dnf" | "note" | "maintenance" | "disabled" | "enabled" | "archived">("found");
  const [postingStatus, setPostingStatus] = useState<string>("");
  
  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [editFormData, setEditFormData] = useState({
    name: "",
    description: "",
    hint: "",
    difficulty: "1",
    terrain: "1",
    size: "regular",
    type: "traditional",
  });
  const [editImages, setEditImages] = useState<string[]>([]);
  const [locationVerification, setLocationVerification] = useState<LocationVerification | null>(null);
  
  // Image gallery state
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);
  
  // Hint visibility state
  const [isHintVisible, setIsHintVisible] = useState(false);
  
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

  const handleCreateLog = () => {
    if (!logText.trim() || !geocache) return;
    
    setPostingStatus("Signing event...");
    
    // Get the primary relay from the geocache's relay list
    const primaryRelay = geocache.relays?.[0] || '';
    
    createLog({
      geocacheId: geocache.id,
      geocacheDTag: geocache.dTag, // Pass the stable d-tag for new logs
      geocachePubkey: geocache.pubkey, // Pass the cache owner's pubkey
      relayUrl: primaryRelay, // Pass the primary relay from the cache
      preferredRelays: geocache.relays, // Pass all preferred relays for publishing
      type: logType,
      text: logText,
    }, {
      onSuccess: () => {
        setPostingStatus("Posted! Refreshing...");
        setLogText("");
        // Don't force refresh - let the background refresh in useCreateLog handle it
        setTimeout(() => {
          setPostingStatus("");
        }, 2000);
      },
      onError: () => {
        setPostingStatus("");
      }
    });
  };

  const handleDelete = () => {
    if (!geocache) return;
    deleteGeocache(geocache.id, {
      onSuccess: () => {
        navigate("/");
      }
    });
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

    try {
      const [[_, url]] = await uploadFile(file);
      setEditImages([...editImages, url]);
    } catch (error) {
      toast({
        title: "Upload failed",
        description: "Failed to upload image. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleImageClick = (index: number) => {
    setGalleryIndex(index);
    setGalleryOpen(true);
  };

  if (isLoading) {
    return (
      <LoadingState 
        fullPage 
        title="Loading geocache..."
        description="Checking multiple relays for the best connection..."
        showSpinner
      />
    );
  }

  // Show error with retry option if there was an error and no cached data
  if (isError && !geocache) {
    return (
      <div className="min-h-screen bg-gray-50">
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
      <div className="min-h-screen bg-gray-50">
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
    <div className="min-h-screen bg-gray-50">
      <DesktopHeader />

      <div className="container mx-auto px-2 sm:px-4 py-8 pb-20 md:pb-8 max-w-full overflow-hidden">
        <div className="grid lg:grid-cols-3 gap-4 lg:gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-4 lg:space-y-6 min-w-0">
            <Card>
              <CardHeader>
                <div className="flex items-start gap-2 sm:gap-4">
                  <div className="min-w-0 flex-1">
                    <CardTitle className="text-2xl break-words">{geocache.name}</CardTitle>
                    
                    <CardDescription className="space-y-1 mt-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="flex items-center gap-1">
                          <User className="h-4 w-4" />
                          Hidden by {authorName}
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
                    </CardDescription>
                    <EventSourceInfo 
                      relayUrl={geocache.relays?.[0]} 
                      client={geocache.client}
                      className="mt-1"
                    />
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
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="outline" size="sm">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Geocache?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This action cannot be undone. This will permanently delete your geocache
                                    and all associated logs.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
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
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="edit-name">Cache Name</Label>
                      <Input
                        id="edit-name"
                        value={editFormData.name}
                        onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                        placeholder="Give your cache a memorable name"
                      />
                    </div>

                    <div>
                      <Label htmlFor="edit-description">Description</Label>
                      <Textarea
                        id="edit-description"
                        value={editFormData.description}
                        onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                        placeholder="Describe your cache, its location, and any special instructions"
                        rows={4}
                      />
                    </div>

                    <div>
                      <Label htmlFor="edit-hint">Hint (Optional)</Label>
                      <Input
                        id="edit-hint"
                        value={editFormData.hint}
                        onChange={(e) => setEditFormData({ ...editFormData, hint: e.target.value })}
                        placeholder="Provide a cryptic hint to help seekers"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="edit-type">Cache Type</Label>
                        <Select value={editFormData.type} onValueChange={(value) => setEditFormData({ ...editFormData, type: value })}>
                          <SelectTrigger id="edit-type">
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
                        <Label htmlFor="edit-size">Cache Size</Label>
                        <Select value={editFormData.size} onValueChange={(value) => setEditFormData({ ...editFormData, size: value })}>
                          <SelectTrigger id="edit-size">
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
                        <Label htmlFor="edit-difficulty">Difficulty</Label>
                        <Select value={editFormData.difficulty} onValueChange={(value) => setEditFormData({ ...editFormData, difficulty: value })}>
                          <SelectTrigger id="edit-difficulty">
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
                        <Label htmlFor="edit-terrain">Terrain</Label>
                        <Select value={editFormData.terrain} onValueChange={(value) => setEditFormData({ ...editFormData, terrain: value })}>
                          <SelectTrigger id="edit-terrain">
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

                    {/* Images */}
                    <div>
                      <Label>Images</Label>
                      <div className="space-y-2">
                        {editImages.map((url, index) => (
                          <div key={index} className="flex items-center gap-2 p-2 border rounded">
                            <img src={url} alt="" className="h-16 w-16 object-cover rounded" />
                            <span className="flex-1 text-sm truncate">{url}</span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setEditImages(editImages.filter((_, i) => i !== index))}
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
                            disabled={isUploading}
                            className="hidden"
                            id="edit-image-upload"
                          />
                          <Label
                            htmlFor="edit-image-upload"
                            className="cursor-pointer inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2"
                          >
                            <Upload className="h-4 w-4 mr-2" />
                            {isUploading ? "Uploading..." : "Upload Image"}
                          </Label>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  // View mode
                  <>
                    <div className="flex flex-wrap gap-2 mb-4">
                      <Badge variant="secondary">{getTypeLabel(geocache.type)}</Badge>
                      <Badge variant="secondary">{getSizeLabel(geocache.size)}</Badge>
                      <Badge>D{geocache.difficulty} / T{geocache.terrain}</Badge>
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
                                className="flex-shrink-0 p-0.5 -mr-4 sm:-mr-0 rounded hover:bg-gray-100 transition-colors"
                                title={isHintVisible ? "Hide hint" : "Reveal hint"}
                                type="button"
                              >
                                {isHintVisible ? (
                                  <EyeOff className="h-3.5 w-3.5 text-gray-600" />
                                ) : (
                                  <Eye className="h-3.5 w-3.5 text-gray-600" />
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

            <Tabs defaultValue="logs">
              <TabsList className="grid w-full grid-cols-2 h-auto">
                <TabsTrigger value="logs" className="flex items-center justify-center gap-1 sm:gap-2 text-xs sm:text-sm px-2 py-3 sm:px-3 sm:py-2 min-h-[3rem] sm:min-h-[2.5rem]">
                  <MessageSquare className="h-4 w-4 flex-shrink-0" />
                  <span className="text-xs sm:text-sm">Logs</span>
                  <span className="text-xs sm:text-sm">({logs?.length || 0})</span>
                </TabsTrigger>
                <TabsTrigger value="map" className="flex items-center justify-center gap-1 sm:gap-2 text-xs sm:text-sm px-2 py-3 sm:px-3 sm:py-2 min-h-[3rem] sm:min-h-[2.5rem]">
                  <MapPin className="h-4 w-4 flex-shrink-0" />
                  <span className="text-xs sm:text-sm">Map</span>
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="logs" className="space-y-4">
                {user && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Post a Log</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-3 gap-2">
                        <Button
                          variant={logType === "found" ? "default" : "outline"}
                          size="sm"
                          onClick={() => setLogType("found")}
                          className="flex items-center justify-center gap-1 text-xs sm:text-sm px-2 py-2"
                        >
                          <Trophy className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                          <span className="text-xs sm:text-sm">Found It</span>
                        </Button>
                        <Button
                          variant={logType === "dnf" ? "default" : "outline"}
                          size="sm"
                          onClick={() => setLogType("dnf")}
                          className="flex items-center justify-center gap-1 text-xs sm:text-sm px-2 py-2"
                        >
                          <span className="text-xs sm:text-sm">Didn't Find</span>
                        </Button>
                        <Button
                          variant={logType === "note" ? "default" : "outline"}
                          size="sm"
                          onClick={() => setLogType("note")}
                          className="flex items-center justify-center gap-1 text-xs sm:text-sm px-2 py-2"
                        >
                          <span className="text-xs sm:text-sm">Write Note</span>
                        </Button>
                      </div>
                      
                      {isOwner && (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t">
                          <Button
                            variant={logType === "maintenance" ? "default" : "outline"}
                            size="sm"
                            onClick={() => setLogType("maintenance")}
                            className="flex items-center justify-center gap-1 text-xs sm:text-sm px-2 py-2"
                          >
                            <span className="text-xs sm:text-sm">Maintenance</span>
                          </Button>
                          <Button
                            variant={logType === "disabled" ? "default" : "outline"}
                            size="sm"
                            onClick={() => setLogType("disabled")}
                            className="flex items-center justify-center gap-1 text-xs sm:text-sm px-2 py-2"
                          >
                            <span className="text-xs sm:text-sm">Disable</span>
                          </Button>
                          <Button
                            variant={logType === "enabled" ? "default" : "outline"}
                            size="sm"
                            onClick={() => setLogType("enabled")}
                            className="flex items-center justify-center gap-1 text-xs sm:text-sm px-2 py-2"
                          >
                            <span className="text-xs sm:text-sm">Enable</span>
                          </Button>
                          <Button
                            variant={logType === "archived" ? "default" : "outline"}
                            size="sm"
                            onClick={() => setLogType("archived")}
                            className="flex items-center justify-center gap-1 text-xs sm:text-sm px-2 py-2"
                          >
                            <span className="text-xs sm:text-sm">Archive</span>
                          </Button>
                        </div>
                      )}
                      
                      <Textarea
                        placeholder="Share your experience..."
                        value={logText}
                        onChange={(e) => setLogText(e.target.value)}
                        rows={4}
                      />
                      
                      <Button 
                        onClick={handleCreateLog} 
                        disabled={!logText.trim() || isCreatingLog}
                        className="w-full"
                      >
                        {isCreatingLog ? "Posting..." : "Post Log"}
                      </Button>
                      {postingStatus && (
                        <p className="text-sm text-gray-600 text-center mt-2">
                          {postingStatus}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                )}
                
                {logs && logs.length > 0 ? (
                  <LogList logs={logs} />
                ) : (
                  <Card>
                    <CardContent className="text-center py-8">
                      <MessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600">No logs yet. Be the first to log this cache!</p>
                    </CardContent>
                  </Card>
                )}
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
              
              {/* Temporarily hidden - experimental feature
              <TabsContent value="compass">
                <div className="h-96 flex items-center justify-center">
                  <div className="text-center">
                    <Compass 
                      targetLat={geocache.location.lat}
                      targetLng={geocache.location.lng}
                    />
                    <div className="mt-4 max-w-sm mx-auto">
                      <p className="text-xs text-gray-500">
                        Smart compass that uses device sensors when available, 
                        automatically falls back to GPS-based direction finding.
                      </p>
                      <p className="text-xs text-gray-400 mt-2">
                        The arrow always points toward the treasure! 🏴‍☠️
                      </p>
                    </div>
                  </div>
                </div>
              </TabsContent>
              */}
            </Tabs>
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
                  <p className="text-sm font-medium text-gray-600">Coordinates</p>
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
                    <span className="text-sm text-gray-600">Total Finds</span>
                    <span className="font-medium">
                      {logs?.filter(log => log.type === "found").length || 0}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">DNFs</span>
                    <span className="font-medium">
                      {logs?.filter(log => log.type === "dnf").length || 0}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Total Logs</span>
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
    </div>
  );
}