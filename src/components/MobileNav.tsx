import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Map, Plus, Menu, Settings, Bookmark, LogOut, User, QrCode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { LoginArea } from '@/components/auth/LoginArea';
import { OfflineIndicator } from '@/components/OfflineIndicator';
import { ThemeToggle } from '@/components/ThemeToggle';
import { RelaySelector } from '@/components/RelaySelector';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useLoggedInAccounts } from '@/hooks/useLoggedInAccounts';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useTheme } from 'next-themes';

const navigation = [
  { name: 'Home', href: '/', icon: Home },
  { name: 'Map', href: '/map', icon: Map },
  { name: 'Claim', href: '/claim', icon: QrCode },
  { name: 'New', href: '/create', icon: Plus },
];

export function MobileHeader() {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const { user } = useCurrentUser();
  const { currentUser, removeLogin } = useLoggedInAccounts();
  const { theme } = useTheme();
  const isAdventureTheme = theme === 'adventure';

  return (
    <header className={`sticky top-0 z-40 w-full border-b md:hidden pt-safe-top ${
      isAdventureTheme 
        ? 'bg-adventure-nav border-adventure-nav' 
        : 'bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60'
    }`}>
      <div className="container flex h-16 items-center justify-between">
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild>
            <Button 
              variant="ghost" 
              size="sm" 
              className={`-ml-2 ${isAdventureTheme ? 'text-stone-200 hover:bg-stone-700/50 hover:text-stone-100' : ''}`}
            >
              <Menu className="h-5 w-5" />
              <span className="sr-only">Toggle menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left">
            <div className="flex items-center gap-2 px-2 py-4">
              <img 
                src="/icon.png" 
                alt="Treasures" 
                className={`h-10 w-10 transition-all duration-200 ${isAdventureTheme ? 'sepia' : ''}`} 
              />
              <span className={`font-bold text-lg ${isAdventureTheme ? 'text-stone-800' : 'text-foreground'}`}>Treasures</span>
            </div>
            <nav className="flex flex-col gap-2 px-2">
              {navigation.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    onClick={() => setIsOpen(false)}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground ${
                      location.pathname === item.href
                        ? 'bg-accent text-accent-foreground'
                        : 'text-muted-foreground'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {item.name}
                  </Link>
                );
              })}
              <Link
                to="/saved"
                onClick={() => setIsOpen(false)}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground ${
                  location.pathname === '/saved'
                    ? 'bg-accent text-accent-foreground'
                    : 'text-muted-foreground'
                }`}
              >
                <Bookmark className="h-4 w-4" />
                Saved Caches
              </Link>
              {user && (
                <>
                  <Link
                    to="/profile"
                    onClick={() => setIsOpen(false)}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground ${
                      location.pathname === '/profile'
                        ? 'bg-accent text-accent-foreground'
                        : 'text-muted-foreground'
                    }`}
                  >
                    <User className="h-4 w-4" />
                    My Profile
                  </Link>
                  <Link
                    to="/settings"
                    onClick={() => setIsOpen(false)}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground ${
                      location.pathname === '/settings'
                        ? 'bg-accent text-accent-foreground'
                        : 'text-muted-foreground'
                    }`}
                  >
                    <Settings className="h-4 w-4" />
                    App Settings
                  </Link>
                </>
              )}
            </nav>
            <div className="mt-auto p-2">
              {currentUser ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-accent/50">
                    <Avatar className="w-10 h-10">
                      <AvatarImage src={currentUser.metadata.picture} alt={currentUser.metadata.name} />
                      <AvatarFallback>
                        {currentUser.metadata.name?.charAt(0) || <User className="w-4 h-4" />}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">
                        {currentUser.metadata.name || currentUser.pubkey.slice(0, 8) + '...'}
                      </p>
                      <p className="text-xs text-muted-foreground">Logged in</p>
                    </div>
                  </div>
                  <div className="px-3 py-2 space-y-3">
                    <OfflineIndicator showDetails={false} />
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Theme</span>
                      <ThemeToggle variant="mobile-sheet" />
                    </div>
                    <div className="space-y-2">
                      <span className="text-sm text-muted-foreground">Relay</span>
                      <RelaySelector className="w-full" />
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      removeLogin(currentUser.id);
                      setIsOpen(false);
                    }}
                    className="w-full flex items-center gap-2"
                  >
                    <LogOut className="w-4 h-4" />
                    Log out
                  </Button>
                </div>
              ) : (
                <LoginArea />
              )}
            </div>
          </SheetContent>
        </Sheet>
        
        <Link to="/" className="absolute left-1/2 transform -translate-x-1/2 flex flex-col items-center gap-1">
          <img 
            src="/icon.png" 
            alt="Treasures" 
            className={`h-8 w-8 transition-all duration-200 ${isAdventureTheme ? 'sepia' : ''}`} 
          />
          <h1 className={`text-xs font-bold m-0 leading-none ${isAdventureTheme ? 'text-stone-200' : 'text-foreground'}`}>Treasures</h1>
        </Link>
        
        <div className="-mr-2 flex items-center gap-2">
          <LoginArea compact />
        </div>
      </div>
    </header>
  );
}

export function MobileBottomNav() {
  const location = useLocation();
  const { theme } = useTheme();
  const isAdventureTheme = theme === 'adventure';

  return (
    <nav className={`fixed bottom-0 left-0 right-0 z-40 border-t md:hidden pb-safe-bottom ${
      isAdventureTheme 
        ? 'bg-adventure-nav border-adventure-nav' 
        : 'bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60'
    }`}>
      <div className="grid grid-cols-4 h-16 items-center">
        {navigation.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.href;
          
          return (
            <Link
              key={item.name}
              to={item.href}
              className={`flex flex-col items-center justify-center gap-1 px-2 py-1 text-xs transition-colors ${
                isActive
                  ? isAdventureTheme ? 'text-stone-200' : 'text-green-600'
                  : isAdventureTheme ? 'text-stone-400 hover:text-stone-200' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <div className="flex items-center justify-center w-6 h-6">
                <Icon className={`h-5 w-5 ${isActive ? (isAdventureTheme ? 'text-stone-200' : 'text-green-600') : ''}`} />
              </div>
              <span className={`text-center leading-tight ${isActive ? (isAdventureTheme ? 'text-stone-200 font-medium' : 'text-green-600 font-medium') : ''}`}>
                {item.name}
              </span>
            </Link>
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