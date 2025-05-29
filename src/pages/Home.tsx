import { useState } from "react";
import { Link } from "react-router-dom";
import { MapPin, Plus, Search, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoginArea } from "@/components/auth/LoginArea";
import LoginDialog from "@/components/auth/LoginDialog";
import SignupDialog from "@/components/auth/SignupDialog";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useGeocaches } from "@/hooks/useGeocaches";
import { GeocacheList } from "@/components/GeocacheList";

export default function Home() {
  const { user } = useCurrentUser();
  const { data: geocaches, isLoading } = useGeocaches({ limit: 6 });
  
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
    <div className="min-h-screen bg-gradient-to-br from-green-50/60 via-emerald-50/50 to-teal-50/40">
      {/* Desktop Header - Hidden on Mobile */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50 hidden md:block">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2">
              <MapPin className="h-8 w-8 text-green-600" />
              <h1 className="text-2xl font-bold text-gray-900">Treasures</h1>
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
              <LoginArea />
            </nav>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative py-12 px-4 md:py-20 overflow-hidden">
        {/* Animated background elements */}
        <div className="absolute inset-0 -z-10">
          {/* Map markers - replacing dots */}
          <div className="absolute top-1/4 left-1/4 animate-pulse" style={{animationDelay: '0s'}}>
            <MapPin className="w-6 h-6 text-green-500 opacity-60 drop-shadow-sm" />
          </div>
          <div className="absolute top-2/3 right-1/3 animate-pulse" style={{animationDelay: '1s'}}>
            <MapPin className="w-5 h-5 text-green-600 opacity-50 drop-shadow-sm" />
          </div>
          <div className="absolute bottom-1/4 left-1/2 animate-pulse" style={{animationDelay: '2s'}}>
            <MapPin className="w-6 h-6 text-emerald-500 opacity-45 drop-shadow-sm" />
          </div>
          <div className="absolute top-1/2 left-1/3 animate-pulse" style={{animationDelay: '0.5s'}}>
            <MapPin className="w-4 h-4 text-green-700 opacity-40 drop-shadow-sm" />
          </div>
          <div className="absolute bottom-2/3 right-1/4 animate-pulse" style={{animationDelay: '1.5s'}}>
            <MapPin className="w-5 h-5 text-emerald-600 opacity-55 drop-shadow-sm" />
          </div>
          
          {/* Globe-style curved grid lines */}
          <div className="absolute inset-0 pointer-events-none">
            {/* Horizontal latitude lines - curved to appear like globe */}
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
              {/* Top latitude line */}
              <path 
                d="M 10,25 Q 50,22 90,25" 
                stroke="rgb(34 197 94 / 0.2)" 
                strokeWidth="0.2" 
                fill="none"
              />
              {/* Middle latitude line */}
              <path 
                d="M 5,50 Q 50,48 95,50" 
                stroke="rgb(34 197 94 / 0.15)" 
                strokeWidth="0.2" 
                fill="none"
              />
              {/* Bottom latitude line */}
              <path 
                d="M 10,75 Q 50,78 90,75" 
                stroke="rgb(34 197 94 / 0.2)" 
                strokeWidth="0.2" 
                fill="none"
              />
              
              {/* Vertical longitude lines - curved to show globe curvature */}
              <path 
                d="M 25,10 Q 22,50 25,90" 
                stroke="rgb(34 197 94 / 0.15)" 
                strokeWidth="0.1" 
                fill="none"
              />
              <path 
                d="M 50,5 Q 48,50 50,95" 
                stroke="rgb(34 197 94 / 0.2)" 
                strokeWidth="0.1" 
                fill="none"
              />
              <path 
                d="M 75,10 Q 78,50 75,90" 
                stroke="rgb(34 197 94 / 0.15)" 
                strokeWidth="0.1" 
                fill="none"
              />
            </svg>
          </div>

          {/* Subtle background texture - much less opaque */}
          <div className="absolute inset-0 bg-adventure-map opacity-5"></div>
        </div>
        
        <div className="container mx-auto text-center relative">
          <div className="inline-flex items-center gap-2 bg-green-100 text-green-700 px-4 py-2 rounded-full text-sm font-medium mb-6 animate-fade-in">
            <Trophy className="w-4 h-4" />
            <span>Join the Quest</span>
          </div>
          
          <h2 className="text-3xl md:text-5xl font-bold text-gray-900 mb-4 md:mb-6 animate-slide-up">
            Discover Hidden 
            <span className="relative inline-block mx-2">
              <span className="text-green-600">Treasures</span>
              <span className="absolute -bottom-2 left-0 w-full h-1 bg-gradient-to-r from-green-400 to-green-600 transform scale-x-0 animate-expand-line"></span>
            </span>
          </h2>
          
          <p className="text-lg md:text-xl text-gray-600 mb-6 md:mb-8 max-w-2xl mx-auto animate-slide-up-delay">
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
                <Button size="lg" variant="outline" className="w-full sm:w-auto border-green-200 hover:border-green-300 hover:bg-green-50 transform transition-all duration-200 hover:scale-105 animate-fade-in">
                  <Plus className="h-5 w-5 mr-2 transition-transform group-hover:rotate-90" />
                  Hide a Treasure
                </Button>
              </Link>
            ) : (
              <Button 
                size="lg" 
                variant="outline" 
                className="w-full sm:w-auto border-green-200 hover:border-green-300 hover:bg-green-50 transform transition-all duration-200 hover:scale-105 group"
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
      <section className="py-12 md:py-16 px-4 bg-white">
        <div className="container mx-auto">
          <h3 className="text-2xl md:text-3xl font-bold text-center mb-8 md:mb-12">Why Treasures?</h3>
          <div className="grid gap-6 md:grid-cols-3 md:gap-8">
            <Card>
              <CardHeader className="text-center md:text-left">
                <MapPin className="h-10 w-10 text-green-600 mb-4 mx-auto md:mx-0" />
                <CardTitle>Decentralized</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Your geocaches are stored on the Nostr network, ensuring they're 
                  always accessible and censorship-resistant.
                </CardDescription>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="text-center md:text-left">
                <Trophy className="h-10 w-10 text-green-600 mb-4 mx-auto md:mx-0" />
                <CardTitle>Community Driven</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Connect with fellow geocachers, share experiences, and build 
                  lasting friendships through adventure.
                </CardDescription>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="text-center md:text-left">
                <Search className="h-10 w-10 text-green-600 mb-4 mx-auto md:mx-0" />
                <CardTitle>Global Adventure</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Discover caches hidden by explorers from around the world, 
                  each with its own unique story and challenge.
                </CardDescription>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Recent Caches */}
      <section className="py-12 md:py-16 px-4">
        <div className="container mx-auto">
          <div className="flex items-center justify-between mb-6 md:mb-8">
            <h3 className="text-2xl md:text-3xl font-bold">Recent Geocaches</h3>
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
            <Card>
              <CardContent className="text-center py-12">
                <MapPin className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">No geocaches found yet. Be the first to hide one!</p>
              </CardContent>
            </Card>
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