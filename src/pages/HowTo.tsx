import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  UserPlus,
  Search,
  Compass,
  ScanQrCode,
  Plus,
  ArrowRight,
  Map as MapIcon,
  Bookmark,
  Camera,
  QrCode,
  List,
  ListFilter,
  Locate,
} from 'lucide-react';
import { PageLayout } from '@/components/PageLayout';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import LoginDialog from '@/components/auth/LoginDialog';
import SignupDialog from '@/components/auth/SignupDialog';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useRadarOverlay } from '@/hooks/useRadarOverlay';
import { useTheme } from '@/hooks/useTheme';

/**
 * Small inline pill used to name a UI element by name (a "key cap"). Used to
 * refer to actual buttons in the product UI: tap <Pill>Compass</Pill>.
 */
function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 align-baseline rounded-md border border-border bg-muted px-1.5 py-0.5 text-[13px] font-medium text-foreground [&_svg]:h-3.5 [&_svg]:w-3.5 [&_svg]:text-muted-foreground">
      {children}
    </span>
  );
}

/**
 * Inline navigation link with bold text and a leading lucide icon, no
 * underline. Used for jumping to real pages (Map, Compass, Claim, etc.) from
 * inside prose.
 */
function NavInline({
  to,
  icon: Icon,
  children,
}: {
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <Link
      to={to}
      className="inline-flex items-center gap-1 align-baseline font-semibold text-primary hover:text-primary/80 transition-colors [&_svg]:h-4 [&_svg]:w-4"
    >
      <Icon />
      {children}
    </Link>
  );
}

/** A chapter's tile artwork. */
type ChapterArt =
  | { type: 'png'; src: string }
  | { type: 'svg'; src: string }
  | { type: 'lucide'; icon: React.ComponentType<{ className?: string }> };

interface ChapterContext {
  /** Open the real Login dialog used everywhere else in the app. */
  openLogin: () => void;
  /** Open the global compass/radar overlay. */
  openCompass: () => void;
  /** Whether the visitor is signed in. */
  isLoggedIn: boolean;
}

interface Chapter {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  blurb: string;
  art: ChapterArt;
  palette: 'green' | 'emerald' | 'teal';
  body: (ctx: ChapterContext) => React.ReactNode;
}

