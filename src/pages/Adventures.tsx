import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Sparkles, Plus, MapPin, ChevronRight } from "lucide-react";
import { offlineGeocode } from "@/utils/offlineGeocode";
import { DesktopHeader } from "@/components/DesktopHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAdventures } from "@/hooks/useAdventures";
import { useAuthor } from "@/hooks/useAuthor";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import type { Adventure } from "@/types/adventure";

// --- Gothic illuminated manuscript border strip ---

function GothicBorder({ side, className }: { side: 'left' | 'right'; className?: string }) {
  return (
    <svg
      className={`absolute ${side === 'left' ? 'left-0 md:left-2' : 'right-0 md:right-2'} top-0 bottom-0 w-10 md:w-16 pointer-events-none ${className}`}
      viewBox="0 0 60 1000"
      preserveAspectRatio="none"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth="0"
      style={side === 'right' ? { transform: 'scaleX(-1)' } : undefined}
    >
      <rect x="2" y="0" width="5" height="1000" rx="2" />
      <rect x="12" y="0" width="2" height="1000" />
      {[0, 200, 400, 600, 800].map(y => (
        <g key={y}>
          <path d={`M15,${y+40} L30,${y+25} L45,${y+40} L30,${y+55} Z`} fill="none" stroke="currentColor" strokeWidth="2.5" />
          <path d={`M30,${y+10} C22,${y+14} 18,${y+20} 22,${y+25} C18,${y+22} 14,${y+16} 20,${y+10} C24,${y+6} 28,${y+6} 30,${y+10}Z`} />
          <path d={`M30,${y+10} C38,${y+14} 42,${y+20} 38,${y+25} C42,${y+22} 46,${y+16} 40,${y+10} C36,${y+6} 32,${y+6} 30,${y+10}Z`} />
          <path d={`M30,${y+70} C22,${y+66} 18,${y+60} 22,${y+55} C18,${y+58} 14,${y+64} 20,${y+70} C24,${y+74} 28,${y+74} 30,${y+70}Z`} />
          <path d={`M30,${y+70} C38,${y+66} 42,${y+60} 38,${y+55} C42,${y+58} 46,${y+64} 40,${y+70} C36,${y+74} 32,${y+74} 30,${y+70}Z`} />
          <rect x="29" y={y+70} width="2" height="130" />
          <circle cx="30" cy={y+40} r="3" />
          <path d={`M12,${y+90} L22,${y+85} L22,${y+95} Z`} />
          <path d={`M12,${y+140} L22,${y+135} L22,${y+145} Z`} />
          <path d={`M48,${y+115} L38,${y+110} L38,${y+120} Z`} />
          <path d={`M48,${y+165} L38,${y+160} L38,${y+170} Z`} />
        </g>
      ))}
    </svg>
  );
}

// --- Featured adventure card in the hero ---

