import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';
import { Map, Plus, Menu, Settings, Bookmark, LogOut, User, QrCode, ScanQrCode, Info, BookOpen, Sparkles, List, Compass } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { LoginArea } from '@/components/auth/LoginArea';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useLoggedInAccounts } from '@/hooks/useLoggedInAccounts';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useTheme } from "@/hooks/useTheme";
import { cn } from '@/utils/utils';
import { useRadarOverlay } from '@/hooks/useRadarOverlay';

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

export function MobileHeader() {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const { user } = useCurrentUser();
  const { currentUser, removeLogin } = useLoggedInAccounts();
  const { theme } = useTheme();
  const themeClasses = getThemeClasses(theme);
  const isHero = location.pathname === '/' || location.pathname === '/adventures';
  const hideHeaderLogo = location.pathname === '/'; // Home has its own large logo in the hero

  const closeSheet = () => setIsOpen(false);

  const navigation = [
    { name: t('navigation.list'), href: '/map?tab=list', icon: List },
    { name: t('navigation.map'), href: '/map?tab=map', icon: Map },
    { name: t('navigation.claimTreasure'), href: '/claim', icon: ScanQrCode },
    { name: t('navigation.new'), href: '/create', icon: Plus },
  ];

  return (
    <header className={cn(
      "w-full md:hidden pt-safe-top",
      isHero
        ? "absolute top-0 inset-x-0 z-50 bg-transparent"
        : cn("sticky top-0 z-40", themeClasses.header)
    )}>
      <div className="container flex h-12 items-center justify-between px-3 xs:px-4">
        {/* Menu Button */}
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={cn("-ml-2", isHero ? "text-white hover:bg-white/15 hover:text-white" : themeClasses.button)}
            >
              <Menu className="h-5 w-5" />
              <span className="sr-only">{t('navigation.toggleMenu')}</span>
            </Button>
          </SheetTrigger>

          {/* Side Sheet Content - Optimized for limited vertical space */}
          <SheetContent side="left" closePosition="left" className="mobile-nav-sheet flex flex-col w-[280px] xs:w-[320px] sm:w-[400px] p-0">
            {/* Scrollable Content Area */}
            <div className="mobile-nav-scroll flex-1 overflow-y-auto pt-12">
              {/* Navigation Links - List Layout */}
              <div className="nav-section p-2 xs:p-3">
                <div className="space-y-1">
                  {navigation.map((item) => (
                    <NavLink
                      key={item.name}
                      to={item.href}
                      icon={item.icon}
                      isActive={location.pathname === item.href}
                      onClick={closeSheet}
                    >
                      {item.name}
                    </NavLink>
                  ))}

                  <NavLink
                    to="/generate-qr"
                    icon={QrCode}
                    isActive={location.pathname === '/generate-qr'}
                    onClick={closeSheet}
                  >
                    {t('navigation.generateQrCode')}
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
                    to="/adventures"
                    icon={Compass}
                    isActive={location.pathname === '/adventures' || location.pathname.startsWith('/adventure/')}
                    onClick={closeSheet}
                  >
                    Adventures
                  </NavLink>

                  <NavLink
                    to="/adventure/naddr1qvzqqqyj35pzppscgyy746fhmrt0nq955z6xmf80pkvrat0yq0hpknqtd00z8z68qq0xzerkv4h8gatjv5knzdehxcuryve4xuerjv3h94nrsmn2w3msduh0ez"
                    icon={Sparkles}
                    isActive={location.pathname === '/adventure/naddr1qvzqqqyj35pzppscgyy746fhmrt0nq955z6xmf80pkvrat0yq0hpknqtd00z8z68qq0xzerkv4h8gatjv5knzdehxcuryve4xuerjv3h94nrsmn2w3msduh0ez'}
                    onClick={closeSheet}
                  >
                    {t('navigation.texasRenFest')}
                  </NavLink>

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

                  {user && (
                    <>
                      <NavLink
                        to="/profile"
                        icon={User}
                        isActive={location.pathname === '/profile'}
                        onClick={closeSheet}
                      >
                        {t('navigation.myProfile')}
                      </NavLink>
                      <NavLink
                        to="/settings"
                        icon={Settings}
                        isActive={location.pathname === '/settings'}
                        onClick={closeSheet}
                      >
                        {t('navigation.appSettings')}
                      </NavLink>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Compact Footer - Always Visible */}
            <div className="mobile-nav-footer border-t bg-muted/50 dark:bg-muted p-2 xs:p-3 shrink-0">
              {/* User Section */}
              {currentUser ? (
                <div className="space-y-2 mb-2 xs:mb-3">
                  {/* Compact User Info */}
                  <div className="flex items-center gap-2 p-1.5 xs:p-2 rounded-lg bg-accent/50">
                    <Avatar className="w-5 h-5 xs:w-6 xs:h-6 shrink-0">
                      <AvatarImage src={currentUser.metadata.picture} alt={currentUser.metadata.name} />
                      <AvatarFallback className="text-[10px] xs:text-xs">
                        {currentUser.metadata.name?.charAt(0) || <User className="w-2.5 h-2.5 xs:w-3 xs:h-3" />}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-[10px] xs:text-xs truncate">
                        {currentUser.metadata.name || `${currentUser.pubkey.slice(0, 8)}...`}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        removeLogin(currentUser.id);
                        closeSheet();
                      }}
                      className="h-5 w-5 xs:h-6 xs:w-6 p-0 hover:bg-destructive/20"
                      title={t('navigation.logOut')}
                    >
                      <LogOut className="w-2.5 h-2.5 xs:w-3 xs:h-3" />
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="mb-2 xs:mb-3">
                  <LoginArea />
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

        {/* Right Side - Login */}
        <div className="flex items-center gap-2 -mr-2">
          <LoginArea />
        </div>
      </div>
    </header>
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
        "flex flex-col items-center justify-center gap-0.5 px-1 py-0.5 text-[10px] transition-colors min-h-[40px]",
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
      "fixed bottom-0 left-0 right-0 z-40 md:hidden pb-safe-bottom transition-transform duration-300",
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

        {/* Center compass button — notched into the bar, peeks slightly */}
        <div className="flex flex-col items-center justify-end h-full pb-1.5">
          <div className="absolute -top-4 flex items-center justify-center">
            {/* Background ring that matches the nav surface — creates the notch */}
            <div className={cn(
              "absolute w-[52px] h-[52px] rounded-full",
              isAdventureTheme ? "bg-adventure-nav" : isDittoTheme ? "bg-card" : "bg-white dark:bg-background"
            )} />
            <button
              onClick={openRadar}
              className="relative flex items-center justify-center w-11 h-11 rounded-full bg-primary text-primary-foreground shadow-md active:scale-95 transition-transform"
            >
              <Compass className="h-5 w-5" />
            </button>
          </div>
          <span className={cn("text-[10px] leading-tight", themeClasses.textMuted)}>
            {t('navigation.compass')}
          </span>
        </div>

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

