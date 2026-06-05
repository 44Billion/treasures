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
  BookOpen,
  Camera,
  QrCode,
  List,
  ListFilter,
  Locate,
} from 'lucide-react';
import { DesktopHeader } from '@/components/DesktopHeader';
import { PageHero } from '@/components/PageHero';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { SignupFlow } from '@/components/auth/SignupFlow';
import { LoginFlow } from '@/components/auth/LoginFlow';
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
      className="inline-flex items-center gap-1 align-baseline font-semibold text-white underline decoration-white/40 underline-offset-2 decoration-2 hover:decoration-white transition-colors [&_svg]:h-4 [&_svg]:w-4"
    >
      <Icon />
      {children}
    </Link>
  );
}

/**
 * Prose wrapper applied to chapter bodies that contain narrative text. Keeps
 * the white-on-photo typography in one place so it does NOT cascade into
 * embedded UI cards (e.g. SignupFlow / LoginFlow) which have their own light
 * backgrounds and need normal foreground colors.
 */
function Prose({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[15px] sm:text-base text-white/90 leading-[1.7] space-y-4 [&_ol]:list-decimal [&_ol]:ml-6 [&_ol]:space-y-4 [&_ol]:marker:text-white/60 [&_ol]:marker:font-semibold [&_p]:leading-[1.7] [&_strong]:text-white [&_strong]:font-semibold [&_code]:text-[13px] [&_code]:text-white [&_code]:bg-white/15 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded">
      {children}
    </div>
  );
}

/** A chapter's tile artwork. */
type ChapterArt =
  | { type: 'png'; src: string }
  | { type: 'svg'; src: string }
  | { type: 'lucide'; icon: React.ComponentType<{ className?: string }> };

