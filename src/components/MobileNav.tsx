import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';
import {
  Map, Plus, Menu, Settings, Bookmark, LogOut, User, UserPlus, QrCode,
  ScanQrCode, Info, BookOpen, Sparkles, List, Compass, ChevronDown, ChevronUp,
  Search, Sun, Moon, Sword, Mountain, Monitor, Scroll,
} from 'lucide-react';
import { nip19 } from 'nostr-tools';
import { DittoIcon } from '@/components/icons/DittoIcon';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import LoginDialog from '@/components/auth/LoginDialog';
import SignupDialog from '@/components/auth/SignupDialog';
import { WelcomeModal } from '@/components/auth/WelcomeModal';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useLoggedInAccounts } from '@/hooks/useLoggedInAccounts';
import { useActiveProfileTheme } from '@/hooks/useActiveProfileTheme';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useTheme } from "@/hooks/useTheme";
import { cn } from '@/utils/utils';
import { useRadarOverlay } from '@/hooks/useRadarOverlay';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// Helper function for consistent theme-aware styling
function getThemeClasses(theme: string | undefined) {
  if (theme === 'adventure') {
    return {
      header: 'bg-adventure-nav',
      text: 'text-stone-200',
      textMuted: 'text-stone-400',
      textActive: 'text-stone-200',
      button: 'text-stone-200 hover:bg-stone-700/50 hover:text-stone-100',
      icon: 'sepia',
    };
  }
  if (theme === 'ditto') {
    return {
      header: 'bg-card',
      text: 'text-foreground',
      textMuted: 'text-muted-foreground',
      textActive: 'text-primary',
      button: 'text-foreground hover:bg-accent hover:text-accent-foreground',
      icon: 'ditto-logo',
    };
  }
  if (theme === 'mojave') {
    return {
      header: 'bg-card',
      text: 'text-foreground',
      textMuted: 'text-muted-foreground',
      textActive: 'text-primary',
      button: 'text-foreground hover:bg-accent hover:text-accent-foreground',
      icon: 'mojave-logo',
    };
  }
  return {
    header: 'bg-white dark:bg-background',
    text: 'text-gray-900 dark:text-foreground',
    textMuted: 'text-gray-500 dark:text-muted-foreground',
    textActive: 'text-primary',
    button: 'text-gray-800 dark:text-foreground hover:bg-gray-100 dark:hover:bg-accent hover:text-gray-900 dark:hover:text-accent-foreground border-gray-200 dark:border-border',
    icon: '',
  };
}

// Compact navigation link component for additional links
function NavLink({
  to,
  icon: Icon,
  children,
  isActive,
  onClick
}: {
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground min-h-[40px]",
        isActive
          ? "bg-accent text-accent-foreground"
          : "text-muted-foreground"
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="truncate">{children}</span>
    </Link>
  );
}

// Section label for grouped nav items
function NavSectionLabel({ children, first }: { children: React.ReactNode; first?: boolean }) {
  return (
    <div className={cn("px-3 pb-1", first ? "pt-0.5" : "pt-3")}>
      <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground/70">
        {children}
      </span>
    </div>
  );
}