function HeroFeaturedCard({ adventure, isActive, t }: { adventure: Adventure; isActive: boolean; t: (key: string, opts?: Record<string, unknown>) => string }) {
  const author = useAuthor(adventure.pubkey);
  const authorName = author.data?.metadata?.name || adventure.pubkey.slice(0, 8);
  const authorPicture = author.data?.metadata?.picture;

  const [cityName, setCityName] = useState('');
  useEffect(() => {
    if (adventure.location) {
      offlineGeocode(adventure.location.lat, adventure.location.lng).then(setCityName);
    }
  }, [adventure.location]);

  return (
    <Link
      to={`/adventure/${adventure.naddr}`}
      className={`block transition-all duration-700 ${isActive ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none absolute inset-0'}`}
    >
      <div className="flex items-start gap-4 group">
        {adventure.image && (
          <div className="hidden sm:block w-28 h-20 md:w-36 md:h-24 rounded-lg overflow-hidden flex-shrink-0 ring-1 ring-white/20 group-hover:ring-white/40 transition-all">
            <img src={adventure.image} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-amber-400 text-[clamp(0.6rem,2vw,0.69rem)] font-semibold uppercase tracking-widest mb-0.5 md:mb-1 [text-shadow:0_2px_6px_rgba(0,0,0,0.8)]">
            {t('adventures.nowAccepting')}
          </p>
          <h3 className="text-[clamp(0.95rem,3.5vw,1.25rem)] md:text-xl font-bold text-white leading-snug group-hover:text-amber-200 transition-colors [text-shadow:0_2px_8px_rgba(0,0,0,0.7),0_1px_2px_rgba(0,0,0,0.9)] line-clamp-1">
            {adventure.title}
          </h3>
          <div className="flex items-center gap-[clamp(0.25rem,1vw,0.5rem)] mt-1 md:mt-1.5 text-[clamp(0.6rem,2.2vw,0.75rem)] text-white/90 [text-shadow:0_2px_6px_rgba(0,0,0,0.7),0_1px_2px_rgba(0,0,0,0.9)]">
            {authorPicture && <img src={authorPicture} alt="" className="w-3.5 h-3.5 md:w-4 md:h-4 rounded-full ring-1 ring-white/30" />}
            <span>{authorName}</span>
            <span className="text-white/50">&middot;</span>
            <span>{t('common.treasure', { count: adventure.geocacheRefs.length })}</span>
            {cityName && (
              <>
                <span className="text-white/50">&middot;</span>
                <MapPin className="h-3 w-3" />
                <span>{cityName}</span>
              </>
            )}
          </div>
          {(adventure.summary || adventure.description) && (
            <p className="text-[clamp(0.6rem,2.2vw,0.75rem)] text-white/80 mt-1 md:mt-1.5 line-clamp-1 max-w-md [text-shadow:0_2px_6px_rgba(0,0,0,0.7),0_1px_2px_rgba(0,0,0,0.9)]">
              {adventure.summary || adventure.description}
            </p>
          )}
        </div>
        <ChevronRight className="h-5 w-5 text-white/30 group-hover:text-amber-400 transition-colors flex-shrink-0 mt-1 hidden lg:block" />
      </div>
    </Link>
  );
}

// --- Quest card for the grid ---

function QuestCard({ adventure, t }: { adventure: Adventure; t: (key: string, opts?: Record<string, unknown>) => string }) {
  const author = useAuthor(adventure.pubkey);
  const authorName = author.data?.metadata?.name || adventure.pubkey.slice(0, 8);
  const authorPicture = author.data?.metadata?.picture;

  const [cityName, setCityName] = useState('');
  useEffect(() => {
    if (adventure.location) {
      offlineGeocode(adventure.location.lat, adventure.location.lng).then(setCityName);
    }
  }, [adventure.location]);

  return (
    <Link to={`/adventure/${adventure.naddr}`} className="group">
      <Card className="overflow-hidden h-full border-0 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
        <div className="relative aspect-[5/3]">
          {adventure.image ? (
            <>
              <img
                src={adventure.image}
                alt={adventure.title}
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
            </>
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-stone-800 to-stone-900 flex items-center justify-center">
              <Sparkles className="h-12 w-12 text-amber-500/20" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
            </div>
          )}

          <div className="absolute bottom-0 left-0 right-0 p-4 [text-shadow:0_2px_8px_rgba(0,0,0,0.7),0_1px_2px_rgba(0,0,0,0.9)]">
            <h3 className="font-bold text-base md:text-lg text-white leading-snug line-clamp-2 group-hover:text-amber-200 transition-colors">
              {adventure.title}
            </h3>
            {/* Below xs: two lines | xs+: single line */}
            <div className="mt-1.5 text-[11px] text-white/90">
              {/* Narrow layout (below xs/375px) */}
              <div className="xs:hidden space-y-0.5">
                <div className="flex items-center gap-1.5">
                  {authorPicture && (
                    <img src={authorPicture} alt="" className="w-4 h-4 rounded-full ring-1 ring-white/30 flex-shrink-0" loading="lazy" />
                  )}
                  <span className="truncate">{authorName}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="flex-shrink-0">{t('common.treasure', { count: adventure.geocacheRefs.length })}</span>
                  {cityName && (
                    <>
                      <span className="text-white/50">&middot;</span>
                      <MapPin className="h-3 w-3 flex-shrink-0" />
                      <span className="truncate">{cityName}</span>
                    </>
                  )}
                </div>
              </div>
              {/* xs+ layout */}
              <div className="hidden xs:flex items-center gap-2">
                {authorPicture && (
                  <img src={authorPicture} alt="" className="w-4 h-4 rounded-full ring-1 ring-white/30 flex-shrink-0" loading="lazy" />
                )}
                <span className="truncate">{authorName}</span>
                <span className="text-white/50">&middot;</span>
                <span className="flex-shrink-0">{t('common.treasure', { count: adventure.geocacheRefs.length })}</span>
                {cityName && (
                  <>
                    <span className="text-white/50">&middot;</span>
                    <MapPin className="h-3 w-3 flex-shrink-0" />
                    <span className="truncate">{cityName}</span>
                  </>
                )}
              </div>
            </div>
            {(adventure.summary || adventure.description) && (
              <p className="text-xs text-white/80 mt-1 line-clamp-2 leading-relaxed">
                {adventure.summary || adventure.description}
              </p>
            )}
          </div>
        </div>
      </Card>
    </Link>
  );
}

function QuestCardSkeleton() {
  return (
    <Card className="overflow-hidden h-full border-0 shadow-lg">
      <Skeleton className="aspect-[5/3] w-full" />
    </Card>
  );
}

// --- Quest board parchment background with spotlight ---

function QuestBoardBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Light mode: warm parchment / Dark mode: dark aged surface */}
      <div className="absolute inset-0 bg-[#d4c4a0] dark:bg-[#1a1814]" />

      {/* Layered noise for paper texture */}
      <svg className="absolute inset-0 w-full h-full">
        <defs>
          <filter id="parchment-coarse">
            <feTurbulence type="fractalNoise" baseFrequency="0.025" numOctaves="5" seed="2" stitchTiles="stitch" />
            <feColorMatrix type="saturate" values="0" />
          </filter>
          <filter id="parchment-fine">
            <feTurbulence type="fractalNoise" baseFrequency="0.15" numOctaves="3" seed="8" stitchTiles="stitch" />
            <feColorMatrix type="saturate" values="0" />
          </filter>
        </defs>
        <rect width="100%" height="100%" filter="url(#parchment-coarse)" opacity="0.15" className="dark:opacity-[0.1]" />
        <rect width="100%" height="100%" filter="url(#parchment-fine)" opacity="0.06" className="dark:opacity-[0.04]" />
      </svg>

      {/* Warm color wash */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#c8b488]/30 via-transparent to-[#b8a478]/20 dark:from-[#2a2010]/40 dark:via-transparent dark:to-[#1a1408]/30 mix-blend-multiply" />

      {/* Spotlight — warm overhead light hitting the board */}
      <div className="absolute inset-0" style={{
        background: 'radial-gradient(ellipse 70% 50% at 50% 15%, rgba(255,220,160,0.15) 0%, rgba(255,200,120,0.05) 40%, transparent 70%)',
      }} />
      <div className="absolute inset-0 hidden dark:block" style={{
        background: 'radial-gradient(ellipse 70% 50% at 50% 15%, rgba(255,180,100,0.08) 0%, rgba(255,160,80,0.03) 40%, transparent 70%)',
      }} />

      {/* Darkened edges — like a board mounted on a wall, light falls off at edges */}
      <div className="absolute inset-0" style={{
        boxShadow: 'inset 0 0 80px 20px rgba(120,90,50,0.2), inset 0 0 200px 60px rgba(80,60,30,0.12)',
      }} />
      <div className="absolute inset-0 hidden dark:block" style={{
        boxShadow: 'inset 0 0 100px 30px rgba(0,0,0,0.5), inset 0 0 250px 80px rgba(0,0,0,0.3)',
      }} />

      <GothicBorder side="left" className="text-stone-800/40 dark:text-amber-400/[0.15]" />
      <GothicBorder side="right" className="text-stone-800/40 dark:text-amber-400/[0.15]" />
    </div>
  );
}

