import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { MapPin, Plus, X, Globe, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { LoginArea } from "@/components/auth/LoginArea";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useToast } from "@/hooks/useToast";
import { EditProfileForm } from "@/components/EditProfileForm";

const DEFAULT_GEOCACHING_RELAYS = [
  'wss://ditto.pub/relay',
];

export default function Settings() {
  const { user } = useCurrentUser();
  const { toast } = useToast();
  
  // Load saved relays from localStorage
  const [geocachingRelays, setGeocachingRelays] = useState<string[]>(() => {
    const saved = localStorage.getItem('geocaching-relays');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return DEFAULT_GEOCACHING_RELAYS;
      }
    }
    return DEFAULT_GEOCACHING_RELAYS;
  });
  
  const [newRelay, setNewRelay] = useState("");
  const [isValidating, setIsValidating] = useState(false);

  // Save relays to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('geocaching-relays', JSON.stringify(geocachingRelays));
  }, [geocachingRelays]);

  const validateRelayUrl = (url: string): boolean => {
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'wss:' || parsed.protocol === 'ws:';
    } catch {
      return false;
    }
  };

  const handleAddRelay = async () => {
    const trimmedUrl = newRelay.trim();
    
    if (!trimmedUrl) {
      toast({
        title: "Invalid relay URL",
        description: "Please enter a relay URL",
        variant: "destructive",
      });
      return;
    }

    if (!validateRelayUrl(trimmedUrl)) {
      toast({
        title: "Invalid relay URL",
        description: "Relay URL must start with wss:// or ws://",
        variant: "destructive",
      });
      return;
    }

    if (geocachingRelays.includes(trimmedUrl)) {
      toast({
        title: "Relay already added",
        description: "This relay is already in your list",
        variant: "destructive",
      });
      return;
    }

    setIsValidating(true);
    
    // Test the relay connection
    try {
      const ws = new WebSocket(trimmedUrl);
      
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          ws.close();
          reject(new Error('Connection timeout'));
        }, 5000);

        ws.onopen = () => {
          clearTimeout(timeout);
          ws.close();
          resolve(true);
        };

        ws.onerror = () => {
          clearTimeout(timeout);
          reject(new Error('Connection failed'));
        };
      });

      setGeocachingRelays([...geocachingRelays, trimmedUrl]);
      setNewRelay("");
      toast({
        title: "Relay added",
        description: "The relay has been added to your preferences",
      });
    } catch (error) {
      toast({
        title: "Failed to connect to relay",
        description: "Please verify the relay URL is correct and the relay is online",
        variant: "destructive",
      });
    } finally {
      setIsValidating(false);
    }
  };

  const handleRemoveRelay = (relay: string) => {
    setGeocachingRelays(geocachingRelays.filter(r => r !== relay));
    toast({
      title: "Relay removed",
      description: "The relay has been removed from your preferences",
    });
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const newRelays = [...geocachingRelays];
    [newRelays[index - 1], newRelays[index]] = [newRelays[index], newRelays[index - 1]];
    setGeocachingRelays(newRelays);
  };

  const handleMoveDown = (index: number) => {
    if (index === geocachingRelays.length - 1) return;
    const newRelays = [...geocachingRelays];
    [newRelays[index], newRelays[index + 1]] = [newRelays[index + 1], newRelays[index]];
    setGeocachingRelays(newRelays);
  };

  const handleResetToDefaults = () => {
    setGeocachingRelays(DEFAULT_GEOCACHING_RELAYS);
    toast({
      title: "Reset to defaults",
      description: "Your relay preferences have been reset to defaults",
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
              <p className="text-gray-600 mb-4">You need to be logged in to access settings.</p>
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
        <div className="max-w-2xl mx-auto space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Settings</CardTitle>
              <CardDescription>
                Configure your profile and geocaching preferences
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Profile Settings
              </CardTitle>
              <CardDescription>
                Update your profile information and preferences
              </CardDescription>
            </CardHeader>
            <CardContent>
              <EditProfileForm />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                Geocaching Relay Preferences
              </CardTitle>
              <CardDescription>
                Configure preferred relays for geocaching events. These relays will be included in your cache listings
                and used when querying for caches and logs. Relays are listed in order of preference.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <AlertDescription>
                  When you create a geocache, these relays will be added as preferred relays for log submissions.
                  The first relay in the list will be the primary relay.
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                {geocachingRelays.map((relay, index) => (
                  <div key={relay} className="flex items-center gap-2 p-2 border rounded">
                    <span className="flex-1 text-sm font-mono">{relay}</span>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleMoveUp(index)}
                        disabled={index === 0}
                      >
                        ↑
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleMoveDown(index)}
                        disabled={index === geocachingRelays.length - 1}
                      >
                        ↓
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveRelay(relay)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <Label htmlFor="new-relay">Add Relay</Label>
                <div className="flex gap-2">
                  <Input
                    id="new-relay"
                    type="url"
                    placeholder="wss://relay.example.com"
                    value={newRelay}
                    onChange={(e) => setNewRelay(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddRelay();
                      }
                    }}
                    disabled={isValidating}
                  />
                  <Button
                    onClick={handleAddRelay}
                    disabled={isValidating}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    {isValidating ? "Validating..." : "Add"}
                  </Button>
                </div>
                <p className="text-sm text-gray-500">
                  Enter a WebSocket relay URL (must start with wss:// or ws://)
                </p>
              </div>

              <div className="pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={handleResetToDefaults}
                >
                  Reset to Defaults
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}