import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { MapPin, Plus, X, Globe, Palette, Sun, Moon, Monitor, Download, RefreshCw, Smartphone, Wifi } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InfoCard, DetailsCard } from "@/components/ui/card-patterns";
import { PageLayout } from "@/components/layout";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { LoginRequiredCard } from "@/components/LoginRequiredCard";
import { OfflineSettings } from "@/components/OfflineSettings";
import { CacheStatus } from "@/components/CacheStatus";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useToast } from "@/hooks/useToast";
import { usePWAUpdate } from "@/hooks/usePWAUpdate";
import { 
  getUserRelays, 
  saveUserRelays, 
  resetToDefaultRelays, 
  validateRelayUrl, 
  testRelayConnection,
  DEFAULT_RELAYS 
} from "@/lib/relayConfig";

export default function Settings() {
  const { user } = useCurrentUser();
  const { toast } = useToast();
  const { setTheme, theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const {
    isUpdateAvailable,
    isInstallable,
    isInstalling,
    isChecking,
    checkForUpdate,
    installUpdate,
    installPWA,
  } = usePWAUpdate();
  
  // Prevent hydration mismatch for theme
  useEffect(() => {
    setMounted(true);
  }, []);
  
  // Load saved relays from localStorage
  const [geocachingRelays, setGeocachingRelays] = useState<string[]>(() => getUserRelays());
  
  const [newRelay, setNewRelay] = useState("");
  const [isValidating, setIsValidating] = useState(false);

  // Save relays whenever they change
  useEffect(() => {
    saveUserRelays(geocachingRelays);
  }, [geocachingRelays]);

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
      const isReachable = await testRelayConnection(trimmedUrl);
      
      if (!isReachable) {
        throw new Error('Connection failed');
      }

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
    setGeocachingRelays(DEFAULT_RELAYS);
    toast({
      title: "Reset to defaults",
      description: "Your relay preferences have been reset to defaults",
    });
  };

  if (!user) {
    return (
      <PageLayout maxWidth="md" className="py-16">
        <LoginRequiredCard
          icon={MapPin}
          description="You need to be logged in to access settings."
          className="max-w-md mx-auto"
        />
      </PageLayout>
    );
  }

  return (
    <PageLayout maxWidth="2xl" background="muted">
      <div className="max-w-2xl mx-auto space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Settings</CardTitle>
              <CardDescription>
                Configure your app and geocaching preferences
              </CardDescription>
            </CardHeader>
          </Card>

          {/* PWA Update Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Smartphone className="h-5 w-5" />
                App Updates & Installation
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-3 flex-wrap justify-center">
                <Button
                  onClick={checkForUpdate}
                  disabled={isChecking}
                  variant="outline"
                >
                  {isChecking ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Checking...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Check for Updates
                    </>
                  )}
                </Button>

                {isUpdateAvailable && (
                  <Button
                    onClick={installUpdate}
                    disabled={isInstalling}
                    variant="default"
                  >
                    {isInstalling ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Installing...
                      </>
                    ) : (
                      <>
                        <Download className="h-4 w-4 mr-2" />
                        Install Update
                      </>
                    )}
                  </Button>
                )}

                {isInstallable && (
                  <Button
                    onClick={installPWA}
                    disabled={isInstalling}
                    variant="secondary"
                  >
                    {isInstalling ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Installing...
                      </>
                    ) : (
                      <>
                        <Download className="h-4 w-4 mr-2" />
                        Install App
                      </>
                    )}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5" />
                Appearance
              </CardTitle>
              <CardDescription>
                Choose the theme and appearance of the app
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="theme">Theme</Label>
                  <p className="text-sm text-muted-foreground mb-3">
                    Select the app theme. System follows your device's theme settings.
                  </p>
                  {mounted ? (
                    <div className="grid grid-cols-3 gap-3">
                      <Button
                        variant={theme === "light" ? "default" : "outline"}
                        onClick={() => setTheme("light")}
                        className="flex items-center gap-2 h-10 px-4"
                      >
                        <Sun className="h-4 w-4" />
                        <span className="text-sm">Light</span>
                      </Button>
                      <Button
                        variant={theme === "dark" ? "default" : "outline"}
                        onClick={() => setTheme("dark")}
                        className="flex items-center gap-2 h-10 px-4"
                      >
                        <Moon className="h-4 w-4" />
                        <span className="text-sm">Dark</span>
                      </Button>
                      <Button
                        variant={theme === "system" ? "default" : "outline"}
                        onClick={() => setTheme("system")}
                        className="flex items-center gap-2 h-10 px-4"
                      >
                        <Monitor className="h-4 w-4" />
                        <span className="text-sm">System</span>
                      </Button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-3">
                      <Button
                        variant="outline"
                        disabled
                        className="flex items-center gap-2 h-10 px-4"
                      >
                        <Sun className="h-4 w-4" />
                        <span className="text-sm">Light</span>
                      </Button>
                      <Button
                        variant="outline"
                        disabled
                        className="flex items-center gap-2 h-10 px-4"
                      >
                        <Moon className="h-4 w-4" />
                        <span className="text-sm">Dark</span>
                      </Button>
                      <Button
                        variant="outline"
                        disabled
                        className="flex items-center gap-2 h-10 px-4"
                      >
                        <Monitor className="h-4 w-4" />
                        <span className="text-sm">System</span>
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Offline Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wifi className="h-5 w-5" />
                Offline & Sync Settings
              </CardTitle>
              <CardDescription>
                Manage offline functionality and data synchronization
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <OfflineSettings />
              
              {/* Cache status and invalidation controls */}
              <CacheStatus />
            </CardContent>
          </Card>



          <DetailsCard title={
            <div className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Geocaching Relay Preferences
            </div>
          }>
            <CardDescription className="mb-4">
              Configure preferred relays for geocaching events. These relays will be included in your cache listings
              and used when querying for caches and logs. Relays are listed in order of preference.
            </CardDescription>
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
                <p className="text-sm text-muted-foreground">
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
            </DetailsCard>
        </div>
    </PageLayout>
  );
}