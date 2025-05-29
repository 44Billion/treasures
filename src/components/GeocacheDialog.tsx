import { useState } from "react";
import { MapPin, Navigation, Calendar, User, MessageSquare, Trophy, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { GeocacheMap } from "@/components/GeocacheMap";
import { useGeocacheLogs } from "@/hooks/useGeocacheLogs";
import { useCreateLog } from "@/hooks/useCreateLog";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useAuthor } from "@/hooks/useAuthor";
import { LogList } from "@/components/LogList";
import { formatDistanceToNow } from "@/lib/date";
import { useNavigate } from "react-router-dom";
import type { Geocache } from "@/types/geocache";

interface GeocacheDialogProps {
  geocache: Geocache | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GeocacheDialog({ geocache, isOpen, onOpenChange }: GeocacheDialogProps) {
  const navigate = useNavigate();
  const { user } = useCurrentUser();
  const { data: logs, refetch: refetchLogs } = useGeocacheLogs(geocache?.id || '', geocache?.dTag);
  const { mutate: createLog, isPending: isCreatingLog } = useCreateLog();
  const author = useAuthor(geocache?.pubkey || "");
  
  const [logText, setLogText] = useState("");
  const [logType, setLogType] = useState<"found" | "dnf" | "note">("found");
  const [postingStatus, setPostingStatus] = useState<string>("");

  if (!geocache) return null;

  const authorName = author.data?.metadata?.name || geocache.pubkey.slice(0, 8);

  const handleCreateLog = () => {
    if (!logText.trim() || !geocache) return;
    
    setPostingStatus("Signing event...");
    
    createLog({
      geocacheId: geocache.id,
      geocacheDTag: geocache.dTag,
      type: logType,
      text: logText,
    }, {
      onSuccess: () => {
        setPostingStatus("Posted! Refreshing...");
        setLogText("");
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

  const handleViewFullDetails = () => {
    onOpenChange(false);
    navigate(`/cache/${geocache.dTag}`);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">{geocache.name}</DialogTitle>
          <div className="flex items-center gap-4 text-sm text-gray-600">
            <span className="flex items-center gap-1">
              <User className="h-4 w-4" />
              Hidden by {authorName}
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              {formatDistanceToNow(new Date(geocache.created_at * 1000), { addSuffix: true })}
            </span>
          </div>
        </DialogHeader>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-4">
            {/* Cache Details */}
            <div>
              <div className="flex flex-wrap gap-2 mb-3">
                <Badge variant="secondary">{getTypeLabel(geocache.type)}</Badge>
                <Badge variant="secondary">{getSizeLabel(geocache.size)}</Badge>
                <Badge>D{geocache.difficulty} / T{geocache.terrain}</Badge>
              </div>
              
              <div className="prose max-w-none">
                <p className="whitespace-pre-wrap text-sm">{geocache.description}</p>
                
                {geocache.hint && (
                  <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-md">
                    <p className="text-sm">
                      <strong>Hint:</strong> {geocache.hint}
                    </p>
                  </div>
                )}
              </div>

              {geocache.images && geocache.images.length > 0 && (
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {geocache.images.slice(0, 4).map((url, index) => (
                    <img
                      key={index}
                      src={url}
                      alt={`Cache image ${index + 1}`}
                      className="rounded w-full h-24 object-cover"
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Tabs */}
            <Tabs defaultValue="logs" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="logs">
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Logs ({logs?.length || 0})
                </TabsTrigger>
                <TabsTrigger value="map">
                  <MapPin className="h-4 w-4 mr-2" />
                  Map
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="logs" className="space-y-4 max-h-60 overflow-y-auto">
                {user && (
                  <Card>
                    <CardContent className="p-4 space-y-3">
                      <div className="flex gap-1 flex-wrap">
                        <Button
                          variant={logType === "found" ? "default" : "outline"}
                          size="sm"
                          onClick={() => setLogType("found")}
                        >
                          <Trophy className="h-3 w-3 mr-1" />
                          Found
                        </Button>
                        <Button
                          variant={logType === "dnf" ? "default" : "outline"}
                          size="sm" 
                          onClick={() => setLogType("dnf")}
                        >
                          DNF
                        </Button>
                        <Button
                          variant={logType === "note" ? "default" : "outline"}
                          size="sm"
                          onClick={() => setLogType("note")}
                        >
                          Note
                        </Button>
                      </div>
                      
                      <Textarea
                        placeholder="Share your experience..."
                        value={logText}
                        onChange={(e) => setLogText(e.target.value)}
                        rows={3}
                        className="text-sm"
                      />
                      
                      <Button 
                        onClick={handleCreateLog} 
                        disabled={!logText.trim() || isCreatingLog}
                        size="sm"
                        className="w-full"
                      >
                        {isCreatingLog ? "Posting..." : "Post Log"}
                      </Button>
                      {postingStatus && (
                        <p className="text-xs text-gray-600 text-center">
                          {postingStatus}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                )}
                
                {logs && logs.length > 0 ? (
                  <LogList logs={logs} compact />
                ) : (
                  <Card>
                    <CardContent className="text-center py-6">
                      <MessageSquare className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-600">No logs yet</p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
              
              <TabsContent value="map">
                <div className="h-64 rounded-lg overflow-hidden">
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
          <div className="space-y-4">
            {/* Cache Details Card */}
            <Card>
              <CardContent className="p-4 space-y-3">
                <h4 className="font-medium">Cache Details</h4>
                
                <div>
                  <p className="text-xs font-medium text-gray-600">Difficulty</p>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <div
                          key={i}
                          className={`h-3 w-3 rounded ${
                            i <= geocache.difficulty ? "bg-green-600" : "bg-gray-200"
                          }`}
                        />
                      ))}
                    </div>
                    <span className="text-xs">{getDifficultyLabel(geocache.difficulty)}</span>
                  </div>
                </div>
                
                <div>
                  <p className="text-xs font-medium text-gray-600">Terrain</p>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <div
                          key={i}
                          className={`h-3 w-3 rounded ${
                            i <= geocache.terrain ? "bg-blue-600" : "bg-gray-200"
                          }`}
                        />
                      ))}
                    </div>
                    <span className="text-xs">{getDifficultyLabel(geocache.terrain)}</span>
                  </div>
                </div>
                
                <div>
                  <p className="text-xs font-medium text-gray-600">Coordinates</p>
                  <p className="text-xs font-mono mt-1">
                    {geocache.location.lat.toFixed(6)}, {geocache.location.lng.toFixed(6)}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Statistics Card */}
            <Card>
              <CardContent className="p-4 space-y-3">
                <h4 className="font-medium">Statistics</h4>
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span className="text-xs text-gray-600">Total Finds</span>
                    <span className="text-xs font-medium">
                      {logs?.filter(log => log.type === "found").length || 0}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs text-gray-600">DNFs</span>
                    <span className="text-xs font-medium">
                      {logs?.filter(log => log.type === "dnf").length || 0}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs text-gray-600">Total Logs</span>
                    <span className="text-xs font-medium">{logs?.length || 0}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="space-y-2">
              <Button
                size="sm"
                className="w-full"
                onClick={handleViewFullDetails}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                View Full Details
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="w-full"
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
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}