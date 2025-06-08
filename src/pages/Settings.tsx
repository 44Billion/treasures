import { useState, useEffect } from "react";
import { MapPin, Palette, Sun, Moon, Monitor, Wifi, Compass } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageLayout } from "@/components/layout";
import { Label } from "@/components/ui/label";
import { LoginRequiredCard } from "@/components/LoginRequiredCard";
import { OfflineSettings } from "@/components/OfflineSettings";
import { CacheStatus } from "@/components/CacheStatus";
import { RelaySelector } from "@/components/RelaySelector";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useRelayConfig } from "@/hooks/useRelayConfig";

export default function Settings() {
  const { user } = useCurrentUser();
  const { setTheme, theme } = useTheme();
  const { relayUrl } = useRelayConfig();
  const [mounted, setMounted] = useState(false);

  // Prevent hydration mismatch for theme
  useEffect(() => {
    setMounted(true);
  }, []);

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
                    Select the app theme. Adventure uses warm parchment colors perfect for geocaching. System follows your device's theme settings.
                  </p>
                  {mounted ? (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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
                        variant={theme === "adventure" ? "default" : "outline"}
                        onClick={() => setTheme("adventure")}
                        className="flex items-center gap-2 h-10 px-4"
                      >
                        <Compass className="h-4 w-4" />
                        <span className="text-sm">Adventure</span>
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
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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
                        <Compass className="h-4 w-4" />
                        <span className="text-sm">Adventure</span>
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



          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wifi className="h-5 w-5" />
                Relay Configuration
              </CardTitle>
              <CardDescription>
                Select the Nostr relay to use for geocaching data. This relay will be used for reading and publishing geocaches and logs.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Current Relay</Label>
                <RelaySelector className="w-full" />
                <p className="text-sm text-muted-foreground">
                  Currently using: <code className="text-xs bg-muted px-1 py-0.5 rounded">{relayUrl}</code>
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
    </PageLayout>
  );
}