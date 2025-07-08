import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Map, Plus, Menu, Settings, Bookmark, LogOut, User, QrCode, ScanQrCode, Info, BookOpen, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { LoginArea } from '@/components/auth/LoginArea';
import { OfflineIndicator } from '@/components/OfflineIndicator';
import { ThemeToggle } from '@/components/ThemeToggle';
import { RelaySelector } from '@/components/RelaySelector';
import { useCurrentUser } from '@/features/auth/hooks/useCurrentUser';
import { useLoggedInAccounts } from '@/features/geocache/hooks/useLoggedInAccounts';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useTheme } from 'next-themes';
import { cn } from '@/shared/utils/utils';

const navigation = [
  { name: 'Home', href: '/', icon: Home },
  { name: 'Map', href: '/map', icon: Map },
  { name: 'Claim', href: '/claim', icon: ScanQrCode },
  { name: 'New', href: '/create', icon: Plus },
];

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
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const { user } = useCurrentUser();
  const { currentUser, removeLogin } = useLoggedInAccounts();
  const { theme } = useTheme();
  const isAdventureTheme = theme === 'adventure';
  const themeClasses = getThemeClasses(isAdventureTheme);

  const closeSheet = () => setIsOpen(false);

  return (
    <header className={cn(
      "sticky top-0 z-40 w-full border-b md:hidden pt-safe-top",
      themeClasses.header
    )}>
      <div className="container flex h-16 items-center justify-between px-3 xs:px-4">
        {/* Menu Button */}
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild>
            <Button 
              variant="ghost" 
              size="sm" 
              className={cn("-ml-2", themeClasses.button)}
            >
              <Menu className="h-5 w-5" />
              <span className="sr-only">Toggle menu</span>
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
              <span className={cn("font-bold text-sm", isAdventureTheme && "font-adventure")}>Treasures</span>
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
                    icon={ScanQrCode}
                    isActive={location.pathname === '/generate-qr'}
                    onClick={closeSheet}
                  >
                    Generate QR
                  </NavLink>
                  
                  <NavLink
                    to="/saved"
                    icon={Bookmark}
                    isActive={location.pathname === '/saved'}
                    onClick={closeSheet}
                  >
                    Saved Caches
                  </NavLink>
                  
                  <NavLink
                    to="/blog"
                    icon={BookOpen}
                    isActive={location.pathname.startsWith('/blog')}
                    onClick={closeSheet}
                  >
                    Blog
                  </NavLink>
                  
                  <NavLink
                    to="/about"
                    icon={Info}
                    isActive={location.pathname === '/about'}
                    onClick={closeSheet}
                  >
                    About
                  </NavLink>
                  
                  {user && (
                    <>
                      <NavLink
                        to="/profile"
                        icon={User}
                        isActive={location.pathname === '/profile'}
                        onClick={closeSheet}
                      >
                        My Profile
                      </NavLink>
                      <NavLink
                        to="/settings"
                        icon={Settings}
                        isActive={location.pathname === '/settings'}
                        onClick={closeSheet}
                      >
                        App Settings
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
                      title="Log out"
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
                  <OfflineIndicator showDetails={false} />
                </div>
                <div className="flex items-center gap-2">
                  <RelaySelector className="flex-1 min-w-[80px]" />
                </div>
              </div>
            </div>
          </SheetContent>
        </Sheet>
        
        {/* Center Logo */}
        <Link to="/" className="absolute left-1/2 transform -translate-x-1/2 flex flex-col items-center gap-0.5 xs:gap-1">
          <img 
            src="/icon.svg" 
            alt="Treasures" 
            className={cn("h-6 w-6 xs:h-8 xs:w-8 transition-all duration-200", themeClasses.icon)} 
          />
          <h1 className={cn("text-[10px] xs:text-xs font-bold m-0 leading-none", themeClasses.text, isAdventureTheme && "font-adventure")}>
            Treasures
          </h1>
        </Link>
        
        {/* Right Side - Theme Toggle and Login */}
        <div className="flex items-center gap-2 -mr-2">
          <ThemeToggle variant="compact-icon" />
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

export function MobileBottomNav() {
  const location = useLocation();
  const { theme } = useTheme();
  const isAdventureTheme = theme === 'adventure';
  const themeClasses = getThemeClasses(isAdventureTheme);

  return (
    <nav className={cn(
      "fixed bottom-0 left-0 right-0 z-40 border-t md:hidden pb-safe-bottom",
      themeClasses.header
    )}>
      <div className="grid grid-cols-4 h-16 items-center">
        {navigation.map((item) => (
          <BottomNavItem
            key={item.name}
            to={item.href}
            icon={item.icon}
            isActive={location.pathname === item.href}
            themeClasses={themeClasses}
          >
            {item.name}
          </BottomNavItem>
        ))}
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