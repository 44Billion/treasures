/**
 * AdventureWelcomeOverlay
 * -----------------------
 * A modal-style onboarding card shown to logged-out visitors who land on an
 * Adventure page (typically by scanning an event QR code or following a host's
 * link). The goal is to get a complete newbie from "what is this?" to "I'm in"
 * without leaving the Adventure context.
 *
 * Surface:
 *   - Centered card over a dimmed backdrop. The Adventure page peeks through
 *     so the visitor still sees where they are.
 *   - Header pulls the Adventure's title, image, and host name to anchor the
 *     experience in the real-world event they're attending.
 *   - Body switches between four modes via internal state:
 *       'welcome' - friendly intro + Join / Log in buttons
 *       'signup'  - inline <SignupFlow>
 *       'login'   - inline <LoginFlow>
 *       'howto'   - compact "how it works" explainer with Back to welcome
 *   - Successful signup or login dismisses the overlay; the parent will then
 *     render the underlying AdventureDetail normally.
 *
 * Dismissibility:
 *   - A small "I'll look around first" link in the welcome step closes the
 *     overlay for the rest of this browser session (sessionStorage keyed by
 *     Adventure naddr). Refreshing or returning later brings it back, which
 *     is the right behavior for event QR codes that get scanned repeatedly.
 *
 * The overlay never shows for logged-in users; the parent gates rendering on
 * `!user`.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Compass,
  HelpCircle,
  KeyRound,
  MapPin,
  ScanQrCode,
  Sparkles,
  UserPlus,
  X,
} from 'lucide-react';

import { SignupFlow } from '@/components/auth/SignupFlow';
import { LoginFlow } from '@/components/auth/LoginFlow';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useAuthor } from '@/hooks/useAuthor';
import { useIsMobile } from '@/hooks/useIsMobile';
import type { Adventure } from '@/types/adventure';

interface AdventureWelcomeOverlayProps {
  /** The Adventure whose welcome screen we're showing. */
  adventure: Adventure;
  /** Called when the visitor successfully signs up or logs in. */
  onAuthComplete: () => void;
  /** Called when the visitor explicitly dismisses without authenticating. */
  onDismiss: () => void;
}

type Mode = 'welcome' | 'signup' | 'login' | 'howto';

