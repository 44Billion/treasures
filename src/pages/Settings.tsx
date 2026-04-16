import { useState, useEffect } from "react";
import { Palette, Sun, Moon, Monitor, Wifi, Compass, Settings as SettingsIcon, Globe, Wallet, Upload, ChevronDown } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { useTranslation } from "react-i18next";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../components/ui/collapsible";
import { PageLayout } from "@/components/PageLayout";
import { Label } from "../components/ui/label";

import { RelayListManager } from "../components/RelayListManager";
import { BlossomSettings } from "../components/BlossomSettings";
import { WalletSettings } from "../components/WalletSettings";
import { LanguageSelector } from "../components/LanguageSelector";
import { WotSettings } from "../components/WotSettings";


export default function Settings() {
  const { setTheme, theme } = useTheme();
  const { t } = useTranslation();
  const [mounted, setMounted] = useState(false);
  const [relaysOpen, setRelaysOpen] = useState(false);
  const [blossomOpen, setBlossomOpen] = useState(false);
  const [walletOpen, setWalletOpen] = useState(false);

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

        {/* Relay Configuration — Collapsible */}
        <Collapsible open={relaysOpen} onOpenChange={setRelaysOpen}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer select-none hover:bg-muted/50 transition-colors">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Wifi className="h-5 w-5" />
                    {t('settings.relay.title')}
                  </CardTitle>
                  <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform duration-200 ${relaysOpen ? 'rotate-180' : ''}`} />
                </div>
                <CardDescription>
                  {t('settings.relay.description')}
                </CardDescription>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent>
                <RelayListManager />
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Wallet Settings — Collapsible */}
        <Collapsible open={walletOpen} onOpenChange={setWalletOpen}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer select-none hover:bg-muted/50 transition-colors">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Wallet className="h-5 w-5" />
                    {t('wallet.title')}
                  </CardTitle>
                  <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform duration-200 ${walletOpen ? 'rotate-180' : ''}`} />
                </div>
                <CardDescription>
                  {t('wallet.description')}
                </CardDescription>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent>
                <WalletSettings />
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Blossom Servers — Collapsible */}
        <Collapsible open={blossomOpen} onOpenChange={setBlossomOpen}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer select-none hover:bg-muted/50 transition-colors">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Upload className="h-5 w-5" />
                    Blossom Servers
                  </CardTitle>
                  <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform duration-200 ${blossomOpen ? 'rotate-180' : ''}`} />
                </div>
                <CardDescription>
                  File upload servers for media hosting. Files are mirrored across all servers for redundancy.
                </CardDescription>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent>
                <BlossomSettings />
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Web of Trust Settings */}
        <WotSettings />

      </div>
    </PageLayout>
  );
}