const chapters: Chapter[] = [
  {
    id: 'sign-up',
    icon: UserPlus,
    title: 'Sign up',
    blurb: 'A free account in about a minute.',
    art: { type: 'lucide', icon: UserPlus },
    palette: 'green',
    body: ({ openLogin, isLoggedIn }) => (
      <>
        <ol>
          <li>
            Tap the <Pill><UserPlus />Join</Pill> button. It lives in the top
            corner of every page, but here's one too:
            {!isLoggedIn && (
              <div className="pt-2.5">
                <Button
                  size="sm"
                  onClick={openLogin}
                  className="rounded-full px-3 min-h-11 text-xs font-semibold"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  Join
                </Button>
              </div>
            )}
          </li>
          <li>
            Pick <Pill>Create new account</Pill>. The app generates your keys
            on your device. (Already on Nostr? Paste your{' '}
            <code>nsec1…</code> or use a signer extension like Alby.)
          </li>
          <li>
            Pick a name and picture, then you're in. Five screens, takes about
            a minute.
          </li>
          <li>
            <strong>Save your nsec somewhere safe.</strong> It's your password.
            Treasures never sees it, which means we can't recover it for you
            if you lose it. A password manager is perfect.
          </li>
        </ol>
      </>
    ),
  },
  {
    id: 'find-treasure',
    icon: Search,
    title: 'Find a treasure',
    blurb: 'See what is hidden near you.',
    art: { type: 'png', src: '/step_2.png' },
    palette: 'emerald',
    body: () => (
      <>
        <ol>
          <li>
            Open the <NavInline to="/map" icon={MapIcon}>Map</NavInline>. Allow
            location so it can center on you.
          </li>
          <li>
            Switch between <Pill><MapIcon />Map</Pill> (pins) and{' '}
            <Pill><List />List</Pill> (cards sorted by distance). Search by
            city, zip, or address, or tap <Pill><Locate />Near Me</Pill> to
            recenter on yourself.
          </li>
          <li>
            Use <Pill><ListFilter />Filters</Pill> to narrow by type,{' '}
            <strong>difficulty</strong> (how hard the hide is), and{' '}
            <strong>terrain</strong> (how hard to get there).
          </li>
          <li>
            Tap any pin or card to open the treasure. You'll see its
            description, hint, photos, and previous logs. Tap{' '}
            <Pill><Bookmark />Save</Pill> to bookmark it for later.
          </li>
        </ol>
        <div className="flex flex-wrap gap-2 pt-2">
          <Button asChild size="sm">
            <Link to="/map">
              <MapIcon />
              Open the map
              <ArrowRight />
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to="/map?tab=list">
              <List />
              Browse the list
            </Link>
          </Button>
        </div>
      </>
    ),
  },
  {
    id: 'use-compass',
    icon: Compass,
    title: 'Use the compass',
    blurb: 'A pocket radar that points to the treasure.',
    art: { type: 'lucide', icon: Compass },
    palette: 'teal',
    body: ({ openCompass }) => (
      <>
        <ol>
          <li>
            Tap <Pill><Compass />Compass</Pill> (the big round button in the
            middle of the bottom bar on mobile, or the floating button on the
            map on desktop).
          </li>
          <li>
            By default, it points to the closest treasure. Open the compass
            from a specific treasure's page to lock onto that one instead.
          </li>
          <li>
            The arrow points where to go. The number is the distance. When the
            ring turns green, you're about ten meters away.
          </li>
          <li>
            If the arrow spins or drifts, wave your phone in a figure-8 for a
            few seconds to recalibrate. GPS is only good to about 10 meters,
            so the last bit is up to your eyes and the hint.
          </li>
        </ol>
        <div className="flex flex-wrap gap-2 pt-2">
          <Button size="sm" onClick={openCompass}>
            <Compass />
            Open the compass
            <ArrowRight />
          </Button>
        </div>
      </>
    ),
  },
  {
    id: 'claim-treasure',
    icon: ScanQrCode,
    title: 'Claim & log',
    blurb: 'You found it! Scan the QR and write your story.',
    art: { type: 'png', src: '/step_3.png' },
    palette: 'green',
    body: () => (
      <>
        <ol>
          <li>
            <strong>Found it!</strong> Point your phone's camera at the QR
            code on the container, then tap the link that pops up. The app
            opens straight to the claim screen.
          </li>
          <li>
            Or stay in the app: open{' '}
            <NavInline to="/claim" icon={ScanQrCode}>Claim</NavInline> and tap{' '}
            <Pill><Camera />Scan QR</Pill>.
          </li>
          <li>
            On the treasure page you'll see a green verified banner. Pick a
            log type (<Pill>Found</Pill>, <Pill>DNF</Pill>, <Pill>Note</Pill>),
            write a quick comment, add photos if you like, and publish.
          </li>
          <li>
            <strong>Put the container back exactly as you found it.</strong>{' '}
            Same spot, same camouflage, same lid. The next hunter is counting
            on you.
          </li>
        </ol>
        <div className="flex flex-wrap gap-2 pt-2">
          <Button asChild size="sm">
            <Link to="/claim">
              <ScanQrCode />
              Claim a treasure
              <ArrowRight />
            </Link>
          </Button>
        </div>
      </>
    ),
  },
  {
    id: 'hide-treasure',
    icon: Plus,
    title: 'Hide your own',
    blurb: 'Make a treasure for other people to find.',
    art: { type: 'png', src: '/step_1.png' },
    palette: 'emerald',
    body: ({ isLoggedIn, openLogin }) => (
      <>
        <p>
          Pick one of two paths. <Pill>With a QR Code</Pill> prints a QR
          first, then you scan it to start the listing. Finders will scan that
          QR to prove they found it. <Pill>Without a QR Code</Pill> skips the
          QR; finders log on the honor system. Either way, the wizard has four
          steps:
        </p>
        <ol>
          <li>
            <strong>Location.</strong> Drag the pin to the hiding spot, type
            an address, or use GPS. The app warns you if you've landed on
            private property, in a building, or in water.
          </li>
          <li>
            <strong>Details.</strong> A name, a description, and a short hint.
            Keep the hint helpful but obscure (no spoilers).
          </li>
          <li>
            <strong>Challenge.</strong> Pick the type (regular, multi-stage,
            or puzzle), a difficulty and terrain rating from 1 to 5, and the
            container size.
          </li>
          <li>
            <strong>Finish.</strong> Add photos of the area (never of the hide
            spot!), review, and publish.
          </li>
        </ol>
        <p>
          Then go hide it. Bring a printed QR (use{' '}
          <NavInline to="/generate-qr" icon={QrCode}>Generate QR</NavInline>),
          a waterproof container, and permission if the spot isn't public.
        </p>
        <div className="flex flex-wrap gap-2 pt-2">
          {isLoggedIn ? (
            <>
              <Button asChild size="sm">
                <Link to="/create">
                  <Plus />
                  Hide a treasure
                  <ArrowRight />
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link to="/generate-qr">
                  <QrCode />
                  Generate a QR
                </Link>
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              onClick={openLogin}
              className="rounded-full px-3 min-h-11 text-xs font-semibold"
            >
              <UserPlus className="h-3.5 w-3.5" />
              Join to hide a treasure
            </Button>
          )}
        </div>
      </>
    ),
  },
];

