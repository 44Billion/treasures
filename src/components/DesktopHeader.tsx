import { Link } from 'react-router-dom';
import { Search, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LoginArea } from '@/components/auth/LoginArea';
import { OfflineIndicator } from '@/components/OfflineIndicator';
import { useCurrentUser } from '@/hooks/useCurrentUser';

interface DesktopHeaderProps {
  variant?: 'default' | 'map';
}

export function DesktopHeader({ variant = 'default' }: DesktopHeaderProps) {
  const { user } = useCurrentUser();

  // Map page has different styling needs due to layout constraints
  const headerClasses = variant === 'map' 
    ? "hidden lg:block border-b bg-background sticky top-0 z-50"
    : "border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50 hidden md:block";

  return (
    <header className={headerClasses}>
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src="/icon.png" alt="Treasures" className="h-12 w-12" />
            <h1 className="text-2xl font-bold text-foreground m-0 leading-none">Treasures</h1>
          </Link>
          
          <nav className="flex items-center gap-4">
            <Link to="/map">
              <Button variant="ghost" size="sm">
                <Search className="h-4 w-4 mr-2" />
                Explore Map
              </Button>
            </Link>
            
            {user && (
              <Link to="/create">
                <Button variant="ghost" size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Hide a Treasure
                </Button>
              </Link>
            )}
            
            <OfflineIndicator />
            <LoginArea />
          </nav>
        </div>
      </div>
    </header>
  );
}