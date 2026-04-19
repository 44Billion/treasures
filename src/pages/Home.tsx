import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useAppContext } from "@/hooks/useAppContext";
import { Link } from "react-router-dom";
import { Search, Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DesktopHeader } from "@/components/DesktopHeader";
import { LoginDialog } from "@/components/auth";
import SignupDialog from "@/components/auth/SignupDialog";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useGeocaches } from "@/hooks/useGeocaches";
import { GeocacheCard } from "@/components/ui/geocache-card";
import { HeroGallery } from "@/components/HeroGallery";
import { useRadarOverlay } from "@/hooks/useRadarOverlay";

import { RelayErrorFallback } from "@/components/RelayErrorFallback";

export default function Home() {
  const { t } = useTranslation();
  const { user } = useCurrentUser();
  const { config } = useAppContext();
  const { open: openRadar } = useRadarOverlay();

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
  }, [config.relayMetadata, refresh]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50/60 via-emerald-50/50 to-teal-50/40 dark:from-background dark:via-primary-50 dark:to-background adventure:from-amber-100/80 adventure:via-yellow-50/60 adventure:to-orange-100/70">
      <DesktopHeader variant="hero" />

      {/* Hero Section — full-bleed rotating photo gallery */}
      <section className="relative min-h-dvh lg:min-h-0 lg:h-[60vh] lg:-mt-[81px] flex items-center lg:items-end overflow-hidden">
        {/* Rotating background images + grain */}
        <HeroGallery />

        {/* Decorative overlay — simplified on mobile, full on desktop */}
        {/* Mobile: same desktop paths without the drift animation */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none opacity-[0.18] z-[1] md:hidden"
          viewBox="0 0 200 100"
          preserveAspectRatio="xMidYMid slice"
          aria-hidden="true"
        >
          <path d="M -5,20 C 15,10 30,12 50,22 C 70,32 85,8 110,16 C 135,24 155,12 180,20 C 195,24 200,18 210,20" stroke="white" strokeWidth="1.2" fill="none" strokeDasharray="4,3" strokeLinecap="round" />
          <path d="M -5,48 C 10,38 25,36 45,46 C 65,56 80,34 105,42 C 130,50 145,36 170,44 C 190,50 200,42 210,46" stroke="white" strokeWidth="1" fill="none" strokeDasharray="3,4" strokeLinecap="round" />
          <path d="M -5,78 C 20,68 40,70 60,80 C 80,90 95,64 120,72 C 145,80 160,68 180,76 C 195,82 200,74 210,78" stroke="white" strokeWidth="1.2" fill="none" strokeDasharray="4,3" strokeLinecap="round" />
          <path d="M 10,105 C 25,88 35,72 50,60 C 65,48 80,40 95,30 C 110,20 130,8 155,-5" stroke="white" strokeWidth="0.9" fill="none" strokeDasharray="3,3" strokeLinecap="round" />
          <path d="M 175,105 C 165,88 155,74 140,62 C 128,52 118,44 108,36 C 98,28 88,18 78,-5" stroke="white" strokeWidth="0.9" fill="none" strokeDasharray="3,3" strokeLinecap="round" />
          <path d="M -5,5 C 10,16 22,28 36,40 C 50,52 62,64 76,76 C 88,86 100,96 115,105" stroke="white" strokeWidth="0.9" fill="none" strokeDasharray="3,3" strokeLinecap="round" />
          <g stroke="white" strokeWidth="1.5" strokeLinecap="round">
            <line x1="137" y1="5" x2="143" y2="11" />
            <line x1="143" y1="5" x2="137" y2="11" />
            <line x1="28" y1="14" x2="34" y2="20" />
            <line x1="34" y1="14" x2="28" y2="20" />
            <line x1="158" y1="48" x2="164" y2="54" />
            <line x1="164" y1="48" x2="158" y2="54" />
            <line x1="42" y1="76" x2="48" y2="82" />
            <line x1="48" y1="76" x2="42" y2="82" />
          </g>
          <circle cx="50" cy="22" r="1.8" fill="none" stroke="white" strokeWidth="0.8" />
          <circle cx="45" cy="46" r="1.8" fill="none" stroke="white" strokeWidth="0.8" />
          <circle cx="120" cy="72" r="1.8" fill="none" stroke="white" strokeWidth="0.8" />
          <circle cx="95" cy="30" r="1.5" fill="none" stroke="white" strokeWidth="0.8" />
          <circle cx="140" cy="62" r="1.5" fill="none" stroke="white" strokeWidth="0.8" />
        </svg>

        {/* Desktop: full drifting pattern (5 paths, 4 X marks, 5 circles) */}
        <div className="absolute inset-0 pointer-events-none z-[1] hero-overlay-drift hidden md:block">
          <svg className="absolute inset-0 w-full h-full opacity-[0.18]" viewBox="0 0 200 100" preserveAspectRatio="xMidYMid slice">
            <path d="M -5,20 C 15,10 30,12 50,22 C 70,32 85,8 110,16 C 135,24 155,12 180,20 C 195,24 200,18 210,20" stroke="white" strokeWidth="1.2" fill="none" strokeDasharray="4,3" strokeLinecap="round" />
            <path d="M -5,48 C 10,38 25,36 45,46 C 65,56 80,34 105,42 C 130,50 145,36 170,44 C 190,50 200,42 210,46" stroke="white" strokeWidth="1" fill="none" strokeDasharray="3,4" strokeLinecap="round" />
            <path d="M -5,78 C 20,68 40,70 60,80 C 80,90 95,64 120,72 C 145,80 160,68 180,76 C 195,82 200,74 210,78" stroke="white" strokeWidth="1.2" fill="none" strokeDasharray="4,3" strokeLinecap="round" />
            <path d="M 10,105 C 25,88 35,72 50,60 C 65,48 80,40 95,30 C 110,20 130,8 155,-5" stroke="white" strokeWidth="0.9" fill="none" strokeDasharray="3,3" strokeLinecap="round" />
            <path d="M 175,105 C 165,88 155,74 140,62 C 128,52 118,44 108,36 C 98,28 88,18 78,-5" stroke="white" strokeWidth="0.9" fill="none" strokeDasharray="3,3" strokeLinecap="round" />
            <path d="M -5,25 C 10,34 22,44 36,54 C 50,64 62,74 76,84 C 88,92 100,100 115,105" stroke="white" strokeWidth="0.9" fill="none" strokeDasharray="3,3" strokeLinecap="round" />
            <g stroke="white" strokeWidth="1.5" strokeLinecap="round">
              <line x1="137" y1="5" x2="143" y2="11" />
              <line x1="143" y1="5" x2="137" y2="11" />
              <line x1="28" y1="14" x2="34" y2="20" />
              <line x1="34" y1="14" x2="28" y2="20" />
              <line x1="158" y1="48" x2="164" y2="54" />
              <line x1="164" y1="48" x2="158" y2="54" />
              <line x1="42" y1="76" x2="48" y2="82" />
              <line x1="48" y1="76" x2="42" y2="82" />
            </g>
            <circle cx="50" cy="22" r="1.8" fill="none" stroke="white" strokeWidth="0.8" />
            <circle cx="45" cy="46" r="1.8" fill="none" stroke="white" strokeWidth="0.8" />
            <circle cx="120" cy="72" r="1.8" fill="none" stroke="white" strokeWidth="0.8" />
            <circle cx="95" cy="30" r="1.5" fill="none" stroke="white" strokeWidth="0.8" />
            <circle cx="140" cy="62" r="1.5" fill="none" stroke="white" strokeWidth="0.8" />
          </svg>
        </div>

        {/* Content overlay — pinned to bottom */}
        <div className="relative z-10 w-full pb-10 md:pb-14 pt-[4.5rem] md:pt-24">
          <div className="container mx-auto text-center px-3 xs:px-4">
            <img
              src="/icon.svg"
              alt="Treasures"
              className="h-36 w-36 xs:h-40 xs:w-40 sm:h-64 sm:w-64 md:h-72 md:w-72 mx-auto mb-4 md:mb-6 drop-shadow-lg animate-slide-up"
            />
            <h2 className="text-2xl xs:text-3xl md:text-5xl font-bold text-white mb-3 md:mb-5 animate-slide-up [text-shadow:0_2px_8px_rgba(0,0,0,0.5)]">
              {t("home.hero.title1")}
              <span className="relative inline-block mx-2">
                <span className="text-green-300 adventure:text-amber-300">
                  {t("home.hero.title2")}
                </span>
                <span className="absolute -bottom-2 left-0 w-full h-1 bg-green-400 adventure:bg-amber-400 transform scale-x-0 animate-expand-line"></span>
              </span>
            </h2>

            <p className="text-base xs:text-lg md:text-xl text-white/90 font-medium mb-6 md:mb-8 max-w-2xl mx-auto animate-slide-up-delay whitespace-pre-line [text-shadow:0_2px_6px_rgba(0,0,0,0.4)]">
              <span className="hidden md:inline">{t("home.hero.description").split("\n")[0]}{"\n"}</span>
              {t("home.hero.description").split("\n")[1]}
            </p>

            {/* Primary CTAs */}
            <div className="flex flex-col md:flex-row items-stretch md:items-center w-full max-w-sm md:max-w-none md:w-auto mx-auto gap-2 xs:gap-3 md:gap-4 justify-center animate-slide-up-delay-2">
              <Link to="/map" className="group">
                <Button size="lg" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground transform transition-all duration-200 hover:scale-105 hover:shadow-lg text-sm xs:text-base px-4 xs:px-6">
                  <Search className="h-5 w-5 mr-1 xs:mr-2 transition-transform group-hover:scale-110" />
                  <span className="hidden xs:inline">{t("home.cta.explore")}</span>
                  <span className="xs:hidden">{t("home.cta.exploreShort")}</span>
                </Button>
              </Link>
              <Button
                size="lg"
                variant="outline"
                className="w-full md:w-auto bg-black/30 border-white/60 text-white hover:bg-black/30 hover:border-green-400 hover:text-green-300 adventure:hover:border-amber-400 adventure:hover:text-amber-300 transform transition-all duration-200 hover:scale-105 group text-sm xs:text-base px-4 xs:px-6 backdrop-blur-sm"
                onClick={openRadar}
              >
                <Compass className="h-5 w-5 mr-1 xs:mr-2 transition-transform group-hover:rotate-45" />
                <span className="hidden xs:inline">{t("home.cta.compass")}</span>
                <span className="xs:hidden">{t("home.cta.compassShort")}</span>
              </Button>
            </div>

            {/* Secondary links */}
            <div className="flex items-center justify-center gap-1 text-sm text-white/70 animate-slide-up-delay-2 mt-3 [text-shadow:0_1px_4px_rgba(0,0,0,0.4)]">
              <Link to="/claim" className="hover:text-white transition-colors">
                {t("home.cta.claimLink")}
              </Link>
              <span className="text-white/40 mx-1">·</span>
              {user ? (
                <Link to="/create" className="hover:text-white transition-colors">
                  {t("home.cta.hideLink")}
                </Link>
              ) : (
                <button
                  onClick={handleLoginClick}
                  className="hover:text-white transition-colors"
                >
                  {t("home.cta.hideLink")}
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* How It Works — zig-zag layout with feature images */}
      <section className="relative py-12 xs:py-16 md:py-20 px-3 xs:px-4 overflow-hidden">
        {/* Smooth gradient fade from hero section */}
        <div className="absolute inset-0 bg-gradient-to-b from-muted/20 via-muted/10 to-transparent pointer-events-none"></div>

        {/* Dotted trail connecting steps — treasure map style */}
        <div className="absolute inset-0 pointer-events-none flex justify-center">
          <div className="relative w-full max-w-3xl h-full">
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
              <path
                d="M 30,18 C 30,28 70,32 70,46 C 70,60 30,62 30,78"
                stroke="currentColor"
                strokeWidth="0.4"
                fill="none"
                strokeDasharray="2,1.5"
                strokeLinecap="round"
                className="text-green-500/30 dark:text-green-400/20 adventure:text-amber-600/30"
              />
            </svg>
          </div>
        </div>

        <div className="container mx-auto max-w-3xl relative z-10">
          {/* Section header */}
          <div className="text-center mb-10 md:mb-14">
            <h3 className="text-2xl md:text-3xl font-bold text-foreground mb-3">
              {t("home.howItWorks.title")}
            </h3>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              {t("home.howItWorks.description")}
            </p>
          </div>

          {/* Zig-zag layout */}
          <div className="space-y-12 md:space-y-20">
            {/* Step 1: Hide — Image Left */}
            <div className="flex flex-row items-center gap-4 md:gap-10">
              <div className="w-5/12 flex justify-center">
                <div className="w-32 h-32 sm:w-40 sm:h-40 md:w-48 md:h-48 bg-gradient-to-br from-green-100 to-emerald-200 dark:from-primary-200 dark:to-primary-100 adventure:from-amber-100 adventure:to-orange-200 rounded-2xl p-4 sm:p-5 md:p-6 shadow-md border border-green-200/60 dark:border-primary/20 adventure:border-amber-300/60">
                  <img src="/step_1.png" alt="Hide a Treasure" className="w-full h-full object-contain mix-blend-multiply dark:mix-blend-normal dark:invert adventure:sepia" />
                </div>
              </div>
              <div className="w-7/12 text-left space-y-2 md:space-y-3">
                <h4 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground">
                  {t("home.howItWorks.step1.title")}
                </h4>
                <p className="text-muted-foreground text-sm sm:text-base md:text-lg leading-relaxed">
                  {t("home.howItWorks.step1.description")}
                </p>
              </div>
            </div>

            {/* Step 2: Find — Image Right */}
            <div className="flex flex-row-reverse items-center gap-4 md:gap-10">
              <div className="w-5/12 flex justify-center">
                <div className="w-32 h-32 sm:w-40 sm:h-40 md:w-48 md:h-48 bg-gradient-to-br from-emerald-100 to-teal-200 dark:from-primary-100 dark:to-primary-200 adventure:from-yellow-100 adventure:to-amber-200 rounded-2xl p-4 sm:p-5 md:p-6 shadow-md border border-emerald-200/60 dark:border-primary/20 adventure:border-amber-300/60">
                  <img src="/step_2.png" alt="Find & Claim" className="w-full h-full object-contain mix-blend-multiply dark:mix-blend-normal dark:invert adventure:sepia" />
                </div>
              </div>
              <div className="w-7/12 text-left space-y-2 md:space-y-3">
                <h4 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground">
                  {t("home.howItWorks.step2.title")}
                </h4>
                <p className="text-muted-foreground text-sm sm:text-base md:text-lg leading-relaxed">
                  {t("home.howItWorks.step2.description")}
                </p>
              </div>
            </div>

            {/* Step 3: Share — Image Left */}
            <div className="flex flex-row items-center gap-4 md:gap-10">
              <div className="w-5/12 flex justify-center">
                <div className="w-32 h-32 sm:w-40 sm:h-40 md:w-48 md:h-48 bg-gradient-to-br from-teal-100 to-emerald-200 dark:from-primary-100 dark:to-primary-200 adventure:from-orange-100 adventure:to-stone-200 rounded-2xl p-4 sm:p-5 md:p-6 shadow-md border border-teal-200/60 dark:border-primary/20 adventure:border-amber-300/60">
                  <img src="/step_3.png" alt="Share the Adventure" className="w-full h-full object-contain mix-blend-multiply dark:mix-blend-normal dark:invert adventure:sepia" />
                </div>
              </div>
              <div className="w-7/12 text-left space-y-2 md:space-y-3">
                <h4 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground">
                  {t("home.howItWorks.step3.title")}
                </h4>
                <p className="text-muted-foreground text-sm sm:text-base md:text-lg leading-relaxed">
                  {t("home.howItWorks.step3.description")}
                </p>
              </div>
            </div>
          </div>

          {/* Call to action */}
          <div className="text-center mt-10 md:mt-14">
            <Link to="/map">
              <Button
                size="lg"
                className="bg-primary hover:bg-primary/90 text-primary-foreground transition-all group"
              >
                <Compass className="w-5 h-5 mr-2 group-hover:rotate-12 transition-transform" />
                {t("home.howItWorks.cta")}
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Recent Caches */}
      <section className="relative py-6 xs:py-12 md:py-16 px-3 xs:px-4 overflow-hidden bg-transparent">
        {/* Forest skyline background - positioned at bottom, fades naturally into page */}
        <div
          className="absolute inset-x-0 bottom-0 pointer-events-none opacity-30"
          style={{
            height: 'clamp(400px, 50vh, 600px)',
            background: `url(/forest-skyline.webp) center bottom / cover no-repeat`,
            maskImage: 'linear-gradient(to top, black 0%, black 60%, transparent 100%)',
            WebkitMaskImage: 'linear-gradient(to top, black 0%, black 60%, transparent 100%)'
          }}
        >
          {/* Subtle overlay for tone adjustment */}
          <div className="absolute inset-0 bg-white/35 dark:bg-white/15 adventure:bg-amber-50/20" />
          <div className="absolute inset-0 adventure:sepia" style={{
            background: `url(/forest-skyline.webp) center bottom / cover no-repeat`
          }} />
        </div>

        <div className="container mx-auto relative z-10">
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
                  <div className="bg-card rounded-lg border p-4">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-muted rounded-full"></div>
                      <div className="flex-1 space-y-3">
                        <div className="h-4 bg-muted rounded w-3/4"></div>
                        <div className="h-3 bg-muted rounded w-1/2"></div>
                        <div className="space-y-2">
                          <div className="h-3 bg-muted rounded w-full"></div>
                          <div className="h-3 bg-muted rounded w-2/3"></div>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex gap-2">
                            <div className="h-5 w-6 bg-muted rounded"></div>
                            <div className="h-5 w-6 bg-muted rounded"></div>
                            <div className="h-5 w-8 bg-muted rounded"></div>
                          </div>
                          <div className="flex gap-2">
                            <div className="h-4 w-4 bg-muted rounded"></div>
                            <div className="h-4 w-4 bg-muted rounded"></div>
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
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 auto-rows-fr">
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