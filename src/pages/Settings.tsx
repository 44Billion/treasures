import { useState, useEffect } from "react";
import { Palette, Sun, Moon, Monitor, Wifi, Search, Compass, Settings as SettingsIcon, Globe, Wallet, Upload, ChevronDown, ShieldCheck } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { useActiveProfileTheme } from "@/hooks/useActiveProfileTheme";
import { useAppContext } from "@/hooks/useAppContext";
import { DittoIcon } from "@/components/icons/DittoIcon";
import { useTranslation } from "react-i18next";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../components/ui/collapsible";
import { PageLayout } from "@/components/PageLayout";
import { Label } from "../components/ui/label";
import { Switch } from "../components/ui/switch";

import { RelayListManager } from "../components/RelayListManager";
import { SearchRelaySettings } from "../components/SearchRelaySettings";
import { BlossomSettings } from "../components/BlossomSettings";
import { WalletSettings } from "../components/WalletSettings";
import { LanguageSelector } from "../components/LanguageSelector";
import { WotSettings } from "../components/WotSettings";


export default function Settings() {
  const { setTheme, theme } = useTheme();
  const { hasDittoTheme } = useActiveProfileTheme();
  const { config, updateConfig } = useAppContext();
  const { t } = useTranslation();
  const [mounted, setMounted] = useState(false);
  const [relaysOpen, setRelaysOpen] = useState(false);
  const [searchRelaysOpen, setSearchRelaysOpen] = useState(false);
  const [blossomOpen, setBlossomOpen] = useState(false);
  const [walletOpen, setWalletOpen] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);

  // Only surface the Privacy card when analytics is actually configured for this build.
  // In dev mode we always show it so the UI can be QA'd locally without env vars.
  const showPrivacyCard = Boolean(config.plausibleDomain) || import.meta.env.DEV;

  // Prevent hydration mismatch for theme
  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <PageLayout maxWidth="2xl" background="muted">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="px-1">
          <h1 className="flex items-center gap-2 text-lg font-semibold">
            <SettingsIcon className="h-5 w-5" />
            {t('settings.title')}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t('settings.description')}
          </p>
        </div>

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
                  <div className={`grid grid-cols-2 ${hasDittoTheme ? 'sm:grid-cols-5' : 'sm:grid-cols-4'} gap-3`}>
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
                    {hasDittoTheme && (
                      <Button
                        variant={theme === "ditto" ? "default" : "outline"}
                        onClick={() => setTheme("ditto")}
                        className="flex items-center gap-2 h-10 px-4"
                      >
                        <DittoIcon className="h-4 w-4" />
                        <span className="text-sm">{t('settings.appearance.ditto')}</span>
                      </Button>
                    )}
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

        {/* Search Relay Configuration — Collapsible */}
        <Collapsible open={searchRelaysOpen} onOpenChange={setSearchRelaysOpen}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer select-none hover:bg-muted/50 transition-colors">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Search className="h-5 w-5" />
                    {t('settings.searchRelays.title')}
                  </CardTitle>
                  <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform duration-200 ${searchRelaysOpen ? 'rotate-180' : ''}`} />
                </div>
                <CardDescription>
                  {t('settings.searchRelays.description')}
                </CardDescription>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent>
                <SearchRelaySettings />
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
                    {t('settings.blossom.title')}
                  </CardTitle>
                  <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform duration-200 ${blossomOpen ? 'rotate-180' : ''}`} />
                </div>
                <CardDescription>
                  {t('settings.blossom.description')}
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

        {/* Privacy — Analytics opt-out */}
        {showPrivacyCard ? (
          <Collapsible open={privacyOpen} onOpenChange={setPrivacyOpen}>
            <Card>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer select-none hover:bg-muted/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <ShieldCheck className="h-5 w-5" />
                      {t('settings.privacy.title')}
                    </CardTitle>
                    <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform duration-200 ${privacyOpen ? 'rotate-180' : ''}`} />
                  </div>
                  <CardDescription>
                    {t('settings.privacy.description')}
                  </CardDescription>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium">{t('settings.privacy.analyticsTitle')}</h3>
                    <div className="flex items-center gap-2">
                      <Label htmlFor="analytics-enabled" className="text-xs text-muted-foreground cursor-pointer">
                        {config.analyticsEnabled ? t('common.enabled') : t('common.disabled')}
                      </Label>
                      <Switch
                        id="analytics-enabled"
                        checked={config.analyticsEnabled}
                        onCheckedChange={(checked) =>
                          updateConfig((prev) => ({ ...prev, analyticsEnabled: checked }))
                        }
                        className="scale-90"
                      />
                    </div>
                  </div>
                  <div className="space-y-3 rounded-md border border-border/60 bg-muted/30 p-3 text-sm text-muted-foreground">
                    <p>
                      {t('settings.privacy.disclaimerBefore')}
                      <a
                        href="https://plausible.io/data-policy"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline hover:text-foreground"
                      >
                        {t('settings.privacy.disclaimerLink')}
                      </a>
                      {t('settings.privacy.disclaimerAfter')}
                    </p>
                    <p>
                      {t('settings.privacy.disclaimerPurpose')}
                    </p>
                    {config.plausibleDomain ? (
                      <p className="text-xs">
                        {config.plausibleEndpoint
                          ? t('settings.privacy.reportingToVia', { domain: config.plausibleDomain, endpoint: config.plausibleEndpoint })
                          : t('settings.privacy.reportingTo', { domain: config.plausibleDomain })}
                      </p>
                    ) : null}
                  </div>
                  {!config.analyticsEnabled ? (
                    <p className="text-xs text-muted-foreground">
                      {t('settings.privacy.reloadNotice')}
                    </p>
                  ) : null}
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        ) : null}

      </div>
    </PageLayout>
  );
}