// --- Main Page ---

export default function Adventures() {
  const { t } = useTranslation();
  const { data: adventures, isLoading, isError } = useAdventures();
  const { user } = useCurrentUser();

  const heroAdventures = useMemo(
    () => (adventures || []).filter(a => a.image),
    [adventures]
  );
  const [heroIndex, setHeroIndex] = useState(0);

  useEffect(() => {
    if (heroAdventures.length <= 1) return;
    const id = setInterval(() => setHeroIndex(i => (i + 1) % heroAdventures.length), 8000);
    return () => clearInterval(id);
  }, [heroAdventures.length]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <DesktopHeader variant="hero" />

      {/* ── Hero ── */}
      <section className="relative h-[60vh] min-h-[380px] max-h-[520px] md:h-[81vh] md:min-h-[490px] md:max-h-[730px] -mt-12 lg:-mt-[81px] flex flex-col justify-end overflow-hidden">

        {heroAdventures.length > 0 ? (
          heroAdventures.map((adventure, i) => (
            <div
              key={adventure.id}
              className="absolute inset-0"
              style={{ opacity: i === heroIndex ? 1 : 0, transition: 'opacity 2500ms ease-in-out' }}
            >
              <img
                src={adventure.image!}
                alt=""
                className={`absolute inset-0 w-full h-full object-cover ${i % 2 === 0 ? 'hero-pan-right' : 'hero-pan-left'}`}
                loading={i < 2 ? 'eager' : 'lazy'}
              />
            </div>
          ))
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-stone-900 via-amber-950/30 to-black" />
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/50 to-black/60" />

        <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ opacity: 0.15 }}>
          <filter id="adv-grain"><feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" /><feColorMatrix type="saturate" values="0" /></filter>
          <rect width="100%" height="100%" filter="url(#adv-grain)" />
        </svg>

        <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-[0.08] z-[1]" viewBox="0 0 200 100" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
          <path d="M -5,15 C 20,5 40,10 60,20 C 80,30 95,6 120,14 C 145,22 165,10 190,18" stroke="white" strokeWidth="0.8" fill="none" strokeDasharray="3,4" strokeLinecap="round" />
          <path d="M -5,50 C 15,40 30,42 50,52 C 70,62 85,38 110,46 C 135,54 155,40 180,48" stroke="white" strokeWidth="0.6" fill="none" strokeDasharray="2,5" strokeLinecap="round" />
          <path d="M -5,85 C 25,75 45,78 65,88 C 85,98 100,72 125,80 C 150,88 165,76 185,84" stroke="white" strokeWidth="0.8" fill="none" strokeDasharray="3,4" strokeLinecap="round" />
        </svg>

        {/* Gothic borders — light on dark hero */}
        <GothicBorder side="left" className="text-white/[0.14] z-[2]" />
        <GothicBorder side="right" className="text-white/[0.14] z-[2]" />

        {/* Content */}
        <div className="relative z-10 w-full pb-[clamp(1.5rem,4vw,3.5rem)] md:pb-14 pt-[clamp(4rem,12vw,10rem)] md:pt-40">
          <div className="mx-auto px-8 sm:px-10 md:px-4 max-w-6xl">

            <div className="mb-[clamp(1.5rem,4vw,3.5rem)] md:mb-14 animate-slide-up">
              <div className="flex items-center gap-[clamp(0.5rem,2vw,1rem)] md:gap-4">
                <span className="inline-flex items-center justify-center w-[clamp(2.5rem,10vw,3.5rem)] h-[clamp(2.5rem,10vw,3.5rem)] md:w-20 md:h-20 rounded-full bg-amber-500/20 border border-amber-400/40 backdrop-blur-sm flex-shrink-0">
                  <Sparkles className="h-[clamp(1.25rem,5vw,1.75rem)] w-[clamp(1.25rem,5vw,1.75rem)] md:h-10 md:w-10 text-amber-400" />
                </span>
                <div>
                  <h1 className="text-[clamp(1.75rem,8vw,3rem)] md:text-7xl font-bold text-white leading-[1.1] [text-shadow:0_4px_16px_rgba(0,0,0,0.7),0_1px_3px_rgba(0,0,0,0.9)]">
                    {t('adventures.title')}
                  </h1>
                  <p className="mt-0.5 md:mt-1 text-amber-400 text-[clamp(0.625rem,2vw,0.75rem)] md:text-sm font-semibold uppercase tracking-[0.2em] [text-shadow:0_2px_6px_rgba(0,0,0,0.7)]">
                    {t('adventures.subtitle')}
                  </p>
                </div>
              </div>
              <p className="mt-[clamp(0.5rem,2vw,1rem)] text-[clamp(0.8rem,3vw,1rem)] md:text-lg text-white/90 max-w-xl leading-relaxed [text-shadow:0_2px_8px_rgba(0,0,0,0.6),0_1px_2px_rgba(0,0,0,0.8)]">
                {t('adventures.heroDescription')}
              </p>
            </div>

            {heroAdventures.length > 0 && (
              <div className="relative mb-[clamp(0.75rem,2vw,1.5rem)] animate-slide-up-delay">
                {heroAdventures.map((adventure, i) => (
                  <HeroFeaturedCard key={adventure.id} adventure={adventure} isActive={i === heroIndex} t={t} />
                ))}
              </div>
            )}

            {heroAdventures.length > 1 && (
              <div className="flex items-center gap-1.5 animate-slide-up-delay-2">
                {heroAdventures.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setHeroIndex(i)}
                    className={`rounded-full transition-all duration-300 ${
                      i === heroIndex ? 'w-6 h-1.5 bg-amber-400' : 'w-1.5 h-1.5 bg-white/25 hover:bg-white/40'
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── Pick Your Path ── */}
      <div id="quests" className="relative flex-1">
        <QuestBoardBackground />

        {/* Torn/shadowed top edge — softens the hard hero-to-parchment cut */}
        <div className="absolute top-0 left-0 right-0 h-16 z-[1] pointer-events-none" style={{
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0.08) 40%, transparent 100%)',
        }} />

        <div className="relative z-10 mx-auto px-8 sm:px-10 md:px-4 py-12 md:py-16 max-w-6xl">
          {/* Loading */}
          {isLoading && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, i) => <QuestCardSkeleton key={i} />)}
            </div>
          )}

          {/* Error */}
          {isError && (
            <div className="text-center py-[clamp(2rem,8vw,4rem)]">
              <Sparkles className="h-[clamp(2rem,8vw,3rem)] w-[clamp(2rem,8vw,3rem)] text-amber-800/40 dark:text-amber-400/40 mx-auto mb-3 md:mb-4" />
              <h2 className="text-[clamp(0.95rem,3.5vw,1.125rem)] font-semibold mb-2 text-stone-800 dark:text-amber-100/90">{t('adventures.errorTitle')}</h2>
              <p className="text-[clamp(0.8rem,2.8vw,1rem)] text-stone-600 dark:text-amber-200/50">{t('adventures.errorDescription')}</p>
            </div>
          )}

          {/* Empty */}
          {!isLoading && !isError && adventures?.length === 0 && (
            <div className="text-center py-[clamp(3rem,10vw,5rem)]">
              <div className="inline-flex items-center justify-center w-[clamp(3rem,10vw,4rem)] h-[clamp(3rem,10vw,4rem)] rounded-full bg-amber-500/15 mb-4 md:mb-6">
                <Sparkles className="h-[clamp(1.5rem,5vw,2rem)] w-[clamp(1.5rem,5vw,2rem)] text-amber-400" />
              </div>
              <h2 className="text-[clamp(1.25rem,5vw,1.5rem)] font-bold mb-2 md:mb-3 text-stone-800 dark:text-amber-100/90">{t('adventures.emptyTitle')}</h2>
              <p className="text-[clamp(0.8rem,2.8vw,1rem)] text-stone-600 dark:text-amber-200/50 mb-6 md:mb-8 max-w-md mx-auto">
                {t('adventures.emptyDescription')}
              </p>
              {user && (
                <Button asChild className="bg-amber-700 hover:bg-amber-600 text-white border-0 text-[clamp(0.8rem,2.8vw,1rem)] px-[clamp(1rem,4vw,1.5rem)] py-[clamp(0.5rem,2vw,0.75rem)] h-auto">
                  <Link to="/create-adventure">
                    <Plus className="h-4 w-4 mr-2" />
                    {t('adventures.startFirst')}
                  </Link>
                </Button>
              )}
            </div>
          )}

          {/* Section header */}
          {!isLoading && adventures && adventures.length > 0 && (
            <div className="flex items-center justify-between gap-3 mb-[clamp(1.5rem,4vw,2.5rem)] md:mb-10">
              <div className="min-w-0">
                <h2 className="text-[clamp(1.4rem,6vw,1.875rem)] md:text-4xl font-bold text-stone-800 dark:text-amber-100/90 tracking-tight">
                  {t('adventures.pickYourPath')}
                </h2>
                <p className="text-[clamp(0.7rem,2.5vw,0.875rem)] text-stone-500 dark:text-amber-200/40 mt-1 md:mt-2">
                  {t('adventures.adventureAwaits', { count: adventures.length })}
                </p>
              </div>
              {user && (
                <Link to="/create-adventure" className="group flex items-center justify-center gap-2 p-2.5 sm:px-5 sm:py-2.5 rounded-lg bg-gradient-to-r from-amber-700 to-amber-600 dark:from-amber-600 dark:to-amber-500 text-white text-sm font-medium shadow-lg shadow-amber-900/20 dark:shadow-amber-900/40 hover:shadow-xl hover:from-amber-600 hover:to-amber-500 dark:hover:from-amber-500 dark:hover:to-amber-400 transition-all duration-200 hover:-translate-y-0.5 flex-shrink-0">
                  <Plus className="h-5 w-5 sm:h-4 sm:w-4 transition-transform group-hover:rotate-90 duration-200" />
                  <span className="hidden sm:inline">{t('adventures.newAdventure')}</span>
                </Link>
              )}
            </div>
          )}

          {/* Grid */}
          {!isLoading && adventures && adventures.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {adventures.map(adventure => (
                <QuestCard key={adventure.id} adventure={adventure} t={t} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
