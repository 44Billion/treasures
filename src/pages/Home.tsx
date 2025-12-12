import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useAppContext } from "@/shared/hooks/useAppContext";
import { Link } from "react-router-dom";
import { MapPin, Plus, Search, Compass, Scroll, Crown, Shield, Users, Globe, ScanQrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FeatureCard } from "@/components/ui/card-patterns";
import { DesktopHeader } from "@/components/DesktopHeader";
import { LoginDialog } from "@/components/auth";
import SignupDialog from "@/components/auth/SignupDialog";
import { useCurrentUser } from "@/features/auth/hooks/useCurrentUser";
import { useGeocaches } from "@/features/geocache/hooks/useGeocaches";
import { GeocacheCard } from "@/components/ui/geocache-card";

import { RelayErrorFallback } from "@/components/RelayErrorFallback";

export default function Home() {
  const { t } = useTranslation();
  const { user } = useCurrentUser();
  const { config } = useAppContext();

  // Use geocaches with optimized loading
  const {
    data: geocaches,
    isLoading,
    isError,
    error,
    isStatsLoading,
    refetch: refresh
  } = useGeocaches();

  const [isRetrying, setIsRetrying] = useState(false);

  // Add a state to track initial page load for skeleton display
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // Set initial load to false after a short delay to show skeletons
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsInitialLoad(false);
    }, 1500); // Show skeletons for at least 1.5 seconds

    return () => clearTimeout(timer);
  }, []);

  // Debug skeleton state
  console.log('🏠 Home page loading state:', {
    isInitialLoad,
    isLoading,
    hasGeocaches: !!geocaches,
    geocacheCount: geocaches?.length || 0,
    shouldShowSkeletons: (isLoading || isInitialLoad) && !geocaches
  });

  const [loginDialogOpen, setLoginDialogOpen] = useState(false);
  const [signupDialogOpen, setSignupDialogOpen] = useState(false);

  // Responsive skeleton count to match grid layout
  // Mobile: 6 items (1 column), Tablet: 6 items (2 columns), Desktop: 6 items (3 columns)
  const getSkeletonCount = () => {
    if (typeof window === 'undefined') return 6; // SSR fallback
    const width = window.innerWidth;
    if (width < 768) return 6; // Mobile: show 6 skeletons (1 column)
    if (width < 1024) return 6; // Tablet: show 6 skeletons (2 columns, 3 rows)
    return 6; // Desktop: show 6 skeletons (3 columns, 2 rows)
  };

  const [skeletonCount, setSkeletonCount] = useState(getSkeletonCount);

  // Update skeleton count on window resize
  useEffect(() => {
    const handleResize = () => {
      setSkeletonCount(getSkeletonCount());
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleLoginSuccess = () => {
    setLoginDialogOpen(false);
    // Small delay to let the dialog close gracefully before showing the new button
    setTimeout(() => {}, 100);
  };

  const handleLoginClick = () => {
    setLoginDialogOpen(true);
  };

  const handleSignupClick = () => {
    setLoginDialogOpen(false);
    setSignupDialogOpen(true);
  };

  const handleSignupClose = () => {
    setSignupDialogOpen(false);
  };

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      await refresh();
    } finally {
      setIsRetrying(false);
    }
  };

  // Auto-refresh when relay changes
  useEffect(() => {
    refresh();
  }, [config.relayUrl, refresh]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50/60 via-emerald-50/50 to-teal-50/40 dark:from-slate-900 dark:via-green-950 dark:to-emerald-950 adventure:from-amber-100/80 adventure:via-yellow-50/60 adventure:to-orange-100/70">      <DesktopHeader />

      {/* Hero Section */}
      <section className="relative min-h-[calc(100vh-8rem)] md:min-h-0 flex items-center pt-4 pb-20 md:pt-16 md:pb-20 px-3 xs:px-4 md:py-24 overflow-hidden">
        {/* Parchment background for adventure mode only - behind everything */}
        <div className="absolute inset-0 hidden adventure:block" style={{
          backgroundImage: 'url(/parchment-300.jpg)',
          backgroundRepeat: 'repeat',
          backgroundSize: '300px 300px',
          opacity: 0.4
        }}></div>

        {/* Full-width top depth shadow with better fade - adventure mode only */}
        <div className="absolute top-0 left-0 right-0 h-16 adventure:bg-gradient-to-b adventure:from-black/20 adventure:via-black/12 adventure:via-black/6 adventure:via-black/3 adventure:via-black/1 adventure:to-transparent pointer-events-none"></div>
        {/* Full-width bottom depth shadow with better fade - adventure mode only */}
        <div className="absolute bottom-0 left-0 right-0 h-16 adventure:bg-gradient-to-t adventure:from-black/20 adventure:via-black/12 adventure:via-black/6 adventure:via-black/3 adventure:via-black/1 adventure:to-transparent pointer-events-none"></div>
        {/* Modern background elements (default and dark themes) */}
        <div className="absolute inset-0 flex justify-center adventure:hidden">
          <div className="relative w-full max-w-screen-2xl h-full">
            {/* Map markers - replacing dots */}
            <div className="absolute top-1/4 left-1/4 animate-pulse" style={{animationDelay: '0s'}}>
              <MapPin className="w-6 h-6 text-green-500 dark:text-emerald-400 opacity-70 drop-shadow-sm" />
            </div>
            <div className="absolute top-2/3 right-1/3 animate-pulse" style={{animationDelay: '1s'}}>
              <MapPin className="w-5 h-5 text-green-600 dark:text-emerald-300 opacity-65 drop-shadow-sm" />
            </div>
            <div className="absolute bottom-1/4 left-1/2 animate-pulse" style={{animationDelay: '2s'}}>
              <MapPin className="w-6 h-6 text-emerald-500 dark:text-emerald-400 opacity-60 drop-shadow-sm" />
            </div>
            <div className="absolute top-1/2 left-1/3 animate-pulse" style={{animationDelay: '0.5s'}}>
              <MapPin className="w-4 h-4 text-green-700 dark:text-emerald-500 opacity-55 drop-shadow-sm" />
            </div>
            <div className="absolute bottom-2/3 right-1/4 animate-pulse" style={{animationDelay: '1.5s'}}>
              <MapPin className="w-5 h-5 text-emerald-600 dark:text-emerald-300 opacity-65 drop-shadow-sm" />
            </div>

            {/* Globe-style curved grid lines */}
            <div className="absolute inset-0 pointer-events-none opacity-60">
              {/* Horizontal latitude lines - curved to appear like globe */}
              <svg className="absolute inset-0 w-full h-full opacity-60" viewBox="0 0 100 100" preserveAspectRatio="none">
                {/* Top latitude line */}
                <path
                  d="M 10,25 Q 50,22 90,25"
                  stroke="currentColor"
                  strokeWidth="0.4"
                  fill="none"
                  className="text-green-400/70 dark:text-emerald-400/90"
                />
                {/* Middle latitude line */}
                <path
                  d="M 5,50 Q 50,48 95,50"
                  stroke="currentColor"
                  strokeWidth="0.5"
                  fill="none"
                  className="text-green-500/80 dark:text-emerald-300"
                />
                {/* Bottom latitude line */}
                <path
                  d="M 10,75 Q 50,78 90,75"
                  stroke="currentColor"
                  strokeWidth="0.4"
                  fill="none"
                  className="text-green-400/70 dark:text-emerald-400/90"
                />

                {/* Vertical longitude lines - curved to show globe curvature */}
                <path
                  d="M 25,10 Q 22,50 25,90"
                  stroke="currentColor"
                  strokeWidth="0.3"
                  fill="none"
                  className="text-green-300/60 dark:text-emerald-500/80"
                />
                <path
                  d="M 50,5 Q 48,50 50,95"
                  stroke="currentColor"
                  strokeWidth="0.3"
                  fill="none"
                  className="text-green-400/70 dark:text-emerald-400/90"
                />
                <path
                  d="M 75,10 Q 78,50 75,90"
                  stroke="currentColor"
                  strokeWidth="0.3"
                  fill="none"
                  className="text-green-300/60 dark:text-emerald-500/80"
                />
              </svg>
            </div>

            {/* Subtle background texture - properly themed */}
          </div>
        </div>

        {/* Adventure theme background - quest-style treasure map elements */}
        <div className="absolute inset-0 hidden adventure:flex justify-center">
          <div className="relative w-full max-w-screen-2xl h-full" style={{ opacity: 0.4 }}>
            {/* Vintage compass roses - with darker parchment colors */}
            <div className="absolute top-1/4 left-1/4 animate-pulse" style={{animationDelay: '0s'}}>
              <Compass className="w-8 h-8 text-stone-700/80 opacity-85 drop-shadow-sm transform rotate-12" />
            </div>
            <div className="absolute top-2/3 right-1/3 animate-pulse" style={{animationDelay: '2s'}}>
              <Compass className="w-6 h-6 text-stone-800/70 opacity-80 drop-shadow-sm transform -rotate-45" />
            </div>
            <div className="absolute bottom-1/4 left-1/2 animate-pulse" style={{animationDelay: '1s'}}>
              <Compass className="w-7 h-7 text-stone-700/80 opacity-75 drop-shadow-sm transform rotate-90" />
            </div>
            <div className="absolute top-1/2 left-1/3 animate-pulse" style={{animationDelay: '1.5s'}}>
              <Compass className="w-5 h-5 text-stone-800/70 opacity-70 drop-shadow-sm transform -rotate-12" />
            </div>
            <div className="absolute bottom-2/3 right-1/4 animate-pulse" style={{animationDelay: '0.5s'}}>
              <Compass className="w-6 h-6 text-stone-800/80 opacity-80 drop-shadow-sm transform rotate-180" />
            </div>

            {/* Vintage map elements - hand-drawn treasure paths */}
            <div className="absolute inset-0 pointer-events-none">
              <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                {/* Meandering treasure paths - irregular, hand-drawn style */}
                <path
                  d="M 15,20 Q 25,18 35,22 T 55,25 Q 65,28 75,24 T 90,28"
                  stroke="currentColor"
                  strokeWidth="0.4"
                  fill="none"
                  strokeDasharray="2,1"
                  className="text-stone-600/60"
                />
                <path
                  d="M 10,45 Q 20,42 30,48 T 50,52 Q 60,55 70,50 T 85,53"
                  stroke="currentColor"
                  strokeWidth="0.3"
                  fill="none"
                  strokeDasharray="1.5,0.5"
                  className="text-stone-700/50"
                />
                <path
                  d="M 20,70 Q 30,68 40,72 T 60,75 Q 70,78 80,74"
                  stroke="currentColor"
                  strokeWidth="0.4"
                  fill="none"
                  strokeDasharray="2,1"
                  className="text-stone-600/55"
                />

                {/* Vertical treasure routes - winding paths */}
                <path
                  d="M 25,15 Q 22,25 28,35 T 25,55 Q 22,65 28,75 T 25,85"
                  stroke="currentColor"
                  strokeWidth="0.3"
                  fill="none"
                  strokeDasharray="1,0.5"
                  className="text-stone-800/45"
                />
                <path
                  d="M 50,10 Q 48,20 52,30 T 50,50 Q 48,60 52,70 T 50,90"
                  stroke="currentColor"
                  strokeWidth="0.4"
                  fill="none"
                  strokeDasharray="1.5,1"
                  className="text-stone-700/55"
                />
                <path
                  d="M 75,12 Q 78,22 72,32 T 75,52 Q 78,62 72,72 T 75,88"
                  stroke="currentColor"
                  strokeWidth="0.3"
                  fill="none"
                  strokeDasharray="1,0.5"
                  className="text-stone-800/45"
                />
              </svg>
            </div>


          </div>
        </div>

        <div className="container mx-auto text-center relative flex-1 flex flex-col justify-center md:block">
          <div className="mb-6 animate-fade-in">
            <Link to="/install" className="inline-flex flex-col items-center gap-0.5 bg-green-100 dark:bg-green-900 adventure:bg-[#4682B4] text-green-700 dark:text-green-300 adventure:text-white px-4 py-1.5 rounded-full text-base adventure:text-[16px] font-medium hover:bg-green-200 dark:hover:bg-green-800 adventure:hover:bg-stone-700 transition-colors">
              <div className="flex items-center gap-2">
                <Compass className="w-4 h-4" />
                <span className="adventure:hidden">{t("home.install.badge")}</span>
                <span className="hidden adventure:inline">{t("home.install.badgeAdventure")}</span>
              </div>
              <span className="text-[10px] adventure:text-[12px] opacity-75 leading-none">
                <span className="adventure:hidden">{t("home.install.subtitle")}</span>
                <span className="hidden adventure:inline">{t("home.install.subtitleAdventure")}</span>
              </span>
            </Link>
          </div>

          <h2 className="adventure:text-4xl text-2xl xs:text-3xl md:text-5xl adventure:xs:text-5xl adventure:md:text-7xl font-bold text-foreground mb-4 md:mb-6 animate-slide-up">
            <span className="adventure:hidden">{t("home.hero.title1")}</span>
            <span className="hidden adventure:inline">{t("home.hero.title1Adventure")}</span>
            <span className="relative inline-block mx-2">
              <span className="text-green-600 adventure:text-stone-800">
                <span className="adventure:hidden">{t("home.hero.title2")}</span>
                <span className="hidden adventure:inline">{t("home.hero.title2Adventure")}</span>
              </span>
              <span className="absolute -bottom-2 left-0 w-full h-1 bg-gradient-to-r from-green-400 to-green-600 adventure:from-stone-600 adventure:to-stone-800 transform scale-x-0 animate-expand-line"></span>
            </span>
          </h2>

          <p className="text-md xs:text-sm md:text-xl text-stone-600 dark:text-stone-400 mb-6 md:mb-8 max-w-2xl mx-auto animate-slide-up-delay whitespace-pre-line">
            <span className="adventure:hidden">{t("home.hero.description")}</span>
            <span className="hidden adventure:inline">{t("home.hero.descriptionAdventure")}</span>
          </p>

          <div className="flex flex-col sm:flex-row gap-2 xs:gap-3 md:gap-4 justify-center animate-slide-up-delay-2">
            <Link to="/map" className="flex-1 sm:flex-initial group">
              <Button size="lg" className="bg-green-600 hover:bg-green-700 adventure:bg-stone-700 adventure:hover:bg-stone-800 adventure:text-stone-100 w-full sm:w-auto transform transition-all duration-200 hover:scale-105 hover:shadow-lg text-sm xs:text-base adventure:text-base adventure:xs:text-lg px-4 xs:px-6">
                <Search className="h-5 w-5 mr-1 xs:mr-2 transition-transform group-hover:scale-110 adventure:hidden" />
                <Compass className="h-5 w-5 mr-1 xs:mr-2 transition-transform group-hover:scale-110 hidden adventure:inline" />
                <span className="adventure:hidden">
                  <span className="hidden xs:inline">{t("home.cta.explore")}</span>
                  <span className="xs:hidden">{t("home.cta.exploreShort")}</span>
                </span>
                <span className="hidden adventure:inline">
                  <span className="hidden xs:inline">{t("home.cta.exploreAdventure")}</span>
                  <span className="xs:hidden">{t("home.cta.exploreAdventureShort")}</span>
                </span>
              </Button>
            </Link>
            <Link to="/claim" className="flex-1 sm:flex-initial group">
              <Button size="lg" variant="outline" className="w-full sm:w-auto border-green-200 dark:border-green-800 adventure:border-stone-400 hover:border-green-300 dark:hover:border-green-700 adventure:hover:border-stone-500 hover:bg-green-50 dark:hover:bg-green-950 adventure:hover:bg-stone-200 adventure:hover:text-stone-800 transform transition-all duration-200 hover:scale-105 text-sm xs:text-base adventure:text-base adventure:xs:text-lg px-4 xs:px-6">
                <ScanQrCode className="h-5 w-5 mr-1 xs:mr-2 transition-transform group-hover:scale-110 adventure:hidden" />
                <Scroll className="h-5 w-5 mr-1 xs:mr-2 transition-transform group-hover:scale-110 hidden adventure:inline" />
                <span className="adventure:hidden">
                  <span className="hidden xs:inline">{t("home.cta.claim")}</span>
                  <span className="xs:hidden">{t("home.cta.claimShort")}</span>
                </span>
                <span className="hidden adventure:inline">
                  <span className="hidden xs:inline">{t("home.cta.claimAdventure")}</span>
                  <span className="xs:hidden">{t("home.cta.claimShort")}</span>
                </span>
              </Button>
            </Link>
            {user ? (
              <Link to="/create" className="flex-1 sm:flex-initial group">
                <Button size="lg" variant="outline" className="w-full sm:w-auto border-green-200 dark:border-green-800 adventure:border-stone-400 hover:border-green-300 dark:hover:border-green-700 adventure:hover:border-stone-500 hover:bg-green-50 dark:hover:bg-green-950 adventure:hover:bg-stone-200 adventure:hover:text-stone-800 transform transition-all duration-200 hover:scale-105 animate-fade-in text-sm xs:text-base adventure:text-base adventure:xs:text-lg px-4 xs:px-6">
                  <Plus className="h-5 w-5 mr-1 xs:mr-2 transition-transform group-hover:rotate-90 adventure:hidden" />
                  <Crown className="h-5 w-5 mr-1 xs:mr-2 transition-transform group-hover:rotate-12 hidden adventure:inline" />
                  <span className="adventure:hidden">
                    <span className="hidden xs:inline">{t("home.cta.hide")}</span>
                    <span className="xs:hidden">{t("home.cta.hideShort")}</span>
                  </span>
                  <span className="hidden adventure:inline">
                    <span className="hidden xs:inline">{t("home.cta.hideAdventure")}</span>
                    <span className="xs:hidden">{t("home.cta.hideAdventureShort")}</span>
                  </span>
                </Button>
              </Link>
            ) : (
              <Button
                size="lg"
                variant="outline"
                className="w-full sm:w-auto border-green-200 dark:border-green-800 adventure:border-stone-400 hover:border-green-300 dark:hover:border-green-700 adventure:hover:border-stone-500 hover:bg-green-50 dark:hover:bg-green-950 adventure:hover:bg-stone-200 adventure:hover:text-stone-800 transform transition-all duration-200 hover:scale-105 group text-sm xs:text-base adventure:text-base adventure:xs:text-lg px-4 xs:px-6"
                onClick={handleLoginClick}
              >
                <Plus className="h-4 w-4 xs:h-5 xs:w-5 mr-1 xs:mr-2 transition-transform group-hover:rotate-12 adventure:hidden" />
                <Shield className="h-4 w-4 xs:h-5 xs:w-5 mr-1 xs:mr-2 transition-transform group-hover:rotate-12 hidden adventure:inline" />
                <span className="adventure:hidden">
                  <span className="hidden xs:inline">{t("home.cta.login")}</span>
                  <span className="xs:hidden">{t("home.cta.loginShort")}</span>
                </span>
                <span className="hidden adventure:inline">
                  <span className="hidden xs:inline">{t("home.cta.loginAdventure")}</span>
                  <span className="xs:hidden">{t("home.cta.loginAdventureShort")}</span>
                </span>
              </Button>
            )}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-8 xs:py-14 md:py-16 px-3 xs:px-4 bg-background border-t">
        <div className="container mx-auto">
          <h3 className="text-2xl md:text-3xl adventure:text-3xl adventure:md:text-4xl font-bold text-center mb-8 md:mb-12 text-foreground">
            <span className="adventure:hidden">{t("home.features.title")}</span>
            <span className="hidden adventure:inline">{t("home.features.titleAdventure")}</span>
          </h3>
          <div className="grid gap-6 md:grid-cols-3 md:gap-8">
            <FeatureCard
              icon={Shield}
              title={
                <span>
                  <span className="adventure:hidden">{t("home.features.decentralized.title")}</span>
                  <span className="hidden adventure:inline">{t("home.features.decentralized.titleAdventure")}</span>
                </span>
              }
              description={
                <span>
                  <span className="adventure:hidden">{t("home.features.decentralized.description")}</span>
                  <span className="hidden adventure:inline">{t("home.features.decentralized.descriptionAdventure")}</span>
                </span>
              }
              iconColor="text-green-600 adventure:text-stone-700"
              centered={true}
            />
            <FeatureCard
              icon={Users}
              title={
                <span>
                  <span className="adventure:hidden">{t("home.features.community.title")}</span>
                  <span className="hidden adventure:inline">{t("home.features.community.titleAdventure")}</span>
                </span>
              }
              description={
                <span>
                  <span className="adventure:hidden">{t("home.features.community.description")}</span>
                  <span className="hidden adventure:inline">{t("home.features.community.descriptionAdventure")}</span>
                </span>
              }
              iconColor="text-green-600 adventure:text-stone-700"
              centered={true}
            />
            <FeatureCard
              icon={Globe}
              title={
                <span>
                  <span className="adventure:hidden">{t("home.features.global.title")}</span>
                  <span className="hidden adventure:inline">{t("home.features.global.titleAdventure")}</span>
                </span>
              }
              description={
                <span>
                  <span className="adventure:hidden">{t("home.features.global.description")}</span>
                  <span className="hidden adventure:inline">{t("home.features.global.descriptionAdventure")}</span>
                </span>
              }
              iconColor="text-green-600 adventure:text-stone-700"
              centered={true}
            />
          </div>
        </div>
      </section>

      {/* Recent Caches */}
      <section className="py-6 xs:py-12 md:py-16 px-3 xs:px-4 bg-gradient-to-b from-background to-muted/30">
        <div className="container mx-auto">
          {/* Section Header */}
          <div className="text-center mb-8 md:mb-12">
            <h3 className="text-2xl md:text-3xl adventure:text-3xl adventure:md:text-4xl font-bold text-foreground mb-3">
              <span className="adventure:hidden">{t("home.recent.title")}</span>
              <span className="hidden adventure:inline">{t("home.recent.titleAdventure")}</span>
            </h3>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              <span className="adventure:hidden">{t("home.recent.description")}</span>
              <span className="hidden adventure:inline">{t("home.recent.descriptionAdventure")}</span>
            </p>

            {/* Action buttons */}
            <div className="flex items-center justify-center gap-3 mt-6">
              <Link to="/map">
                <Button variant="outline" className="flex items-center gap-2">
                  <Search className="h-4 w-4 adventure:hidden" />
                  <Compass className="h-4 w-4 hidden adventure:inline" />
                  <span className="adventure:hidden">{t("home.recent.exploreAll")}</span>
                  <span className="hidden adventure:inline">{t("home.recent.exploreAllAdventure")}</span>
                </Button>
              </Link>
            </div>
          </div>

          {(isLoading || isInitialLoad) ? (
            // Show skeleton cards during loading
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: skeletonCount }).map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-slate-200 dark:bg-slate-700 rounded-full"></div>
                      <div className="flex-1 space-y-3">
                        <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4"></div>
                        <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/2"></div>
                        <div className="space-y-2">
                          <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-full"></div>
                          <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-2/3"></div>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex gap-2">
                            <div className="h-5 w-6 bg-slate-200 dark:bg-slate-700 rounded"></div>
                            <div className="h-5 w-6 bg-slate-200 dark:bg-slate-700 rounded"></div>
                            <div className="h-5 w-8 bg-slate-200 dark:bg-slate-700 rounded"></div>
                          </div>
                          <div className="flex gap-2">
                            <div className="h-4 w-4 bg-slate-200 dark:bg-slate-700 rounded"></div>
                            <div className="h-4 w-4 bg-slate-200 dark:bg-slate-700 rounded"></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : isError ? (
            // Show error state
            <RelayErrorFallback
              error={error}
              onRetry={handleRetry}
              isRetrying={isRetrying}
            />
          ) : (
            // Show actual content
            <>
              {/* Featured Grid Layout */}
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {geocaches.slice(0, 6).map((geocache) => (
                  <GeocacheCard
                    key={geocache.id}
                    cache={geocache}
                    variant="featured"
                    statsLoading={isStatsLoading}
                  />
                ))}
              </div>

              {/* Mobile view all button */}
              <div className="mt-8 text-center sm:hidden">
                <Link to="/map">
                  <Button variant="outline" className="w-full">
                    <Search className="h-4 w-4 mr-2 adventure:hidden" />
                    <Compass className="h-4 w-4 mr-2 hidden adventure:inline" />
                    <span className="adventure:hidden">{t("home.recent.viewAll")}</span>
                    <span className="hidden adventure:inline">{t("home.recent.viewAllAdventure")}</span>
                  </Button>
                </Link>
              </div>
            </>
          )}
        </div>
      </section>

      {/* Login and Signup Dialogs */}
      <LoginDialog
        isOpen={loginDialogOpen}
        onClose={() => setLoginDialogOpen(false)}
        onLogin={handleLoginSuccess}
        onSignup={handleSignupClick}
      />
      <SignupDialog
        isOpen={signupDialogOpen}
        onClose={handleSignupClose}
      />
    </div>
  );
}