export function AdventureWelcomeOverlay({
  adventure,
  onAuthComplete,
  onDismiss,
}: AdventureWelcomeOverlayProps) {
  const [mode, setMode] = useState<Mode>('welcome');
  // Compass is mobile-only (it relies on device orientation + GPS), so we
  // only mention it as a finding option for mobile visitors. Desktop folks
  // get a Map-only step 2.
  const isMobile = useIsMobile();

  // Pull the host's profile so we can name-drop them in the welcome copy. This
  // makes the experience feel personal at events ("[Real Name] hid these
  // treasures for you") instead of anonymous.
  const host = useAuthor(adventure.pubkey);
  const hostName =
    host.data?.metadata?.name ||
    host.data?.metadata?.display_name ||
    'A fellow adventurer';
  const hostPicture = host.data?.metadata?.picture;
  const hostInitial = hostName.charAt(0).toUpperCase();

  // The Adventure stores its treasure references as "a" tags; the count is
  // what the visitor cares about ("5 treasures hidden for you").
  const treasureCount = adventure.geocacheRefs?.length ?? 0;

  // Lock scroll on the body while the overlay is up so it feels like a true
  // modal regardless of how tall the underlying page is.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  // Subtitle copy adapts to the treasure count. Singular / plural / unknown
  // are all handled so the welcome never reads awkwardly.
  const subtitle = useMemo(() => {
    if (treasureCount === 0) {
      return `${hostName} has put together an adventure for you.`;
    }
    if (treasureCount === 1) {
      return `${hostName} has hidden a treasure for you to find.`;
    }
    return `${hostName} has hidden ${treasureCount} treasures for you to find.`;
  }, [hostName, treasureCount]);

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center px-4 py-6 sm:py-10 bg-black/70 backdrop-blur-sm overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="adventure-welcome-title"
    >
      <div className="relative w-full max-w-md rounded-3xl bg-background shadow-2xl border border-border overflow-hidden my-auto">
        {/* Close button. Only meaningful on the welcome step; once the visitor
            is in the signup/login/how-to flow they back out via in-flow Back. */}
        {mode === 'welcome' && (
          <button
            type="button"
            onClick={onDismiss}
            className="absolute top-3 right-3 z-10 rounded-full p-2 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            aria-label="Look around first"
          >
            <X className="h-6 w-6" />
          </button>
        )}

        {/* Header: the Adventure's image (if any) as a warm hero, then the
            title and host. Falls back to a gradient when there's no image so
            the card never looks empty. */}
        <div className="relative h-32 sm:h-36 bg-gradient-to-br from-primary/30 to-emerald-500/20">
          {adventure.image && (
            <img
              src={adventure.image}
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
          <div className="absolute bottom-3 left-4 right-4 flex items-end gap-3">
            <Avatar className="h-12 w-12 border-2 border-background shadow-md">
              {hostPicture && <AvatarImage src={hostPicture} alt={hostName} />}
              <AvatarFallback>{hostInitial}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">Hosted by</p>
              <p className="text-sm font-semibold truncate">{hostName}</p>
            </div>
          </div>
        </div>

        <div className="px-5 sm:px-6 pt-4 pb-5 sm:pb-6 space-y-4">
          {mode === 'welcome' && (
            <>
              <div className="space-y-1.5">
                <h2
                  id="adventure-welcome-title"
                  className="text-xl sm:text-2xl font-bold leading-tight"
                >
                  Welcome to {adventure.title}!
                </h2>
                <p className="text-sm text-muted-foreground">{subtitle}</p>
              </div>

              <ol className="text-sm space-y-2 text-foreground/90">
                <li className="flex gap-2">
                  <span className="font-semibold text-primary">1.</span>
                  <span>
                    Tap <UserPlus className="inline h-4 w-4 align-text-bottom text-primary" />{' '}
                    <strong>Join</strong>. Takes about a minute, no email needed.
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="font-semibold text-primary">2.</span>
                  <span>
                    Browse the{' '}
                    <MapPin className="inline h-4 w-4 align-text-bottom text-primary" />{' '}
                    <strong>Map</strong> to find each treasure
                    {isMobile ? (
                      <>
                        , or tap the{' '}
                        <Compass className="inline h-4 w-4 align-text-bottom text-primary" />{' '}
                        <strong>Compass</strong> button at the bottom of your
                        screen to let it guide you in
                      </>
                    ) : null}
                    .
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="font-semibold text-primary">3.</span>
                  <div className="space-y-1">
                    <span>
                      Find the treasure!{' '}
                      <ScanQrCode className="inline h-4 w-4 align-text-bottom text-primary" />{' '}
                      <strong>Scan</strong> the QR inside the container or go
                      to the listing to log your find.
                    </span>
                    <p className="text-xs italic text-muted-foreground">
                      Some treasures have a <strong>Key Quest</strong>: a small
                      task set by the treasure owner (like picking up litter)
                      before you get the QR.
                    </p>
                  </div>
                </li>
              </ol>

              <div className="flex flex-col gap-2 pt-1">
                <Button
                  size="lg"
                  className="w-full rounded-full font-semibold"
                  onClick={() => setMode('signup')}
                >
                  <UserPlus className="h-4 w-4" />
                  Join the adventure
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="w-full rounded-full"
                  onClick={() => setMode('login')}
                >
                  <KeyRound className="h-3.5 w-3.5" />
                  Already have a treasure key? Log in
                </Button>
              </div>

              <div className="flex items-center justify-between pt-2 text-xs text-muted-foreground gap-3">
                <button
                  type="button"
                  onClick={() => setMode('howto')}
                  className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors min-h-9"
                >
                  <HelpCircle className="h-5 w-5" />
                  How does this work?
                </button>
                <button
                  type="button"
                  onClick={onDismiss}
                  className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors min-h-9"
                >
                  <Compass className="h-5 w-5" />
                  I'll look around first
                </button>
              </div>
            </>
          )}

          {mode === 'signup' && (
            <div className="space-y-3">
              <SignupFlow onComplete={onAuthComplete} />
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setMode('welcome')}
                  className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
                >
                  Back
                </button>
              </div>
            </div>
          )}

          {mode === 'login' && (
            <div className="space-y-3">
              <LoginFlow
                onLogin={onAuthComplete}
                onSignup={() => setMode('signup')}
              />
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setMode('welcome')}
                  className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
                >
                  Back
                </button>
              </div>
            </div>
          )}

          {mode === 'howto' && (
            <div className="space-y-4">
              <button
                type="button"
                onClick={() => setMode('welcome')}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors min-h-9 -ml-1"
              >
                <ArrowLeft className="h-5 w-5" />
                Back
              </button>

              <div className="space-y-1">
                <h3 className="text-lg font-bold leading-tight">
                  How treasure hunting works
                </h3>
                <p className="text-sm text-muted-foreground">
                  Four short steps to your first find.
                </p>
              </div>

              <ol className="space-y-3">
                <li className="flex gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 pt-0.5">
                    <p className="text-sm font-semibold">Forge your treasure key</p>
                    <p className="text-sm text-muted-foreground">
                      A free account in about a minute. Keep your key safe; it's
                      the only way back into your adventure.
                    </p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                    <MapPin className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 pt-0.5">
                    <p className="text-sm font-semibold">Pick a treasure</p>
                    <p className="text-sm text-muted-foreground">
                      Open the map and tap one that catches your eye. Read the
                      hint and head out.
                    </p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                    <Compass className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 pt-0.5">
                    <p className="text-sm font-semibold">Follow the compass</p>
                    <p className="text-sm text-muted-foreground">
                      The arrow points to the treasure. When the ring glows
                      green, you're right on top of it.
                    </p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                    <ScanQrCode className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 pt-0.5">
                    <p className="text-sm font-semibold">Claim your find</p>
                    <p className="text-sm text-muted-foreground">
                      Scan the QR inside the container, share your story, and
                      put it back exactly as you found it.
                    </p>
                    <p className="text-sm italic text-muted-foreground mt-1">
                      Some treasures have a <strong>Key Quest</strong>: a small
                      task the hider asks of you. Do it for them, and they'll
                      show you the claim QR.
                    </p>
                  </div>
                </li>
              </ol>

              <Button
                size="lg"
                className="w-full rounded-full font-semibold"
                onClick={() => setMode('signup')}
              >
                <UserPlus className="h-4 w-4" />
                Ready? Join the adventure
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
