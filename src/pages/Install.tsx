import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Download, MapPin, Smartphone, Wifi, Zap, CheckCircle } from 'lucide-react';
import { DesktopHeader } from '@/components/DesktopHeader';
import { useIsMobile } from '@/shared/hooks/useIsMobile';
import { usePWAInstall } from '@/shared/hooks/usePWAInstall';

export default function Install() {
  const { installable, installing, installed, install } = usePWAInstall();
  const isMobile = useIsMobile();

  const handleInstall = async () => {
    await install();
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <DesktopHeader />

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          {/* Hero Section */}
          <div className="text-center mb-8">
            
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Install Treasures App
            </h2>
            
            <p className="text-md text-muted-foreground mb-6">
              Get the full geocaching experience with our Progressive Web App. 
              Works offline, loads faster, and feels like a native app.
            </p>
          </div>

          {/* Installation Status */}
          {installed && (
            <Alert className="mb-6 border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/20">
              <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
              <AlertDescription className="text-green-800 dark:text-green-200">
                <strong>App already installed!</strong> You can access Treasures from your home screen or app drawer.
              </AlertDescription>
            </Alert>
          )}

          {/* Install Button - Only show if browser supports installation */}
          {installable && !installed && (
            <Card className="mb-6 border-green-200 dark:border-green-800">
              <CardContent className="pt-6">
                <div className="text-center">
                  <Download className="h-12 w-12 text-green-600 dark:text-green-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Ready to Install</h3>
                  <p className="text-muted-foreground mb-4">
                    Your browser supports app installation. Click below to add Treasures to your device.
                  </p>
                  
                  <Button 
                    size="lg" 
                    onClick={handleInstall}
                    disabled={installing}
                    className="bg-green-600 hover:bg-green-700 dark:bg-green-600 dark:hover:bg-green-500"
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
            <Card className="mb-6 border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Smartphone className="h-5 w-5" />
                  {!installable ? 'Add to Home Screen' : 'Manual Installation'}
                </CardTitle>
                <CardDescription>
                  {!installable 
                    ? "Add Treasures to your home screen for the best app experience. Follow the instructions below for your device."
                    : installable
                    ? "If the install button above doesn't work, you can manually add Treasures to your home screen."
                    : "You can manually add Treasures to your home screen for the best experience."
                  }
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value="browser-menu">
                    <AccordionTrigger className="text-left">
                      Using Browser Menu (Android)
                    </AccordionTrigger>
                    <AccordionContent className="space-y-4">
                      <div className="space-y-3">
                        <div>
                          <p className="text-sm font-medium text-foreground mb-2">Chrome & Brave:</p>
                          <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground ml-2">
                            <li>Tap the menu button (three dots)</li>
                            <li>Tap "Add to Home screen"</li>
                            <li>Tap "Add" to confirm</li>
                          </ol>
                        </div>
                        
                        <div>
                          <p className="text-sm font-medium text-foreground mb-2">Firefox:</p>
                          <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground ml-2">
                            <li>Tap the menu button (three dots)</li>
                            <li>Tap "Install"</li>
                            <li>Tap "Add" to confirm</li>
                          </ol>
                        </div>
                        
                        <div>
                          <p className="text-sm font-medium text-foreground mb-2">Edge:</p>
                          <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground ml-2">
                            <li>Tap the menu button (three dots)</li>
                            <li>Tap "Add to phone"</li>
                            <li>Tap "Add" to confirm</li>
                          </ol>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                  
                  <AccordionItem value="share-button">
                    <AccordionTrigger className="text-left">
                      Using Share Button (iOS)
                    </AccordionTrigger>
                    <AccordionContent className="space-y-4">
                      <div className="space-y-3">
                        <div>
                          <p className="text-sm font-medium text-foreground mb-2">Safari:</p>
                          <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground ml-2">
                            <li>Tap the Share button (square with arrow up)</li>
                            <li>Scroll down and tap "Add to Home Screen"</li>
                            <li>Tap "Add" to confirm</li>
                          </ol>
                        </div>
                        
                        <div>
                          <p className="text-sm font-medium text-foreground mb-2">Chrome & Brave:</p>
                          <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground ml-2">
                            <li>Tap the Share button</li>
                            <li>Tap "Add to Home Screen"</li>
                            <li>Tap "Add" to confirm</li>
                          </ol>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
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