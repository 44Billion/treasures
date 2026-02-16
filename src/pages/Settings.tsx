import { useState, useEffect } from "react";
import { Palette, Sun, Moon, Monitor, Wifi, Compass, Settings as SettingsIcon, Globe } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { useTranslation } from "react-i18next";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { PageLayout } from "@/components/PageLayout";
import { Label } from "../components/ui/label";

import { RelaySelector } from "../components/RelaySelector";
import { LanguageSelector } from "../components/LanguageSelector";
import { WotSettings } from "../components/WotSettings";

import { useRelayConfig } from "@/hooks/useRelayConfig";

export default function Settings() {
  const { setTheme, theme } = useTheme();
  const { relayUrl } = useRelayConfig();
  const { t } = useTranslation();
  const [mounted, setMounted] = useState(false);

  // Prevent hydration mismatch for theme
  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <PageLayout maxWidth="2xl" background="muted">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <SettingsIcon className="h-5 w-5" />
              {t('settings.title')}
            </CardTitle>
            <CardDescription>
              {t('settings.description')}
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Appearance Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5" />
              {t('settings.appearance.title')}
            </CardTitle>
            <CardDescription>
              {t('settings.appearance.description')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label htmlFor="theme">{t('settings.appearance.theme')}</Label>
                <p className="text-sm text-muted-foreground mb-3">
                  {t('settings.appearance.themeDescription')}
                </p>
                {mounted ? (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <Button
                      variant={theme === "light" ? "default" : "outline"}
                      onClick={() => setTheme("light")}
                      className="flex items-center gap-2 h-10 px-4"
                    >
                      <Sun className="h-4 w-4" />
                      <span className="text-sm">{t('settings.appearance.light')}</span>
                    </Button>
                    <Button
                      variant={theme === "dark" ? "default" : "outline"}
                      onClick={() => setTheme("dark")}
                      className="flex items-center gap-2 h-10 px-4"
                    >
                      <Moon className="h-4 w-4" />
                      <span className="text-sm">{t('settings.appearance.dark')}</span>
                    </Button>
                    <Button
                      variant={theme === "adventure" ? "default" : "outline"}
                      onClick={() => setTheme("adventure")}
                      className="flex items-center gap-2 h-10 px-4"
                    >
                      <Compass className="h-4 w-4" />
                      <span className="text-sm">{t('settings.appearance.adventure')}</span>
                    </Button>
                    <Button
                      variant={theme === "system" ? "default" : "outline"}
                      onClick={() => setTheme("system")}
                      className="flex items-center gap-2 h-10 px-4"
                    >
                      <Monitor className="h-4 w-4" />
                      <span className="text-sm">{t('settings.appearance.system')}</span>
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { icon: Sun, label: t('settings.appearance.light') },
                      { icon: Moon, label: t('settings.appearance.dark') },
                      { icon: Compass, label: t('settings.appearance.adventure') },
                      { icon: Monitor, label: t('settings.appearance.system') }
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

        {/* Language Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              {t('settings.language.title')}
            </CardTitle>
            <CardDescription>
              {t('settings.language.description')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label>{t('settings.language.label')}</Label>
                <div className="mt-2">
                  <LanguageSelector className="w-full" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Relay Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wifi className="h-5 w-5" />
              {t('settings.relay.title')}
            </CardTitle>
            <CardDescription>
              {t('settings.relay.description')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <Label>{t('settings.relay.currentRelay')}</Label>
              <RelaySelector className="w-full" />
              <div className="text-sm text-muted-foreground">
                {t('settings.relay.currentlyUsing')}: <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">{relayUrl}</code>
              </div>
            </div>
          </CardContent>
        </Card>



        {/* Web of Trust Settings */}
        <WotSettings />


      </div>
    </PageLayout>
  );
}