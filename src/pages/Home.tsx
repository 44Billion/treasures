import { useState } from "react";
import { Link } from "react-router-dom";
import { MapPin, Plus, Search, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FeatureCard, EmptyStateCard } from "@/components/ui/card-patterns";
import { DesktopHeader } from "@/components/DesktopHeader";
import { LoginArea } from "@/components/auth/LoginArea";
import LoginDialog from "@/components/auth/LoginDialog";
import SignupDialog from "@/components/auth/SignupDialog";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useGeocaches } from "@/hooks/useGeocaches";
import { GeocacheList } from "@/components/GeocacheList";

export default function Home() {
  const { user } = useCurrentUser();
  const { data: geocaches, isLoading } = useGeocaches({ limit: 3 });
  
  const [loginDialogOpen, setLoginDialogOpen] = useState(false);
  const [signupDialogOpen, setSignupDialogOpen] = useState(false);

  const handleLoginSuccess = () => {
    setLoginDialogOpen(false);
    // Small delay to let the dialog close gracefully before showing the new button
    setTimeout(() => {
      // The user state will automatically update and show "Hide a Treasure" button
      // with the animate-fade-in class for a smooth transition
    }, 100);
  };

  const handleLoginClick = () => {
    setLoginDialogOpen(true);
  };

  const handleSignupClick = () => {
    setLoginDialogOpen(false);
    setSignupDialogOpen(true);
  };

  const handleSignupClose = () => {
    setSignupDialogOpen(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50/60 via-emerald-50/50 to-teal-50/40 dark:from-green-950/40 dark:via-emerald-950/30 dark:to-teal-950/20 pb-4 md:pb-0">
      <DesktopHeader />

      {/* Hero Section */}
      <section className="relative pt-6 pb-12 px-4 md:py-20 overflow-hidden">
        {/* Animated background elements - constrained to max-width container */}
        <div className="absolute inset-0 -z-10 flex justify-center">
          <div className="relative w-full max-w-screen-2xl h-full">
            {/* Map markers - replacing dots */}
            <div className="absolute top-1/4 left-1/4 animate-pulse" style={{animationDelay: '0s'}}>
              <MapPin className="w-6 h-6 text-green-500 opacity-70 drop-shadow-sm" />
            </div>
            <div className="absolute top-2/3 right-1/3 animate-pulse" style={{animationDelay: '1s'}}>
              <MapPin className="w-5 h-5 text-green-600 opacity-65 drop-shadow-sm" />
            </div>
            <div className="absolute bottom-1/4 left-1/2 animate-pulse" style={{animationDelay: '2s'}}>
              <MapPin className="w-6 h-6 text-emerald-500 opacity-60 drop-shadow-sm" />
            </div>
            <div className="absolute top-1/2 left-1/3 animate-pulse" style={{animationDelay: '0.5s'}}>
              <MapPin className="w-4 h-4 text-green-700 opacity-55 drop-shadow-sm" />
            </div>
            <div className="absolute bottom-2/3 right-1/4 animate-pulse" style={{animationDelay: '1.5s'}}>
              <MapPin className="w-5 h-5 text-emerald-600 opacity-65 drop-shadow-sm" />
            </div>
            
            {/* Globe-style curved grid lines */}
            <div className="absolute inset-0 pointer-events-none">
              {/* Horizontal latitude lines - curved to appear like globe */}
              <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                {/* Top latitude line */}
                <path 
                  d="M 10,25 Q 50,22 90,25" 
                  stroke="rgb(34 197 94 / 0.35)" 
                  strokeWidth="0.3" 
                  fill="none"
                />
                {/* Middle latitude line */}
                <path 
                  d="M 5,50 Q 50,48 95,50" 
                  stroke="rgb(34 197 94 / 0.4)" 
                  strokeWidth="0.3" 
                  fill="none"
                />
                {/* Bottom latitude line */}
                <path 
                  d="M 10,75 Q 50,78 90,75" 
                  stroke="rgb(34 197 94 / 0.35)" 
                  strokeWidth="0.3" 
                  fill="none"
                />
                
                {/* Vertical longitude lines - curved to show globe curvature */}
                <path 
                  d="M 25,10 Q 22,50 25,90" 
                  stroke="rgb(34 197 94 / 0.3)" 
                  strokeWidth="0.2" 
                  fill="none"
                />
                <path 
                  d="M 50,5 Q 48,50 50,95" 
                  stroke="rgb(34 197 94 / 0.4)" 
                  strokeWidth="0.2" 
                  fill="none"
                />
                <path 
                  d="M 75,10 Q 78,50 75,90" 
                  stroke="rgb(34 197 94 / 0.3)" 
                  strokeWidth="0.2" 
                  fill="none"
                />
              </svg>
            </div>

            {/* Subtle background texture - much less opaque */}
            <div className="absolute inset-0 bg-adventure-map opacity-5"></div>
          </div>
        </div>
        
        <div className="container mx-auto text-center relative">
          <div className="mb-6 animate-fade-in">
            <Link to="/install" className="inline-flex flex-col items-center gap-0.5 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 px-4 py-1.5 rounded-full text-sm font-medium hover:bg-green-200 dark:hover:bg-green-800 transition-colors">
              <div className="flex items-center gap-2">
                <Trophy className="w-4 h-4" />
                <span>Join the Quest</span>
              </div>
              <span className="text-[10px] opacity-75 leading-none">Install the PWA</span>
            </Link>
          </div>
          
          <h2 className="text-3xl md:text-5xl font-bold text-foreground mb-4 md:mb-6 animate-slide-up">
            Discover Hidden 
            <span className="relative inline-block mx-2">
              <span className="text-green-600">Treasures</span>
              <span className="absolute -bottom-2 left-0 w-full h-1 bg-gradient-to-r from-green-400 to-green-600 transform scale-x-0 animate-expand-line"></span>
            </span>
          </h2>
          
          <p className="text-lg md:text-xl text-muted-foreground mb-6 md:mb-8 max-w-2xl mx-auto animate-slide-up-delay">
            Join the decentralized geocaching adventure powered by Nostr. 
            Hide caches, find treasures, and connect with explorers worldwide.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-3 md:gap-4 justify-center animate-slide-up-delay-2">
            <Link to="/map" className="flex-1 sm:flex-initial group">
              <Button size="lg" className="bg-green-600 hover:bg-green-700 w-full sm:w-auto transform transition-all duration-200 hover:scale-105 hover:shadow-lg">
                <Search className="h-5 w-5 mr-2 transition-transform group-hover:scale-110" />
                Start Exploring
              </Button>
            </Link>
            {user ? (
              <Link to="/create" className="flex-1 sm:flex-initial group">
                <Button size="lg" variant="outline" className="w-full sm:w-auto border-green-200 dark:border-green-800 hover:border-green-300 dark:hover:border-green-700 hover:bg-green-50 dark:hover:bg-green-950 transform transition-all duration-200 hover:scale-105 animate-fade-in">
                  <Plus className="h-5 w-5 mr-2 transition-transform group-hover:rotate-90" />
                  Hide a Treasure
                </Button>
              </Link>
            ) : (
              <Button 
                size="lg" 
                variant="outline" 
                className="w-full sm:w-auto border-green-200 dark:border-green-800 hover:border-green-300 dark:hover:border-green-700 hover:bg-green-50 dark:hover:bg-green-950 transform transition-all duration-200 hover:scale-105 group"
                onClick={handleLoginClick}
              >
                <Plus className="h-5 w-5 mr-2 transition-transform group-hover:rotate-12" />
                Login to Hide Treasures
              </Button>
            )}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-12 md:py-16 px-4 bg-background border-t">
        <div className="container mx-auto">
          <h3 className="text-2xl md:text-3xl font-bold text-center mb-8 md:mb-12 text-foreground">Why Treasures?</h3>
          <div className="grid gap-6 md:grid-cols-3 md:gap-8">
            <FeatureCard
              icon={MapPin}
              title="Decentralized"
              description="Your geocaches are stored on the Nostr network, ensuring they're always accessible and censorship-resistant."
              centered={true}
            />
            <FeatureCard
              icon={Trophy}
              title="Community Driven"
              description="Connect with fellow geocachers, share experiences, and build lasting friendships through adventure."
              centered={true}
            />
            <FeatureCard
              icon={Search}
              title="Global Adventure"
              description="Discover caches hidden by explorers from around the world, each with its own unique story and challenge."
              centered={true}
            />
          </div>
        </div>
      </section>

      {/* Recent Caches */}
      <section className="py-12 md:py-16 px-4">
        <div className="container mx-auto">
          <div className="flex items-center justify-between mb-6 md:mb-8">
            <h3 className="text-2xl md:text-3xl font-bold text-foreground">Recent Geocaches</h3>
            <Link to="/map" className="hidden sm:block">
              <Button variant="outline">View All</Button>
            </Link>
          </div>
          {isLoading ? (
            <div className="text-center py-8">Loading geocaches...</div>
          ) : geocaches && geocaches.length > 0 ? (
            <>
              <GeocacheList geocaches={geocaches} />
              <div className="mt-6 text-center sm:hidden">
                <Link to="/map">
                  <Button variant="outline" className="w-full">View All Geocaches</Button>
                </Link>
              </div>
            </>
          ) : (
            <EmptyStateCard
              icon={MapPin}
              title="No geocaches found yet."
              description="Be the first to hide one!"
            />
          )}
        </div>
      </section>

      {/* Login and Signup Dialogs */}
      <LoginDialog 
        isOpen={loginDialogOpen}
        onClose={() => setLoginDialogOpen(false)}
        onLogin={handleLoginSuccess}
        onSignup={handleSignupClick}
      />
      <SignupDialog 
        isOpen={signupDialogOpen}
        onClose={handleSignupClose}
      />
    </div>
  );
}