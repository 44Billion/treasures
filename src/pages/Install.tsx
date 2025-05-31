import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Download, MapPin, Smartphone, Wifi, Zap, CheckCircle, ArrowLeft } from 'lucide-react';

// Extend Window interface to include deferredPrompt
declare global {
  interface Window {
    deferredPrompt?: {
      prompt: () => Promise<void>;
      userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
    };
  }
}

export default function Install() {
  const [installing, setInstalling] = useState(false);
  const [installable, setInstallable] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) {
      setInstalled(true);
      return;
    }

    // Listen for PWA install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      window.deferredPrompt = e as unknown as Window['deferredPrompt'];
      setInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstall = async () => {
    const deferredPrompt = window.deferredPrompt;
    
    if (deferredPrompt) {
      // Use the deferred prompt if available
      setInstalling(true);
      try {
        await deferredPrompt.prompt();
        const result = await deferredPrompt.userChoice;
        
        if (result.outcome === 'accepted') {
          console.log('PWA installed');
          setInstalled(true);
        }
        
        window.deferredPrompt = undefined;
        setInstallable(false);
      } catch (error) {
        console.error('Install prompt failed:', error);
      } finally {
        setInstalling(false);
      }
    } else {
      // If no deferred prompt is available, do nothing
      // If no deferred prompt is available, do nothing - user can follow manual instructions below
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50/60 via-emerald-50/50 to-teal-50/40">
      {/* Header */}
      <header className="hidden md:block border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2">
              <MapPin className="h-8 w-8 text-green-600" />
              <h1 className="text-2xl font-bold text-gray-900">Treasures</h1>
            </Link>
            <Link to="/">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Home
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          {/* Hero Section */}
          <div className="text-center mb-8">
            
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Install Treasures App
            </h2>
            
            <p className="text-lg text-gray-600 mb-6">
              Get the full geocaching experience with our Progressive Web App. 
              Works offline, loads faster, and feels like a native app.
            </p>
          </div>

          {/* Installation Status */}
          {installed && (
            <Alert className="mb-6 border-green-200 bg-green-50">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                <strong>App already installed!</strong> You can access Treasures from your home screen or app drawer.
              </AlertDescription>
            </Alert>
          )}

          {/* Install Button */}
          {installable && !installed && (
            <Card className="mb-6 border-green-200">
              <CardContent className="pt-6">
                <div className="text-center">
                  <Download className="h-12 w-12 text-green-600 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">{installable ? 'Ready to Install' : 'Install App'}</h3>
                  <p className="text-gray-600 mb-4">
                    {installable 
                      ? 'Your browser supports app installation. Click below to add Treasures to your device.'
                      : 'Add Treasures to your home screen for the best experience.'
                    }
                  </p>
                  <Button 
                    size="lg" 
                    onClick={handleInstall}
                    disabled={installing}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <Download className="h-5 w-5 mr-2" />
                    {installing ? 'Installing...' : 'Install Treasures App'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Manual Installation Instructions */}
          {!installed && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Smartphone className="h-5 w-5" />
                  Manual Installation
                </CardTitle>
                <CardDescription>
                  {installable 
                    ? "If the install button above doesn't work, you can manually add Treasures to your home screen."
                    : "You can manually add Treasures to your home screen for the best experience."
                  }
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <h4 className="font-medium">On iOS (Safari):</h4>
                  <ol className="list-decimal list-inside space-y-1 text-sm text-gray-600">
                    <li>Tap the Share button (square with arrow up)</li>
                    <li>Scroll down and tap "Add to Home Screen"</li>
                    <li>Tap "Add" to confirm</li>
                  </ol>
                </div>
                
                <div className="space-y-3">
                  <h4 className="font-medium">On Android (Chrome):</h4>
                  <ol className="list-decimal list-inside space-y-1 text-sm text-gray-600">
                    <li>Tap the menu button (three dots)</li>
                    <li>Tap "Add to Home screen"</li>
                    <li>Tap "Add" to confirm</li>
                  </ol>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Benefits */}
          <div className="grid gap-4 md:grid-cols-2 mb-8">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Zap className="h-5 w-5 text-yellow-500" />
                  Faster Performance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Instant loading and smooth navigation with cached resources.
                </CardDescription>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Wifi className="h-5 w-5 text-blue-500" />
                  Works Offline
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Access your cached geocaches and maps even without internet.
                </CardDescription>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Smartphone className="h-5 w-5 text-green-500" />
                  Native Feel
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Full-screen experience that feels like a native mobile app.
                </CardDescription>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-red-500" />
                  Home Screen Access
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Quick access from your device's home screen or app drawer.
                </CardDescription>
              </CardContent>
            </Card>
          </div>

        </div>
      </div>
    </div>
  );
}