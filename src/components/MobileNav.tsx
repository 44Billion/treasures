import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';
import { Home, Map, Plus, Menu, Settings, Bookmark, LogOut, User, QrCode, ScanQrCode, Info, BookOpen, Sparkles, List } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { LoginArea } from '@/components/auth/LoginArea';
import { RelaySelector } from '@/components/RelaySelector';
import { useCurrentUser } from '@/features/auth/hooks/useCurrentUser';
import { useLoggedInAccounts } from '@/features/geocache/hooks/useLoggedInAccounts';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useTheme } from "@/shared/hooks/useTheme";
import { cn } from '@/shared/utils/utils';

// Helper function for consistent theme-aware styling
function getThemeClasses(isAdventureTheme: boolean) {
  return {
    header: isAdventureTheme
      ? 'bg-adventure-nav border-adventure-nav'
      : 'bg-white dark:bg-background/95 border-gray-300 dark:border-border',
    text: isAdventureTheme ? 'text-stone-200' : 'text-gray-900 dark:text-foreground',
    textMuted: isAdventureTheme ? 'text-stone-400' : 'text-gray-500 dark:text-muted-foreground',
    textActive: isAdventureTheme ? 'text-stone-200' : 'text-green-600 dark:text-green-400',
    button: isAdventureTheme
      ? 'text-stone-200 hover:bg-stone-700/50 hover:text-stone-100'
      : 'text-gray-800 dark:text-foreground hover:bg-gray-100 dark:hover:bg-accent hover:text-gray-900 dark:hover:text-accent-foreground border-gray-300 dark:border-border',
    icon: isAdventureTheme ? 'sepia' : '',
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
  const isAdventureTheme = theme === 'adventure';
  const themeClasses = getThemeClasses(isAdventureTheme);

  const closeSheet = () => setIsOpen(false);

  const navigation = [
    { name: t('navigation.list'), href: '/map?tab=list', icon: List },
    { name: t('navigation.map'), href: '/map?tab=map', icon: Map },
    { name: t('navigation.claimTreasure'), href: '/claim', icon: ScanQrCode },
    { name: t('navigation.new'), href: '/create', icon: Plus },
  ];

  return (
    <header className={cn(
      "sticky top-0 z-40 w-full border-b md:hidden pt-safe-top",
      themeClasses.header
    )}>
      <div className="container flex h-12 items-center justify-between px-3 xs:px-4">
        {/* Menu Button */}
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={cn("-ml-2", themeClasses.button)}
            >
              <Menu className="h-5 w-5" />
              <span className="sr-only">{t('navigation.toggleMenu')}</span>
            </Button>
          </SheetTrigger>

          {/* Side Sheet Content - Optimized for limited vertical space */}
          <SheetContent side="left" className="mobile-nav-sheet flex flex-col w-[280px] xs:w-[320px] sm:w-[400px] p-0">
            {/* Compact Header */}
            <div className="mobile-nav-header flex items-center gap-2 px-3 py-4 pr-10 border-b bg-muted/50 dark:bg-muted shrink-0">
              <img
                src="/icon.svg"
                alt="Treasures"
                className={cn("h-6 w-6 xs:h-7 xs:w-7 transition-all duration-200", themeClasses.icon)}
              />
              <span className={cn("font-bold text-sm", isAdventureTheme && "font-adventure")}>{t('navigation.appName')}</span>
            </div>

            {/* Scrollable Content Area */}
            <div className="mobile-nav-scroll flex-1 overflow-y-auto">
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
                    to="/texas-ren-fest"
                    icon={Sparkles}
                    isActive={location.pathname === '/texas-ren-fest'}
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

              {/* Ultra-Compact Settings Row */}
              <div className="flex items-center justify-between gap-2 text-[10px] xs:text-xs">
                <div className="flex items-center gap-1">
                </div>
                <div className="flex items-center gap-2">
                  <RelaySelector className="flex-1 min-w-[80px]" />
                </div>
              </div>
            </div>
          </SheetContent>
        </Sheet>

        {/* Center Logo */}
        <Link to="/" className="absolute left-1/2 transform -translate-x-1/2 flex items-center">
          <img
            src="/icon.svg"
            alt="Treasures"
            className={cn("h-7 w-7 xs:h-8 xs:w-8 transition-all duration-200", themeClasses.icon)}
          />
        </Link>

        {/* Right Side - Login */}
        <div className="flex items-center gap-2 -mr-2">
          <LoginArea compact />
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
        "flex flex-col items-center justify-center gap-0.5 xs:gap-1 px-1 xs:px-2 py-1 text-[10px] xs:text-xs transition-colors min-h-[44px]",
        isActive
          ? themeClasses.textActive
          : cn(themeClasses.textMuted, "hover:text-gray-900 dark:hover:text-foreground")
      )}
    >
      <div className="flex items-center justify-center w-5 h-5 xs:w-6 xs:h-6">
        <Icon className={cn("h-4 w-4 xs:h-5 xs:w-5", isActive && themeClasses.textActive)} />
      </div>
      <span className={cn(
        "text-center leading-tight max-w-[60px] xs:max-w-none truncate",
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
  const isAdventureTheme = theme === 'adventure';
  const themeClasses = getThemeClasses(isAdventureTheme);

  const navigation = [
    { name: t('navigation.list'), href: '/map?tab=list', icon: List },
    { name: t('navigation.map'), href: '/map?tab=map', icon: Map },
    { name: t('navigation.claimTreasure'), href: '/claim', icon: ScanQrCode },
    { name: t('navigation.new'), href: '/create', icon: Plus },
  ];

  return (
    <nav className={cn(
      "fixed bottom-0 left-0 right-0 z-40 border-t md:hidden pb-safe-bottom",
      themeClasses.header
    )}>
      <div className="grid grid-cols-4 h-16 items-center">
        {navigation.map((item) => {
          // For map tabs, check both pathname and search params
          const searchParams = new URLSearchParams(location.search);
          const currentTab = searchParams.get('tab');

          let isActive = false;
          if (item.href.includes('/map?tab=')) {
            // For List and Map buttons, check the tab parameter
            const itemTab = item.href.includes('tab=list') ? 'list' : 'map';
            isActive = location.pathname === '/map' && currentTab === itemTab;
          } else {
            // For other buttons, just check pathname
            const itemPathname = getPathnameFromHref(item.href);
            isActive = location.pathname === itemPathname;
          }

          return (
            <BottomNavItem
              key={item.href}
              to={item.href}
              icon={item.icon}
              isActive={isActive}
              themeClasses={themeClasses}
            >
              {item.name}
            </BottomNavItem>
          );
        })}
      </div>
    </nav>
  );
}

// Keep the original export for backward compatibility
export function MobileNav() {
  return (
    <>
      <MobileHeader />
      <MobileBottomNav />
    </>
  );
}