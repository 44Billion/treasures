import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { MapPin, Navigation, Calendar, User, MessageSquare, Trophy, Edit, Trash2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { LoginArea } from "@/components/auth/LoginArea";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useGeocache } from "@/hooks/useGeocache";
import { useGeocacheLogs } from "@/hooks/useGeocacheLogs";
import { useCreateLog } from "@/hooks/useCreateLog";
import { useDeleteGeocache } from "@/hooks/useDeleteGeocache";
import { GeocacheMap } from "@/components/GeocacheMap";
import { LogList } from "@/components/LogList";
import { useAuthor } from "@/hooks/useAuthor";
import { formatDistanceToNow } from "@/lib/date";

export default function CacheDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useCurrentUser();
  const { data: geocache, isLoading, error, isError, refetch } = useGeocache(id!);
  const { data: logs, refetch: refetchLogs } = useGeocacheLogs(id!);
  const { mutate: createLog, isPending: isCreatingLog } = useCreateLog();
  const { mutate: deleteGeocache } = useDeleteGeocache();
  
  const author = useAuthor(geocache?.pubkey || "");
  const [logText, setLogText] = useState("");
  const [logType, setLogType] = useState<"found" | "dnf" | "note">("found");
  const [postingStatus, setPostingStatus] = useState<string>("");

  const handleCreateLog = () => {
    if (!logText.trim() || !id) return;
    
    setPostingStatus("Signing event...");
    
    createLog({
      geocacheId: id,
      type: logType,
      text: logText,
    }, {
      onSuccess: () => {
        setPostingStatus("Posted! Refreshing...");
        setLogText("");
        // Force refresh logs after a short delay
        setTimeout(() => {
          refetchLogs();
          setPostingStatus("");
        }, 2000);
      },
      onError: () => {
        setPostingStatus("");
      }
    });
  };

  const handleDelete = () => {
    if (!id) return;
    deleteGeocache(id, {
      onSuccess: () => {
        navigate("/");
      }
    });
  };

  const getDifficultyLabel = (difficulty: number) => {
    const labels = ["", "Easy", "Moderate", "Hard", "Very Hard", "Expert"];
    return labels[difficulty] || "";
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      traditional: "Traditional",
      multi: "Multi-cache",
      mystery: "Mystery/Puzzle",
      earth: "EarthCache",
    };
    return labels[type] || type;
  };

  const getSizeLabel = (size: string) => {
    return size.charAt(0).toUpperCase() + size.slice(1);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <MapPin className="h-12 w-12 text-gray-400 mx-auto mb-4 animate-pulse" />
          <p className="text-gray-600">Loading geocache...</p>
          <p className="text-sm text-gray-500 mt-2">Checking multiple relays for the best connection...</p>
        </div>
      </div>
    );
  }

  // Show error with retry option if there was an error and no cached data
  if (isError && !geocache) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="border-b bg-white">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <Link to="/" className="flex items-center gap-2">
                <MapPin className="h-8 w-8 text-green-600" />
                <h1 className="text-2xl font-bold text-gray-900">NostrCache</h1>
              </Link>
              <LoginArea />
            </div>
          </div>
        </header>
        
        <div className="container mx-auto px-4 py-16">
          <Card className="max-w-md mx-auto">
            <CardContent className="pt-6 text-center">
              <MapPin className="h-12 w-12 text-red-400 mx-auto mb-4" />
              <p className="text-lg font-medium mb-2">Connection Issue</p>
              <p className="text-gray-600 mb-4">
                Unable to load geocache. This might be a temporary network issue.
              </p>
              <div className="space-y-2">
                <Button onClick={() => refetch()} className="w-full">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Try Again
                </Button>
                <Link to="/" className="block">
                  <Button variant="outline" className="w-full">Back to Home</Button>
                </Link>
              </div>
              {error && (
                <p className="text-xs text-gray-500 mt-4">
                  Error: {error instanceof Error ? error.message : 'Unknown error'}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Only show "not found" if we're sure it doesn't exist (no loading, no error, no data)
  if (!isLoading && !isError && !geocache) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="border-b bg-white">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <Link to="/" className="flex items-center gap-2">
                <MapPin className="h-8 w-8 text-green-600" />
                <h1 className="text-2xl font-bold text-gray-900">NostrCache</h1>
              </Link>
              <LoginArea />
            </div>
          </div>
        </header>
        
        <div className="container mx-auto px-4 py-16">
          <Card className="max-w-md mx-auto">
            <CardContent className="pt-6 text-center">
              <MapPin className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-lg font-medium mb-2">Geocache Not Found</p>
              <p className="text-gray-600 mb-4">This geocache may have been removed or doesn't exist.</p>
              <div className="space-y-2">
                <Button onClick={() => refetch()} variant="outline" className="w-full">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Check Again
                </Button>
                <Link to="/" className="block">
                  <Button className="w-full">Back to Home</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const isOwner = user && user.pubkey === geocache.pubkey;
  const authorName = author.data?.metadata?.name || geocache.pubkey.slice(0, 8);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2">
              <MapPin className="h-8 w-8 text-green-600" />
              <h1 className="text-2xl font-bold text-gray-900">NostrCache</h1>
            </Link>
            <LoginArea />
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-2xl">{geocache.name}</CardTitle>
                    <CardDescription className="flex items-center gap-4 mt-2">
                      <span className="flex items-center gap-1">
                        <User className="h-4 w-4" />
                        Hidden by {authorName}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {formatDistanceToNow(new Date(geocache.created_at * 1000), { addSuffix: true })}
                      </span>
                    </CardDescription>
                  </div>
                  {isOwner && (
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm">
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
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2 mb-4">
                  <Badge variant="secondary">{getTypeLabel(geocache.type)}</Badge>
                  <Badge variant="secondary">{getSizeLabel(geocache.size)}</Badge>
                  <Badge>D{geocache.difficulty} / T{geocache.terrain}</Badge>
                </div>
                
                <div className="prose max-w-none">
                  <p className="whitespace-pre-wrap">{geocache.description}</p>
                  
                  {geocache.hint && (
                    <Alert className="mt-4">
                      <AlertDescription>
                        <strong>Hint:</strong> {geocache.hint}
                      </AlertDescription>
                    </Alert>
                  )}
                </div>

                {geocache.images && geocache.images.length > 0 && (
                  <div className="mt-6 grid grid-cols-2 gap-4">
                    {geocache.images.map((url, index) => (
                      <img
                        key={index}
                        src={url}
                        alt={`Cache image ${index + 1}`}
                        className="rounded-lg w-full h-48 object-cover"
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Tabs defaultValue="logs">
              <TabsList>
                <TabsTrigger value="logs">
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Logs ({logs?.length || 0})
                </TabsTrigger>
                <TabsTrigger value="map">
                  <MapPin className="h-4 w-4 mr-2" />
                  Map
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="logs" className="space-y-4">
                <div className="flex justify-end mb-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => refetchLogs()}
                    title="Refresh logs"
                  >
                    <RefreshCw className="h-4 w-4 mr-1" />
                    Refresh
                  </Button>
                </div>
                
                {user && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Post a Log</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex gap-2">
                        <Button
                          variant={logType === "found" ? "default" : "outline"}
                          size="sm"
                          onClick={() => setLogType("found")}
                        >
                          <Trophy className="h-4 w-4 mr-1" />
                          Found It
                        </Button>
                        <Button
                          variant={logType === "dnf" ? "default" : "outline"}
                          size="sm"
                          onClick={() => setLogType("dnf")}
                        >
                          Didn't Find It
                        </Button>
                        <Button
                          variant={logType === "note" ? "default" : "outline"}
                          size="sm"
                          onClick={() => setLogType("note")}
                        >
                          Write Note
                        </Button>
                      </div>
                      
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
            </Tabs>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Cache Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-gray-600">Difficulty</p>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <div
                          key={i}
                          className={`h-4 w-4 rounded ${
                            i <= geocache.difficulty ? "bg-green-600" : "bg-gray-200"
                          }`}
                        />
                      ))}
                    </div>
                    <span className="text-sm">{getDifficultyLabel(geocache.difficulty)}</span>
                  </div>
                </div>
                
                <div>
                  <p className="text-sm font-medium text-gray-600">Terrain</p>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <div
                          key={i}
                          className={`h-4 w-4 rounded ${
                            i <= geocache.terrain ? "bg-blue-600" : "bg-gray-200"
                          }`}
                        />
                      ))}
                    </div>
                    <span className="text-sm">{getDifficultyLabel(geocache.terrain)}</span>
                  </div>
                </div>
                
                <div>
                  <p className="text-sm font-medium text-gray-600">Coordinates</p>
                  <p className="text-sm font-mono mt-1">
                    {geocache.location.lat.toFixed(6)}, {geocache.location.lng.toFixed(6)}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2 w-full"
                    onClick={() => {
                      window.open(
                        `https://www.google.com/maps/dir/?api=1&destination=${geocache.location.lat},${geocache.location.lng}`,
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
    </div>
  );
}