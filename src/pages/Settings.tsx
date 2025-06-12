import { useState, useEffect } from "react";
import { MapPin, Palette, Sun, Moon, Monitor, Wifi, Compass, Settings as SettingsIcon, Smartphone } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageLayout } from "@/components/layout";
import { Label } from "@/components/ui/label";
import { LoginRequiredCard } from "@/components/LoginRequiredCard";
import { OfflineSettings } from "@/components/OfflineSettings";
import { RelaySelector } from "@/components/RelaySelector";
import { PWASettings } from "@/components/PWASettings";
import { useCurrentUser } from "@/features/auth/hooks/useCurrentUser";
import { useRelayConfig } from "@/features/geocache/hooks/useRelayConfig";

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
        {/* Header */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <SettingsIcon className="h-5 w-5" />
              Settings
            </CardTitle>
            <CardDescription>
              Configure your app preferences and geocaching settings
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Appearance Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5" />
              Appearance
            </CardTitle>
            <CardDescription>
              Choose your preferred theme and visual style
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label htmlFor="theme">Theme</Label>
                <p className="text-sm text-muted-foreground mb-3">
                  Adventure theme uses warm parchment colors perfect for geocaching. System follows your device settings.
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
                    {[
                      { icon: Sun, label: "Light" },
                      { icon: Moon, label: "Dark" },
                      { icon: Compass, label: "Adventure" },
                      { icon: Monitor, label: "System" }
                    ].map(({ icon: Icon, label }) => (
                      <Button
                        key={label}
                        variant="outline"
                        disabled
                        className="flex items-center gap-2 h-10 px-4"
                      >
                        <Icon className="h-4 w-4" />
                        <span className="text-sm">{label}</span>
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Relay Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wifi className="h-5 w-5" />
              Relay Configuration
            </CardTitle>
            <CardDescription>
              Select the Nostr relay for geocaching data. Used for reading and publishing geocaches and logs.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <Label>Current Relay</Label>
              <RelaySelector className="w-full" />
              <div className="text-sm text-muted-foreground">
                Currently using: <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">{relayUrl}</code>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* PWA Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5" />
              App & Updates
            </CardTitle>
            <CardDescription>
              Manage app installation and updates
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PWASettings />
          </CardContent>
        </Card>

        {/* Offline & Sync Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wifi className="h-5 w-5" />
              Offline & Sync
            </CardTitle>
            <CardDescription>
              Manage offline functionality and data synchronization
            </CardDescription>
          </CardHeader>
          <CardContent>
            <OfflineSettings />
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  );
}