/** Palette → background gradient classes, matching Home's step tiles. */
function paletteSurface(
  palette: Chapter['palette'],
  isDitto: boolean,
  isMojave: boolean
) {
  if (isDitto) return 'bg-card border-border';
  if (isMojave) return 'bg-gradient-to-br from-card to-muted border-primary/30';

  switch (palette) {
    case 'green':
      return 'bg-gradient-to-br from-green-100 to-emerald-200 dark:from-primary-200 dark:to-primary-100 adventure:from-amber-100 adventure:to-orange-200 border-green-200/60 dark:border-primary/20 adventure:border-amber-300/60';
    case 'emerald':
      return 'bg-gradient-to-br from-emerald-100 to-teal-200 dark:from-primary-100 dark:to-primary-200 adventure:from-yellow-100 adventure:to-amber-200 border-emerald-200/60 dark:border-primary/20 adventure:border-amber-300/60';
    case 'teal':
      return 'bg-gradient-to-br from-teal-100 to-emerald-200 dark:from-primary-100 dark:to-primary-200 adventure:from-orange-100 adventure:to-stone-200 border-teal-200/60 dark:border-primary/20 adventure:border-amber-300/60';
  }
}

export default function HowTo() {
  const { t } = useTranslation();
  const { resolvedTheme } = useTheme();
  const { user } = useCurrentUser();
  const { open: openCompass } = useRadarOverlay();
  const isDitto = resolvedTheme === 'ditto';
  const isMojave = resolvedTheme === 'mojave';

  // Login/signup dialog plumbing. Same wiring used by MobileNav and LoginArea.
  const [loginDialogOpen, setLoginDialogOpen] = useState(false);
  const [signupDialogOpen, setSignupDialogOpen] = useState(false);

  const ctx: ChapterContext = {
    openLogin: () => setLoginDialogOpen(true),
    openCompass,
    isLoggedIn: !!user,
  };

  // Dotted trail stroke color. Matches Home page exactly.
  const trailStroke = isDitto
    ? 'text-primary/30'
    : isMojave
    ? 'text-primary/40'
    : 'text-green-500/30 dark:text-green-400/20 adventure:text-amber-600/30';

  return (
    <PageLayout maxWidth="2xl" background="muted">
      <div className="max-w-2xl mx-auto px-4 pt-12 pb-16">
        {/* Header */}
        <header className="mb-10 text-center">
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
            {t('navigation.howTo', 'How To')}
          </p>
          <h1 className="text-4xl md:text-5xl font-bold text-foreground tracking-tight">
            Playing Treasures
          </h1>
          <p className="text-base md:text-lg text-muted-foreground mt-3 leading-relaxed max-w-md mx-auto">
            From signing up to hiding your first cache, in five short chapters.
          </p>
        </header>

        {/* Chapter list with zig-zag dotted trail weaving between rows */}
        <div className="relative">
          <div
            className="absolute inset-0 pointer-events-none hidden sm:block"
            aria-hidden="true"
          >
            <svg
              className="absolute inset-0 w-full h-full"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
            >
              <path
                d="M 22,10 C 22,22 78,28 78,40 C 78,52 22,55 22,68 C 22,80 78,82 78,92"
                stroke="currentColor"
                strokeWidth="0.3"
                fill="none"
                strokeDasharray="1.5,1.5"
                strokeLinecap="round"
                className={trailStroke}
              />
            </svg>
          </div>

          <Accordion type="multiple" className="w-full relative z-10">
            {chapters.map((chapter, idx) => {
              const Icon = chapter.icon;
              // Zig-zag: even rows have image on the left, odd rows on the right.
              const imageRight = idx % 2 === 1;
              return (
                <AccordionItem
                  key={chapter.id}
                  value={chapter.id}
                  id={chapter.id}
                  className="border-b border-border/60 scroll-mt-20"
                >
                  <AccordionTrigger className="py-5 hover:no-underline group">
                    <div
                      className={`flex items-center gap-4 sm:gap-5 w-full ${
                        imageRight ? 'flex-row-reverse' : 'flex-row'
                      }`}
                    >
                      {/* Illustration tile, same recipe as Home page step tiles */}
                      <div
                        className={`shrink-0 w-20 h-20 sm:w-24 sm:h-24 rounded-2xl p-2.5 sm:p-3 shadow-sm border flex items-center justify-center ${paletteSurface(
                          chapter.palette,
                          isDitto,
                          isMojave
                        )}`}
                      >
                        {chapter.art.type === 'png' && (
                          <img
                            src={chapter.art.src}
                            alt=""
                            className={`w-full h-full object-contain mojave-step-tint ${
                              isDitto
                                ? 'ditto-invert'
                                : 'mix-blend-multiply dark:mix-blend-normal dark:invert adventure:sepia'
                            }`}
                          />
                        )}
                        {chapter.art.type === 'svg' && (
                          <img
                            src={chapter.art.src}
                            alt=""
                            className={`w-full h-full object-contain ${
                              isDitto ? 'ditto-logo' : isMojave ? 'mojave-logo' : ''
                            }`}
                          />
                        )}
                        {chapter.art.type === 'lucide' && (
                          <chapter.art.icon
                            className={`w-full h-full ${
                              isDitto
                                ? 'text-primary'
                                : isMojave
                                ? 'text-primary'
                                : 'text-emerald-700 dark:text-primary adventure:text-amber-800'
                            }`}
                          />
                        )}
                      </div>

                      {/* Title block */}
                      <div
                        className={`flex-1 min-w-0 ${
                          imageRight ? 'text-right' : 'text-left'
                        }`}
                      >
                        <div
                          className={`flex items-center gap-2 mb-1 ${
                            imageRight ? 'justify-end' : 'justify-start'
                          }`}
                        >
                          <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground/60">
                            Ch. {String(idx + 1).padStart(2, '0')}
                          </span>
                          <Icon className="h-3 w-3 text-muted-foreground/60" />
                        </div>
                        <div className="text-2xl sm:text-3xl font-bold text-foreground leading-tight">
                          {chapter.title}
                        </div>
                        <div className="text-[15px] sm:text-base text-muted-foreground mt-1.5 leading-snug">
                          {chapter.blurb}
                        </div>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="px-1 sm:px-2 pb-5 pt-2 text-[15px] sm:text-base text-foreground/80 leading-[1.7] space-y-4 [&_ol]:list-decimal [&_ol]:ml-6 [&_ol]:space-y-4 [&_ol]:marker:text-muted-foreground/70 [&_ol]:marker:font-semibold [&_p]:leading-[1.7] [&_strong]:text-foreground [&_strong]:font-semibold [&_code]:text-[13px] [&_code]:text-foreground/80 [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded">
                      {chapter.body(ctx)}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </div>

        {/* Quiet footer */}
        <p className="text-xs text-muted-foreground/70 mt-10 text-center">
          Want the deeper dive? See the{' '}
          <Link to="/about" className="font-semibold text-primary hover:text-primary/80">
            About page
          </Link>{' '}
          for FAQ, or the{' '}
          <Link to="/blog" className="font-semibold text-primary hover:text-primary/80">
            Blog
          </Link>{' '}
          for new features.
        </p>
      </div>

      {/* Login/Signup dialogs, same components used by the header */}
      <LoginDialog
        isOpen={loginDialogOpen}
        onClose={() => setLoginDialogOpen(false)}
        onLogin={() => setLoginDialogOpen(false)}
        onSignup={() => setSignupDialogOpen(true)}
      />
      <SignupDialog
        isOpen={signupDialogOpen}
        onClose={() => setSignupDialogOpen(false)}
        onComplete={() => {
          setSignupDialogOpen(false);
          setLoginDialogOpen(false);
        }}
      />
    </PageLayout>
  );
}
