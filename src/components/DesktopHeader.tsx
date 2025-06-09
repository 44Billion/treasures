import { Link } from 'react-router-dom';
import { Search, Plus, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LoginArea } from '@/components/auth/LoginArea';
import { ThemeToggle } from '@/components/ThemeToggle';
import { RelaySelector } from '@/components/RelaySelector';
import { useTheme } from 'next-themes';

import { useCurrentUser } from '@/hooks/useCurrentUser';

interface DesktopHeaderProps {
  variant?: 'default' | 'map';
}

export function DesktopHeader({ variant = 'default' }: DesktopHeaderProps) {
  const { user } = useCurrentUser();
  const { theme } = useTheme();
  const isAdventureTheme = theme === 'adventure';

  // Map page has different styling needs due to layout constraints
  const baseClasses = variant === 'map' 
    ? "hidden lg:block border-b sticky top-0 z-50"
    : "border-b sticky top-0 z-50 hidden md:block";
  
  const adventureClasses = isAdventureTheme 
    ? "bg-adventure-nav border-adventure-nav text-stone-200" 
    : variant === 'map' 
      ? "bg-background" 
      : "bg-background/80 backdrop-blur-sm";
  
  const headerClasses = `${baseClasses} ${adventureClasses}`;

  return (
    <header className={headerClasses}>
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img 
              src="/icon.png" 
              alt="Treasures" 
              className={`h-12 w-12 transition-all duration-200 ${isAdventureTheme ? 'sepia' : ''}`} 
            />
            <h1 className={`text-2xl font-bold m-0 leading-none ${isAdventureTheme ? 'text-stone-200' : 'text-foreground'}`}>Treasures</h1>
          </Link>
          
          <nav className="flex items-center gap-4">
            <Link to="/map">
              <Button variant="ghost" size={isAdventureTheme ? "default" : "sm"} className={isAdventureTheme ? "text-md" : ""}>
                <Search className="h-4 w-4 mr-2" />
                Explore Map
              </Button>
            </Link>
            
            {user && (
              <Link to="/create">
                <Button variant="ghost" size={isAdventureTheme ? "default" : "sm"} className={isAdventureTheme ? "text-md" : ""}>
                  <Plus className="h-4 w-4 mr-2" />
                  Hide a Treasure
                </Button>
              </Link>
            )}
            
            <Link to="/about">
              <Button variant="ghost" size={isAdventureTheme ? "default" : "sm"} className={isAdventureTheme ? "text-md" : ""}>
                <Info className="h-4 w-4 mr-2" />
                About
              </Button>
            </Link>
            
            <RelaySelector className="w-[200px]" />
            <ThemeToggle />
            <LoginArea />
          </nav>
        </div>
      </div>
    </header>
  );
}