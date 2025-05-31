import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { MapPin, Home, Map, Plus, Menu, X, Settings, Bookmark, LogOut, User, Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { LoginArea } from '@/components/auth/LoginArea';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useLoggedInAccounts } from '@/hooks/useLoggedInAccounts';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

export function MobileNav() {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const { user } = useCurrentUser();
  const { currentUser, removeLogin } = useLoggedInAccounts();

  const navigation = [
    { name: 'Home', href: '/', icon: Home },
    { name: 'Map', href: '/map', icon: Map },
    { name: 'My Caches', href: '/saved', icon: Bookmark },
    { name: 'New', href: '/create', icon: Plus },
  ];

  return (
    <>
      {/* Mobile Header */}
      <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 md:hidden">
        <div className="container flex h-14 items-center">
          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="sm" className="mr-2">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="pr-0">
              <div className="flex items-center gap-2 px-6 py-4">
                <MapPin className="h-6 w-6 text-green-600" />
                <span className="font-bold">Treasures</span>
              </div>
              <nav className="flex flex-col gap-2 px-6">
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
                {user && (
                  <>
                    <Link
                      to="/settings"
                      onClick={() => setIsOpen(false)}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground ${
                        location.pathname === '/settings'
                          ? 'bg-accent text-accent-foreground'
                          : 'text-muted-foreground'
                      }`}
                    >
                      <Edit className="h-4 w-4" />
                      Edit Profile
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
              <div className="mt-auto p-6">
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
          
          <Link to="/" className="flex items-center gap-2">
            <MapPin className="h-6 w-6 text-green-600" />
            <span className="font-bold">Treasures</span>
          </Link>
          
          <div className="ml-auto">
            <LoginArea compact />
          </div>
        </div>
      </header>

      {/* Bottom Navigation for Mobile */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 md:hidden">
        <div className="grid grid-cols-4 py-2">
          {navigation.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.href;
            
            return (
              <Link
                key={item.name}
                to={item.href}
                className={`flex flex-col items-center gap-1 px-2 py-2 text-xs transition-colors ${
                  isActive
                    ? 'text-green-600'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <div className="flex items-center justify-center w-6 h-6">
                  <Icon className={`h-5 w-5 ${isActive ? 'text-green-600' : ''}`} />
                </div>
                <span className={`text-center leading-tight ${isActive ? 'text-green-600 font-medium' : ''}`}>
                  {item.name}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}