interface ChapterContext {
  /** Switch the sign-up chapter into inline signup mode. */
  startSignup: () => void;
  /** Switch the sign-up chapter into inline login mode. */
  startLogin: () => void;
  /** Reset the sign-up chapter back to the prose intro. */
  cancelAuth: () => void;
  /** Currently active inline auth flow, if any. */
  authMode: 'signup' | 'login' | null;
  /** Fires when the inline signup/login flow finishes successfully. */
  onAuthComplete: () => void;
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
    body: ({ startSignup, startLogin, cancelAuth, authMode, onAuthComplete, isLoggedIn }) => {
      // Inline signup flow. Keep showing this even after the user is logged
      // in mid-flow (the flow logs them in before the profile step), so the
      // optional profile form still gets shown.
      if (authMode === 'signup') {
        return (
          <div className="space-y-3">
            <SignupFlow onComplete={onAuthComplete} />
            <div className="text-center">
              <button
                type="button"
                onClick={cancelAuth}
                className="text-xs text-white/70 hover:text-white underline underline-offset-2"
              >
                Cancel and read the chapter
              </button>
            </div>
          </div>
        );
      }

      // Inline login flow (paste nsec / extension / remote signer).
      if (authMode === 'login') {
        return (
          <div className="space-y-3">
            <LoginFlow
              onLogin={onAuthComplete}
              onSignup={startSignup}
            />
            <div className="text-center">
              <button
                type="button"
                onClick={cancelAuth}
                className="text-xs text-white/70 hover:text-white underline underline-offset-2"
              >
                Cancel and read the chapter
              </button>
            </div>
          </div>
        );
      }

      // No active inline flow, but the visitor is already signed in: show a
      // celebratory state instead of the prose.
      if (isLoggedIn) {
        return (
          <div className="rounded-2xl border border-white/15 bg-background/85 backdrop-blur-md p-5 text-center space-y-2">
            <p className="text-foreground font-semibold">You're signed in. Onward!</p>
            <p className="text-sm text-muted-foreground">
              The next chapter shows how to find treasures near you.
            </p>
          </div>
        );
      }

      // Default: the prose with inline Join + Log in buttons.
      return (
        <Prose>
          <ol>
            <li>
              Tap <Pill><UserPlus />Join</Pill> to begin your quest.
              <div className="pt-2.5 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={startSignup}
                  className="rounded-full px-3 min-h-11 text-xs font-semibold"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  Join
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={startLogin}
                  className="rounded-full px-3 min-h-11 text-xs font-semibold"
                >
                  Already have a key? Log in
                </Button>
              </div>
            </li>
            <li>
              We forge your personal <strong>treasure key</strong>. It's yours
              alone.
            </li>
            <li>
              <strong>Keep this key safe.</strong> It's the only way back into
              your adventure. A password manager is a perfect place for it.
            </li>
            <li>
              Pick a name and picture, and you're in.
            </li>
          </ol>
        </Prose>
      );
    },
  },
  {
    id: 'find-treasure',
    icon: Search,
    title: 'Find a treasure',
    blurb: 'See what is hidden near you.',
    art: { type: 'png', src: '/find-a-treasure.png' },
    palette: 'emerald',
    body: () => (
      <Prose>
        <ol>
          <li>
            Open the <NavInline to="/map" icon={MapIcon}>Map</NavInline> and let
            it see your location.
          </li>
          <li>
            Flip between <Pill><MapIcon />Map</Pill> and{' '}
            <Pill><List />List</Pill>. Search by city or address, or tap{' '}
            <Pill><Locate />Near Me</Pill> to come back to you.
          </li>
          <li>
            <Pill><ListFilter />Filters</Pill> let you narrow things down by{' '}
            <strong>difficulty</strong> (how tricky it is to spot) and{' '}
            <strong>terrain</strong> (how tough the walk is).
          </li>
          <li>
            Tap a treasure to see its story, hint, photos, and what other
            adventurers said. Tap <Pill><Bookmark />Save</Pill> to keep it for
            later.
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
      </Prose>
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
      <Prose>
        <ol>
          <li>
            Tap <Pill><Compass />Compass</Pill>. You'll find it front and
            center in the app.
          </li>
          <li>
            It points to the closest treasure. Open it from a treasure's page
            to lock onto that one instead.
          </li>
          <li>
            Follow the arrow. The number is how far away you are. When the
            ring glows green, you're right on top of it. Time to look around.
          </li>
          <li>
            If the arrow gets jumpy, wave your phone in a figure-8 for a few
            seconds. The last few steps are always up to your eyes and the
            hint.
          </li>
        </ol>
        <div className="flex flex-wrap gap-2 pt-2">
          <Button size="sm" onClick={openCompass}>
            <Compass />
            Open the compass
            <ArrowRight />
          </Button>
        </div>
      </Prose>
    ),
  },
  {
    id: 'claim-treasure',
    icon: ScanQrCode,
    title: 'Claim your find',
    blurb: 'Scan the QR and share your story.',
    art: { type: 'png', src: '/share-your-experience.png' },
    palette: 'green',
    body: () => (
      <Prose>
        <ol>
          <li>
            <strong>You found it!</strong> Open the container. Most treasures
            have a small QR code inside. Point your phone's camera at it and
            tap the link.
            <p className="text-sm italic text-white/80 mt-2 mb-0">
              Some treasures have a <strong>Key Quest</strong>: a small task
              the hider asks of you. Do it for them, and they'll show you the
              claim QR.
            </p>
          </li>
          <li>
            Already in the app? Open{' '}
            <NavInline to="/claim" icon={ScanQrCode}>Claim</NavInline> and tap{' '}
            <Pill><Camera />Scan QR</Pill>.
          </li>
          <li>
            Share your story. Tell other adventurers how the hunt went, drop
            in a photo or two, and celebrate your find.
          </li>
          <li>
            <strong>Put the container back exactly as you found it.</strong>{' '}
            Same spot, same camouflage, same lid. The next adventurer is
            counting on you.
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
      </Prose>
    ),
  },
  {
    id: 'hide-treasure',
    icon: Plus,
    title: 'Hide your own',
    blurb: 'Make a treasure for other people to find.',
    art: { type: 'png', src: '/hide-a-treasure.png' },
    palette: 'emerald',
    body: ({ isLoggedIn, startSignup }) => (
      <Prose>
        <p>
          Two ways to go. <Pill>With a QR Code</Pill> means finders scan a
          little code inside your container to prove they were there.{' '}
          <Pill>Without a QR Code</Pill> trusts everyone on their word. Either
          way, you'll do four short steps:
        </p>
        <ol>
          <li>
            <strong>The spot.</strong> Drop a pin where the treasure will live.
            The app will warn you if it looks like private property or water.
          </li>
          <li>
            <strong>The story.</strong> Give it a name, a few words about it,
            and a clever hint. Helpful, but not a giveaway.
          </li>
          <li>
            <strong>The challenge.</strong> How tricky is it to find?
            How tough is the walk? How big is the container? Tell other
            adventurers what to expect.
          </li>
          <li>
            <strong>The reveal.</strong> Add a photo or two of the area (never
            of the hiding spot itself!) and send it out into the world.
          </li>
        </ol>
        <p>
          Then go hide it. Bring a waterproof container, a printed QR if you
          want one (use{' '}
          <NavInline to="/generate-qr" icon={QrCode}>Generate QR</NavInline>),
          and please ask first if the spot isn't somewhere everyone can go.
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
              onClick={() => {
                // Open the sign-up chapter and start the inline signup flow.
                startSignup();
                const signUp = document.getElementById('sign-up');
                signUp?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
              className="rounded-full px-3 min-h-11 text-xs font-semibold"
            >
              <UserPlus className="h-3.5 w-3.5" />
              Join to hide a treasure
            </Button>
          )}
        </div>
      </Prose>
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

  // Inline auth state. `authMode` controls what's rendered inside the
  // sign-up chapter body — `null` shows the prose, `'signup'` shows the full
  // SignupFlow, `'login'` shows the LoginFlow.
  const [authMode, setAuthMode] = useState<'signup' | 'login' | null>(null);

  // Controlled accordion. Start with the sign-up chapter expanded so first-
  // time visitors see the call to action immediately.
  const [openChapters, setOpenChapters] = useState<string[]>(['sign-up']);

  // We deliberately do NOT reset `authMode` based on `isLoggedIn`. The signup
  // flow logs the user in BEFORE the profile step (so the kind 0 metadata can
  // be signed), and we want the user to see the profile form. Only the flow's
  // own onComplete (after profile or skip) should end the inline auth.
  const isLoggedIn = !!user;

  const advanceToNextChapter = () => {
    setAuthMode(null);
    setOpenChapters((prev) => {
      const next = prev.filter((id) => id !== 'sign-up');
      if (!next.includes('find-treasure')) next.push('find-treasure');
      return next;
    });
    // Smooth scroll to the next chapter so the user sees the transition.
    setTimeout(() => {
      const target = document.getElementById('find-treasure');
      target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 250);
  };

  const ctx: ChapterContext = {
    startSignup: () => {
      setAuthMode('signup');
      setOpenChapters((prev) => (prev.includes('sign-up') ? prev : [...prev, 'sign-up']));
    },
    startLogin: () => {
      setAuthMode('login');
      setOpenChapters((prev) => (prev.includes('sign-up') ? prev : [...prev, 'sign-up']));
    },
    cancelAuth: () => setAuthMode(null),
    authMode,
    onAuthComplete: advanceToNextChapter,
    openCompass,
    isLoggedIn,
  };

  // Dotted trail stroke color. White over the photo background.
  const trailStroke = 'text-white/30';

  return (
    <>
      <DesktopHeader />

      <PageHero
        icon={BookOpen}
        title={t('navigation.howTo', 'How To Join The Adventure')}
        description="From signing up to hiding your first cache, in five short chapters."
        compact
        light
      >
        <div className="max-w-2xl mx-auto px-4 pt-2 pb-16">
          {/* Chapter list with zig-zag dotted trail weaving between rows */}
          <div className="relative rounded-3xl backdrop-blur-sm px-4 sm:px-6 py-4 sm:py-6">
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
                strokeWidth="0.45"
                fill="none"
                strokeDasharray="1.5,1.5"
                strokeLinecap="round"
                className={trailStroke}
              />
            </svg>
          </div>

          <Accordion
            type="multiple"
            value={openChapters}
            onValueChange={setOpenChapters}
            className="w-full relative z-10"
          >
            {chapters.map((chapter, idx) => {
              const Icon = chapter.icon;
              // Zig-zag: even rows have image on the left, odd rows on the right.
              const imageRight = idx % 2 === 1;
              return (
                <AccordionItem
                  key={chapter.id}
                  value={chapter.id}
                  id={chapter.id}
                  className="border-b border-white/10 last:border-b-0 scroll-mt-20"
                >
                  <AccordionTrigger className="py-5 hover:no-underline group [&>svg]:text-white [&>svg]:ml-3 [&>svg]:mr-1">
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
                            className="w-full h-full object-contain themed-art"
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
                          <span className="text-[10px] font-mono uppercase tracking-wider text-white/70">
                            Ch. {String(idx + 1).padStart(2, '0')}
                          </span>
                          <Icon className="h-3 w-3 text-white/70" />
                        </div>
                        <div className="text-2xl sm:text-3xl font-bold text-white leading-tight">
                          {chapter.title}
                        </div>
                        <div className="text-[15px] sm:text-base text-white/80 mt-1.5 leading-snug">
                          {chapter.blurb}
                        </div>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="px-1 sm:px-2 pb-5 pt-2 space-y-4">
                      {chapter.body(ctx)}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </div>

        {/* Quiet footer */}
        <p className="text-xs text-white/70 mt-10 text-center">
          Want the deeper dive? See the{' '}
          <Link to="/about" className="font-semibold text-white hover:text-white/80 underline underline-offset-2">
            About page
          </Link>{' '}
          for FAQ, or the{' '}
          <Link to="/blog" className="font-semibold text-white hover:text-white/80 underline underline-offset-2">
            Blog
          </Link>{' '}
          for new features.
        </p>

        {/* Artist credit */}
        <p className="text-[11px] text-white/50 mt-3 text-center">
          Illustrations by{' '}
          <a
            href="https://ditto.pub/npub1c2aqg09fk7cnkhgns25psw0hp94v9v9fdywn36nljmdpypa3ajlq0ag2vv"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-white/70 hover:text-white underline underline-offset-2"
          >
            KrakenM
          </a>
        </p>
      </div>
      </PageHero>
    </>
  );
}
