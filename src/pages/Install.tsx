import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Download, MapPin, Smartphone, Wifi, Zap, CheckCircle } from 'lucide-react';
import { DesktopHeader } from '@/components/DesktopHeader';

import { usePWAInstall } from '@/hooks/usePWAInstall';

export default function Install() {
  const { t } = useTranslation();
  const { installable, installing, installed, install } = usePWAInstall();


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
              {t('install.title')}
            </h2>
            
            <p className="text-md text-muted-foreground mb-6">
              {t('install.description')}
            </p>
          </div>

          {/* Installation Status */}
          {installed && (
            <Alert className="mb-6 border-primary-200 bg-primary-50 dark:border-primary-100 dark:bg-primary-50">
              <CheckCircle className="h-4 w-4 text-primary" />
              <AlertDescription className="text-foreground" dangerouslySetInnerHTML={{ __html: t('install.alreadyInstalled') }} />
            </Alert>
          )}

          {/* Install Button - Only show if browser supports installation */}
          {installable && !installed && (
            <Card className="mb-6 border-primary-200 dark:border-primary-100">
              <CardContent className="pt-6">
                <div className="text-center">
                  <Download className="h-12 w-12 text-primary mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">{t('install.readyTitle')}</h3>
                  <p className="text-muted-foreground mb-4">
                    {t('install.readyDescription')}
                  </p>
                  
                  <Button 
                    size="lg" 
                    onClick={handleInstall}
                    disabled={installing}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground"
                  >
                    <Download className="h-5 w-5 mr-2" />
                    {installing ? t('install.installing') : t('install.installButton')}
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
                  {!installable ? t('install.addToHomeScreen') : t('install.manualInstallation')}
                </CardTitle>
                <CardDescription>
                  {!installable 
                    ? t('install.manualDescriptionNoInstall')
                    : t('install.manualDescriptionInstallable')
                  }
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value="browser-menu">
                    <AccordionTrigger className="text-left">
                      {t('install.browserMenuAndroid')}
                    </AccordionTrigger>
                    <AccordionContent className="space-y-4">
                      <div className="space-y-3">
                        <div>
                          <p className="text-sm font-medium text-foreground mb-2">{t('install.chromeBrave')}</p>
                          <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground ml-2">
                            <li>{t('install.chromeBrave.step1')}</li>
                            <li>{t('install.chromeBrave.step2')}</li>
                            <li>{t('install.chromeBrave.step3')}</li>
                          </ol>
                        </div>
                        
                        <div>
                          <p className="text-sm font-medium text-foreground mb-2">{t('install.firefox')}</p>
                          <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground ml-2">
                            <li>{t('install.firefox.step1')}</li>
                            <li>{t('install.firefox.step2')}</li>
                            <li>{t('install.firefox.step3')}</li>
                          </ol>
                        </div>
                        
                        <div>
                          <p className="text-sm font-medium text-foreground mb-2">{t('install.edge')}</p>
                          <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground ml-2">
                            <li>{t('install.edge.step1')}</li>
                            <li>{t('install.edge.step2')}</li>
                            <li>{t('install.edge.step3')}</li>
                          </ol>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                  
                  <AccordionItem value="share-button">
                    <AccordionTrigger className="text-left">
                      {t('install.shareButtonIOS')}
                    </AccordionTrigger>
                    <AccordionContent className="space-y-4">
                      <div className="space-y-3">
                        <div>
                          <p className="text-sm font-medium text-foreground mb-2">{t('install.safari')}</p>
                          <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground ml-2">
                            <li>{t('install.safari.step1')}</li>
                            <li>{t('install.safari.step2')}</li>
                            <li>{t('install.safari.step3')}</li>
                          </ol>
                        </div>
                        
                        <div>
                          <p className="text-sm font-medium text-foreground mb-2">{t('install.iosChromeBrave')}</p>
                          <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground ml-2">
                            <li>{t('install.iosChromeBrave.step1')}</li>
                            <li>{t('install.iosChromeBrave.step2')}</li>
                            <li>{t('install.iosChromeBrave.step3')}</li>
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
                  {t('install.benefitFasterTitle')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  {t('install.benefitFasterDescription')}
                </CardDescription>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Wifi className="h-5 w-5 text-blue-500" />
                  {t('install.benefitAvailableTitle')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  {t('install.benefitAvailableDescription')}
                </CardDescription>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Smartphone className="h-5 w-5 text-primary" />
                  {t('install.benefitNativeTitle')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  {t('install.benefitNativeDescription')}
                </CardDescription>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-red-500" />
                  {t('install.benefitHomeTitle')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  {t('install.benefitHomeDescription')}
                </CardDescription>
              </CardContent>
            </Card>
          </div>

        </div>
      </div>
    </div>
  );
}