export function MobileHeader() {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [accountExpanded, setAccountExpanded] = useState(false);
  const location = useLocation();
  const { user } = useCurrentUser();
  const { currentUser, otherUsers, setLogin, removeLogin, isLoadingCurrentUser } = useLoggedInAccounts();
  const { theme, resolvedTheme, setTheme } = useTheme();
  const { hasDittoTheme } = useActiveProfileTheme();
  const themeClasses = getThemeClasses(theme);
  const isHero = location.pathname === '/' || location.pathname === '/adventures';
  const hideHeaderLogo = location.pathname === '/'; // Home has its own large logo in the hero
  const isAdventureTheme = theme === 'adventure';

  // Track ditto-dark class changes for status bar sync
  const [isDittoDark, setIsDittoDark] = useState(
    () => document.documentElement.classList.contains('ditto-dark')
  );
  useEffect(() => {
    if (theme !== 'ditto') return;
    const observer = new MutationObserver(() => {
      setIsDittoDark(document.documentElement.classList.contains('ditto-dark'));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    // Sync immediately in case it was set before observer attached
    setIsDittoDark(document.documentElement.classList.contains('ditto-dark'));
    return () => observer.disconnect();
  }, [theme]);

  // On native, sync the status bar icon style with header context.
  // Hero pages have dark image backgrounds → need light/white status bar icons,
  // but only while the hero is visible. Once the user scrolls past the hero into
  // light content, switch back to theme-based icons.
  const [inHeroViewport, setInHeroViewport] = useState(isHero);

  useEffect(() => {
    if (!isHero) {
      setInHeroViewport(false);
      return;
    }

    setInHeroViewport(true);

    const handleScroll = () => {
      // Hero is min-h-dvh on mobile; switch when scrolled past ~95% of viewport
      setInHeroViewport(window.scrollY < window.innerHeight * 0.95);
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isHero]);

  const isDarkTheme = resolvedTheme === 'dark' || resolvedTheme === 'adventure'
    || (resolvedTheme === 'ditto' && isDittoDark);

  useEffect(() => {
    if (isDarkTheme || inHeroViewport) {
      // Dark themes always need light/white status bar icons.
      // Hero viewport also needs them (dark image background).
      document.documentElement.setAttribute('data-status-bar', 'dark');
    } else {
      document.documentElement.setAttribute('data-status-bar', 'light');
    }
  }, [inHeroViewport, isDarkTheme]);

  // Login/signup dialog state (managed here since LoginArea is no longer in the header)
  const [loginDialogOpen, setLoginDialogOpen] = useState(false);
  const [signupDialogOpen, setSignupDialogOpen] = useState(false);
  const [welcomeModalOpen, setWelcomeModalOpen] = useState(false);
  const [isNewUser, setIsNewUser] = useState(false);
  const [pendingWelcome, setPendingWelcome] = useState<{ isNewUser: boolean } | null>(null);

  const handleWelcomeModalClose = () => {
    setWelcomeModalOpen(false);
    setIsNewUser(false);
    setPendingWelcome(null);
    localStorage.removeItem('treasures_last_signup');
  };

  const handleLogin = (isNewUserLogin = false) => {
    setLoginDialogOpen(false);
    setSignupDialogOpen(false);
    setIsNewUser(isNewUserLogin);
    setPendingWelcome({ isNewUser: isNewUserLogin });
  };

  // Show welcome modal when user logs in and we have pending welcome
  useEffect(() => {
    const loggedInUser = currentUser || user;
    if (loggedInUser && pendingWelcome) {
      const timer = setTimeout(() => {
        setIsNewUser(pendingWelcome.isNewUser);
        setWelcomeModalOpen(true);
        setPendingWelcome(null);
      }, 500);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [currentUser, user, pendingWelcome]);

  // Fallback welcome modal trigger for fresh signups
  useEffect(() => {
    const loggedInUser = currentUser || user;
    if (loggedInUser && !pendingWelcome && !welcomeModalOpen && !loginDialogOpen && !signupDialogOpen) {
      const lastSignupTime = localStorage.getItem('treasures_last_signup');
      const now = Date.now();
      if (lastSignupTime && (now - parseInt(lastSignupTime)) < 10000) {
        setIsNewUser(true);
        setWelcomeModalOpen(true);
        localStorage.removeItem('treasures_last_signup');
      }
    }
    return undefined;
  }, [currentUser, user, pendingWelcome, welcomeModalOpen, loginDialogOpen, signupDialogOpen]);

  const closeSheet = () => {
    setIsOpen(false);
    setAccountExpanded(false);
  };

  const handleLogout = () => {
    if (currentUser) {
      removeLogin(currentUser.id);
    }
    closeSheet();
  };

  // Truncated npub for display
  const npubDisplay = currentUser
    ? (() => {
        try {
          const npub = nip19.npubEncode(currentUser.pubkey);
          return `${npub.slice(0, 12)}...${npub.slice(-4)}`;
        } catch {
          return `${currentUser.pubkey.slice(0, 8)}...`;
        }
      })()
    : null;

  return (
    <>
      <header className={cn(
        "w-full lg:hidden pt-safe-top",
        isHero
          ? "absolute top-0 inset-x-0 z-50 bg-transparent"
          : cn("sticky top-0 z-40", themeClasses.header)
      )}>
        <div className="container flex h-12 items-center justify-between px-3 xs:px-4">
          {/* Left: Profile avatar (logged in) or Hamburger (logged out) — opens the sheet */}
          <Sheet open={isOpen} onOpenChange={(open) => { setIsOpen(open); if (!open) setAccountExpanded(false); }}>
            <SheetTrigger asChild>
              {currentUser ? (
                <button
                  className={cn(
                    "flex items-center gap-2 rounded-full p-1 -ml-1 transition-all",
                    isHero ? "hover:bg-white/15" : "hover:bg-accent"
                  )}
                >
                  <Avatar className="w-7 h-7 xs:w-8 xs:h-8">
                    {isLoadingCurrentUser ? (
                      <AvatarFallback>
                        <div className="animate-pulse bg-muted rounded-full w-full h-full flex items-center justify-center">
                          <User className="w-3 h-3 text-muted-foreground" />
                        </div>
                      </AvatarFallback>
                    ) : (
                      <>
                        <AvatarImage src={currentUser.metadata.picture} alt={currentUser.metadata.name} />
                        <AvatarFallback className="text-xs">
                          {currentUser.metadata.name?.charAt(0) || <User className="w-3 h-3" />}
                        </AvatarFallback>
                      </>
                    )}
                  </Avatar>
                  <span className="sr-only">{t('navigation.toggleMenu')}</span>
                </button>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn("-ml-2", isHero ? "text-white hover:bg-white/15 hover:text-white" : themeClasses.button)}
                >
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">{t('navigation.toggleMenu')}</span>
                </Button>
              )}
            </SheetTrigger>

            {/* Side Sheet Content */}
            <SheetContent side="left" hideClose className="mobile-nav-sheet flex flex-col w-[280px] xs:w-[320px] sm:w-[400px] p-0">
              {/* Profile Section at Top */}
              <div className="shrink-0 pt-safe-top">
                {currentUser ? (
                  <div>
                    {/* User row with expand toggle */}
                    <button
                      onClick={() => setAccountExpanded((v) => !v)}
                      aria-expanded={accountExpanded}
                      aria-controls="account-expanded-panel"
                      className="flex items-center gap-3 px-3 py-2.5 hover:bg-accent/50 transition-colors w-full text-left"
                    >
                      <Avatar className="w-9 h-9 shrink-0">
                        {isLoadingCurrentUser ? (
                          <AvatarFallback>
                            <div className="animate-pulse bg-muted rounded-full w-full h-full flex items-center justify-center">
                              <User className="w-4 h-4 text-muted-foreground" />
                            </div>
                          </AvatarFallback>
                        ) : (
                          <>
                            <AvatarImage src={currentUser.metadata.picture} alt={currentUser.metadata.name} />
                            <AvatarFallback>{currentUser.metadata.name?.charAt(0) || <User className="w-4 h-4" />}</AvatarFallback>
                          </>
                        )}
                      </Avatar>
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="font-semibold text-sm truncate">
                          {currentUser.metadata.name || `${currentUser.pubkey.slice(0, 8)}...`}
                        </span>
                        <span className="text-xs text-muted-foreground truncate">
                          {npubDisplay}
                        </span>
                      </div>
                      {accountExpanded
                        ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" />
                        : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                      }
                    </button>

                    {/* Expanded account actions */}
                    {accountExpanded && (
                      <div id="account-expanded-panel" className="border-b">
                        {/* Other accounts */}
                        {otherUsers.map((account) => (
                          <button
                            key={account.id}
                            onClick={() => { setLogin(account.id); closeSheet(); }}
                            className="flex items-center gap-3 w-full px-4 py-2 hover:bg-accent/50 transition-colors"
                          >
                            <Avatar className="w-7 h-7 shrink-0">
                              {account.isLoadingMetadata ? (
                                <AvatarFallback>
                                  <div className="animate-pulse bg-muted rounded-full w-full h-full flex items-center justify-center">
                                    <User className="w-3 h-3 text-muted-foreground" />
                                  </div>
                                </AvatarFallback>
                              ) : (
                                <>
                                  <AvatarImage src={account.metadata.picture} alt={account.metadata.name} />
                                  <AvatarFallback className="text-xs">
                                    {account.metadata.name?.charAt(0) || <User className="w-3 h-3" />}
                                  </AvatarFallback>
                                </>
                              )}
                            </Avatar>
                            <div className="flex flex-col min-w-0">
                              <span className="text-sm font-medium truncate">
                                {account.metadata.name || account.pubkey.slice(0, 8)}
                              </span>
                            </div>
                          </button>
                        ))}

                        <button
                          onClick={() => { closeSheet(); setLoginDialogOpen(true); }}
                          className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-muted-foreground hover:bg-accent/50 transition-colors"
                        >
                          <UserPlus className="w-4 h-4 shrink-0" />
                          <span>{t('navigation.addAnotherAccount')}</span>
                        </button>

                        <button
                          onClick={handleLogout}
                          className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-destructive hover:bg-destructive/10 transition-colors"
                        >
                          <LogOut className="w-4 h-4 shrink-0" />
                          <span>{t('navigation.logOut')}</span>
                        </button>
                      </div>
                    )}

                    {!accountExpanded && <div className="border-b" />}
                  </div>
                ) : (
                  <div className="px-3 py-3 border-b">
                    <Button
                      onClick={() => { closeSheet(); setLoginDialogOpen(true); }}
                      className="flex items-center gap-2 rounded-full bg-primary text-primary-foreground font-medium transition-all hover:bg-primary/90 w-full"
                    >
                      <User className="w-4 h-4" />
                      <span>{t('login.button')}</span>
                    </Button>
                  </div>
                )}
              </div>

              {/* Scrollable Navigation */}
              <div className="mobile-nav-scroll flex-1 overflow-y-auto">
                <div className="px-2 pb-2 xs:px-3 xs:pb-3">
                  {/* Explore Section */}
                  <NavSectionLabel first>{t('navigation.explore')}</NavSectionLabel>
                  <div className="space-y-0.5">
                    <NavLink
                      to="/map?tab=map"
                      icon={Search}
                      isActive={location.pathname === '/map' && !location.search.includes('tab=list')}
                      onClick={closeSheet}
                    >
                      {isAdventureTheme ? t('navigation.revealMap') : t('navigation.exploreMap')}
                    </NavLink>
                    <NavLink
                      to="/map?tab=list"
                      icon={List}
                      isActive={location.pathname === '/map' && location.search.includes('tab=list')}
                      onClick={closeSheet}
                    >
                      {t('navigation.list')}
                    </NavLink>
                    <NavLink
                      to="/claim"
                      icon={isAdventureTheme ? Scroll : ScanQrCode}
                      isActive={location.pathname === '/claim'}
                      onClick={closeSheet}
                    >
                      {isAdventureTheme ? t('navigation.claimArtifact') : t('navigation.claimTreasure')}
                    </NavLink>
                    <NavLink
                      to="/generate-qr"
                      icon={QrCode}
                      isActive={location.pathname === '/generate-qr'}
                      onClick={closeSheet}
                    >
                      {t('navigation.generateQrCode')}
                    </NavLink>
                    {user && (
                      <NavLink
                        to="/create"
                        icon={Plus}
                        isActive={location.pathname === '/create'}
                        onClick={closeSheet}
                      >
                        {isAdventureTheme ? t('navigation.concealGeocache') : t('navigation.hideGeocache')}
                      </NavLink>
                    )}
                  </div>

                  {/* Adventures Section */}
                  <NavSectionLabel>Adventures</NavSectionLabel>
                  <div className="space-y-0.5">
                    <NavLink
                      to="/adventures"
                      icon={Compass}
                      isActive={location.pathname === '/adventures'}
                      onClick={closeSheet}
                    >
                      Adventures
                    </NavLink>
                    <NavLink
                      to="/adventure/naddr1qvzqqqyj35pzppscgyy746fhmrt0nq955z6xmf80pkvrat0yq0hpknqtd00z8z68qq0xzerkv4h8gatjv5knzdehxcuryve4xuerjv3h94nrsmn2w3msduh0ez"
                      icon={Sparkles}
                      isActive={location.pathname.includes('naddr1qvzqqqyj35pzppscgyy746fhmrt0nq955z6xmf80pkvrat0yq0hpknqtd00z8z68qq0xzerkv4h8gatjv5knzdehxcuryve4xuerjv3h94nrsmn2w3msduh0ez')}
                      onClick={closeSheet}
                    >
                      {t('navigation.texasRenFest')}
                    </NavLink>
                  </div>

                  {/* More Section */}
                  <NavSectionLabel>{t('navigation.more', 'More')}</NavSectionLabel>
                  <div className="space-y-0.5">
                    <NavLink
                      to="/blog"
                      icon={BookOpen}
                      isActive={location.pathname.startsWith('/blog')}
                      onClick={closeSheet}
                    >
                      {t('navigation.blog')}
                    </NavLink>
                    <NavLink
                      to="/about"
                      icon={Info}
                      isActive={location.pathname === '/about'}
                      onClick={closeSheet}
                    >
                      {t('navigation.about')}
                    </NavLink>
                    <a
                      href="https://ditto.pub"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground text-muted-foreground min-h-[44px]"
                      onClick={closeSheet}
                    >
                      <img src="https://ditto.pub/favicon.ico" alt="" className="h-4 w-4 shrink-0" />
                      <span className="truncate">{t('navigation.viewOnDitto')}</span>
                    </a>
                  </div>

                  {/* Account Section (logged in only) */}
                  {user && (
                    <>
                      <NavSectionLabel>{t('navigation.account', 'Account')}</NavSectionLabel>
                      <div className="space-y-0.5">
                        <NavLink
                          to={`/profile/${currentUser?.pubkey || ''}`}
                          icon={User}
                          isActive={location.pathname === '/profile' || location.pathname.startsWith('/profile/')}
                          onClick={closeSheet}
                        >
                          {t('navigation.myProfile')}
                        </NavLink>
                        <NavLink
                          to="/saved"
                          icon={Bookmark}
                          isActive={location.pathname === '/saved'}
                          onClick={closeSheet}
                        >
                          {t('navigation.savedCaches')}
                        </NavLink>
                        <NavLink
                          to="/settings"
                          icon={Settings}
                          isActive={location.pathname === '/settings'}
                          onClick={closeSheet}
                        >
                          {t('navigation.appSettings')}
                        </NavLink>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Footer: Theme Selector + Settings for logged-out users */}
              <div className="mobile-nav-footer border-t bg-muted/50 dark:bg-muted p-2 xs:p-3 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))] xs:pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] shrink-0">
                {/* Theme Selector */}
                <div className="px-1">
                  <label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground/70 mb-1 block">
                    {t('theme.toggle')}
                  </label>
                  <Select value={theme} onValueChange={setTheme}>
                    <SelectTrigger className="w-full min-h-11 text-xs" aria-label={t('theme.toggle')}>
                      <SelectValue>
                        <div className="flex items-center gap-2">
                          {theme === 'light' && <Sun className="h-3.5 w-3.5" />}
                          {theme === 'dark' && <Moon className="h-3.5 w-3.5" />}
                          {theme === 'adventure' && <Sword className="h-3.5 w-3.5" />}
                          {theme === 'mojave' && <Mountain className="h-3.5 w-3.5" />}
                          {theme === 'ditto' && <DittoIcon className="h-3.5 w-3.5" />}
                          {theme === 'system' && <Monitor className="h-3.5 w-3.5" />}
                          <span>
                            {theme === 'light' && t('theme.light')}
                            {theme === 'dark' && t('theme.dark')}
                            {theme === 'adventure' && t('theme.adventure')}
                            {theme === 'mojave' && t('theme.mojave')}
                            {theme === 'ditto' && t('theme.ditto')}
                            {theme === 'system' && t('theme.system')}
                          </span>
                        </div>
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="light">
                        <div className="flex items-center gap-2">
                          <Sun className="h-4 w-4" />
                          {t('theme.light')}
                        </div>
                      </SelectItem>
                      <SelectItem value="dark">
                        <div className="flex items-center gap-2">
                          <Moon className="h-4 w-4" />
                          {t('theme.dark')}
                        </div>
                      </SelectItem>
                      <SelectItem value="adventure">
                        <div className="flex items-center gap-2">
                          <Sword className="h-4 w-4" />
                          {t('theme.adventure')}
                        </div>
                      </SelectItem>
                      <SelectItem value="mojave">
                        <div className="flex items-center gap-2">
                          <Mountain className="h-4 w-4" />
                          {t('theme.mojave')}
                        </div>
                      </SelectItem>
                      {hasDittoTheme && (
                        <SelectItem value="ditto">
                          <div className="flex items-center gap-2">
                            <DittoIcon className="h-4 w-4" />
                            {t('theme.ditto')}
                          </div>
                        </SelectItem>
                      )}
                      <SelectItem value="system">
                        <div className="flex items-center gap-2">
                          <Monitor className="h-4 w-4" />
                          {t('theme.system')}
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Settings link for logged-out users */}
                {!user && (
                  <div className="mt-2">
                    <Link
                      to="/settings"
                      onClick={closeSheet}
                      className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                    >
                      <Settings className="h-3.5 w-3.5" />
                      {t('navigation.appSettings')}
                    </Link>
                  </div>
                )}
              </div>
            </SheetContent>
          </Sheet>

          {/* Center Logo - hidden on home page where it's displayed large in the hero */}
          {!hideHeaderLogo && (
            <Link to="/" className="absolute left-1/2 transform -translate-x-1/2 flex items-center">
              <img
                src="/icon.svg"
                alt="Treasures"
                className={cn(
                  "h-7 w-7 xs:h-8 xs:w-8 transition-all duration-200",
                  isHero ? "drop-shadow-lg brightness-110" : themeClasses.icon
                )}
              />
            </Link>
          )}

          {/* Right Side - Join button when logged out, spacer when logged in */}
          {!user ? (
            <Button
              size="sm"
              onClick={() => setSignupDialogOpen(true)}
              className="rounded-full px-3 min-h-11 text-xs font-semibold"
            >
              {t('auth.join', 'Join')}
            </Button>
          ) : (
            <div className="w-11" />
          )}
        </div>
      </header>

      {/* Login/Signup Dialogs */}
      <LoginDialog
        isOpen={loginDialogOpen}
        onClose={() => setLoginDialogOpen(false)}
        onLogin={handleLogin}
        onSignup={() => setSignupDialogOpen(true)}
      />

      <SignupDialog
        isOpen={signupDialogOpen}
        onClose={() => setSignupDialogOpen(false)}
        onComplete={() => handleLogin(true)}
      />

      <WelcomeModal
        isOpen={welcomeModalOpen}
        onClose={handleWelcomeModalClose}
        isNewUser={isNewUser}
      />
    </>
  );
}

// Bottom navigation item component
function BottomNavItem({
  to,
  icon: Icon,
  children,
  isActive,
  themeClasses
}: {
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  isActive: boolean;
  themeClasses: ReturnType<typeof getThemeClasses>;
}) {
  return (
    <Link
      to={to}
      className={cn(
        "flex flex-col items-center justify-center gap-0.5 px-1 py-0.5 text-[10px] transition-colors min-h-[44px]",
        isActive
          ? themeClasses.textActive
          : cn(themeClasses.textMuted, "hover:text-gray-900 dark:hover:text-foreground")
      )}
    >
      <div className="flex items-center justify-center w-5 h-5">
        <Icon className={cn("h-4 w-4", isActive && themeClasses.textActive)} />
      </div>
      <span className={cn(
        "text-center leading-tight max-w-[60px] truncate",
        isActive && cn(themeClasses.textActive, "font-medium")
      )}>
        {children}
      </span>
    </Link>
  );
}

// Helper function to extract pathname from href
function getPathnameFromHref(href: string): string {
  const [pathname] = href.split('?');
  return pathname || href;
}

export function MobileBottomNav() {
  const { t } = useTranslation();
  const location = useLocation();
  const { theme } = useTheme();
  const { open: openRadar } = useRadarOverlay();
  const isAdventureTheme = theme === 'adventure';
  const isDittoTheme = theme === 'ditto';
  const isMojaveTheme = theme === 'mojave';
  const themeClasses = getThemeClasses(theme);
  const isHomePage = location.pathname === '/';
  const [pastHero, setPastHero] = useState(!isHomePage);

  useEffect(() => {
    if (!isHomePage) {
      setPastHero(true);
      return;
    }

    const handleScroll = () => {
      setPastHero(window.scrollY > 50);
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isHomePage]);

  const leftNav = [
    { name: t('navigation.list'), href: '/map?tab=list', icon: List },
    { name: t('navigation.map'), href: '/map?tab=map', icon: Map },
  ];

  const rightNav = [
    { name: t('navigation.claim'), href: '/claim', icon: ScanQrCode },
    { name: t('navigation.new'), href: '/create', icon: Plus },
  ];

  const isItemActive = (href: string) => {
    const searchParams = new URLSearchParams(location.search);
    const currentTab = searchParams.get('tab');

    if (href.includes('/map?tab=')) {
      const itemTab = href.includes('tab=list') ? 'list' : 'map';
      return location.pathname === '/map' && currentTab === itemTab;
    }
    return location.pathname === getPathnameFromHref(href);
  };

  return (
    <nav className={cn(
      "fixed bottom-0 left-0 right-0 z-40 lg:hidden pb-safe-bottom transition-transform duration-300",
      themeClasses.header,
      pastHero ? "translate-y-0" : "translate-y-[calc(100%+1.5rem)]"
    )}>
      <div className="relative grid grid-cols-5 h-12 items-center">
        {/* Left two items */}
        {leftNav.map((item) => (
          <BottomNavItem
            key={item.href}
            to={item.href}
            icon={item.icon}
            isActive={isItemActive(item.href)}
            themeClasses={themeClasses}
          >
            {item.name}
          </BottomNavItem>
        ))}

        {/* Center compass button — notched into the bar, peeks slightly.
            The whole cell (label + FAB) is a single button for a large tap target. */}
        <button
          type="button"
          onClick={openRadar}
          aria-label={t('navigation.radar', 'Radar')}
          className="relative flex flex-col items-center justify-end h-full pb-1.5 min-h-[44px] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
        >
          <span className="absolute left-1/2 -translate-x-1/2 -top-4 flex items-center justify-center pointer-events-none">
            {/* Background ring that matches the nav surface — creates the notch */}
            <span className={cn(
              "absolute w-[52px] h-[52px] rounded-full",
              isAdventureTheme ? "bg-adventure-nav" : isDittoTheme || isMojaveTheme ? "bg-card" : "bg-white dark:bg-background"
            )} />
            <span
              className="relative flex items-center justify-center w-11 h-11 rounded-full bg-primary text-primary-foreground shadow-md"
            >
              <Compass className="h-5 w-5" aria-hidden="true" />
            </span>
          </span>
          <span className={cn("text-[10px] leading-tight", themeClasses.textMuted)}>
            {t('navigation.radar', 'Radar')}
          </span>
        </button>

        {/* Right two items */}
        {rightNav.map((item) => (
          <BottomNavItem
            key={item.href}
            to={item.href}
            icon={item.icon}
            isActive={isItemActive(item.href)}
            themeClasses={themeClasses}
          >
            {item.name}
          </BottomNavItem>
        ))}
      </div>
    </nav>
  );
}
