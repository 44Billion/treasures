import { useTranslation } from 'react-i18next';
import { ExternalLink, MapPin, Compass, Zap, Globe, Users, Shield } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageLayout } from "@/components/layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CacheIcon } from "@/features/geocache/utils/cacheIcons";
import { useTheme } from "@/shared/hooks/useTheme";
import { NIP_GC_KINDS } from "@/features/geocache/utils/nip-gc";

export default function About() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  return (
    <PageLayout maxWidth="2xl" background="muted">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <Card>
          <CardHeader className="text-center py-12">
            <div className="flex justify-center mb-8">
              <img
                src="/icon.svg"
                alt="Treasures"
                className="w-48 h-48"
              />
            </div>
            <CardTitle className="text-4xl font-bold mb-4 text-foreground">
              {t('about.title')}
            </CardTitle>
            <CardDescription className="text-xl max-w-2xl mx-auto">
              {t('about.subtitle')}
            </CardDescription>
          </CardHeader>
        </Card>

        {/* What is Geocaching */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-6 w-6" />
              {t('about.geocaching.title')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground leading-relaxed">
              {t('about.geocaching.description1')}
            </p>
            <p className="text-muted-foreground leading-relaxed">
              {t('about.geocaching.description2')}
            </p>
          </CardContent>
        </Card>

        {/* What is Treasures */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-6 w-6" />
              {t('about.treasures.title')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground leading-relaxed">
              {t('about.treasures.description1')}
            </p>
            <p className="text-muted-foreground leading-relaxed">
              {t('about.treasures.description2')}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
              <div className="flex items-start gap-3">
                <Globe className="h-5 w-5 text-primary mt-1" />
                <div>
                  <h4 className="font-medium">{t('about.treasures.feature1.title')}</h4>
                  <p className="text-sm text-muted-foreground">{t('about.treasures.feature1.description')}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Shield className="h-5 w-5 text-primary mt-1" />
                <div>
                  <h4 className="font-medium">{t('about.treasures.feature2.title')}</h4>
                  <p className="text-sm text-muted-foreground">{t('about.treasures.feature2.description')}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Users className="h-5 w-5 text-primary mt-1" />
                <div>
                  <h4 className="font-medium">{t('about.treasures.feature3.title')}</h4>
                  <p className="text-sm text-muted-foreground">{t('about.treasures.feature3.description')}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Zap className="h-5 w-5 text-primary mt-1" />
                <div>
                  <h4 className="font-medium">{t('about.treasures.feature4.title')}</h4>
                  <p className="text-sm text-muted-foreground">{t('about.treasures.feature4.description')}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Currently Supported Cache Types */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Compass className="h-6 w-6" />
              {t('about.cacheTypes.title')}
            </CardTitle>
            <CardDescription>
              {t('about.cacheTypes.description')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Traditional Cache */}
              <div className="flex flex-col items-center text-center space-y-3 p-4 border rounded-lg">
                <div className="w-12 h-12 flex items-center justify-center">
                  <CacheIcon type="traditional" size="lg" theme={theme} />
                </div>
                <div>
                  <h4 className="font-semibold">{t('about.cacheTypes.traditional.title')}</h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    {t('about.cacheTypes.traditional.description')}
                  </p>
                </div>
                <Badge variant="outline">{t('about.cacheTypes.traditional.badge')}</Badge>
              </div>

              {/* Multi-Cache */}
              <div className="flex flex-col items-center text-center space-y-3 p-4 border rounded-lg">
                <div className="w-12 h-12 flex items-center justify-center">
                  <CacheIcon type="multi" size="lg" theme={theme} />
                </div>
                <div>
                  <h4 className="font-semibold">{t('about.cacheTypes.multi.title')}</h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    {t('about.cacheTypes.multi.description')}
                  </p>
                </div>
                <Badge variant="outline">{t('about.cacheTypes.multi.badge')}</Badge>
              </div>

              {/* Mystery Cache */}
              <div className="flex flex-col items-center text-center space-y-3 p-4 border rounded-lg">
                <div className="w-12 h-12 flex items-center justify-center">
                  <CacheIcon type="mystery" size="lg" theme={theme} />
                </div>
                <div>
                  <h4 className="font-semibold">{t('about.cacheTypes.mystery.title')}</h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    {t('about.cacheTypes.mystery.description')}
                  </p>
                </div>
                <Badge variant="outline">{t('about.cacheTypes.mystery.badge')}</Badge>
              </div>
            </div>


          </CardContent>
        </Card>

        {/* What is Treasures built with? */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-6 w-6" />
              {t('about.tech.title')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-muted-foreground leading-relaxed">
              {t('about.tech.description1')}
            </p>

            <p className="text-muted-foreground leading-relaxed">
              {t('about.tech.description2.prefix')}{' '}
              <code className="bg-muted px-2 py-1 rounded text-sm">stacks</code>
              {' '}{t('about.tech.description2.middle')}{' '}
              <a
                href="https://getstacks.dev/stack/naddr1qvzqqqrhl5pzqprpljlvcnpnw3pejvkkhrc3y6wvmd7vjuad0fg2ud3dky66gaxaqqrk66mnw3skx6c4g6ltw"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:text-primary/80 underline font-medium"
              >
                mkstack
              </a>
              {', '}{t('about.tech.description2.suffix')}
            </p>

            <div className="flex justify-center">
              <Button variant="outline" asChild>
                <a
                  href="https://getstacks.dev"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2"
                >
                  <ExternalLink className="h-4 w-4" />
                  {t('about.tech.learnMore')}
                </a>
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-start gap-3">
                <Globe className="h-5 w-5 text-primary mt-1" />
                <div>
                  <h4 className="font-medium">{t('about.tech.feature1.title')}</h4>
                  <p className="text-sm text-muted-foreground">{t('about.tech.feature1.description')}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Shield className="h-5 w-5 text-primary mt-1" />
                <div>
                  <h4 className="font-medium">{t('about.tech.feature2.title')}</h4>
                  <p className="text-sm text-muted-foreground">{t('about.tech.feature2.description')}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Users className="h-5 w-5 text-primary mt-1" />
                <div>
                  <h4 className="font-medium">{t('about.tech.feature3.title')}</h4>
                  <p className="text-sm text-muted-foreground">{t('about.tech.feature3.description')}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Zap className="h-5 w-5 text-primary mt-1" />
                <div>
                  <h4 className="font-medium">{t('about.tech.feature4.title')}</h4>
                  <p className="text-sm text-muted-foreground">{t('about.tech.feature4.description')}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* What kind of events does this site use? */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-6 w-6" />
              {t('about.nip.title')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-muted-foreground leading-relaxed">
              {t('about.nip.description')}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 border rounded-lg">
                <h4 className="font-semibold mb-2">{t('about.nip.kind1.title', { kind: NIP_GC_KINDS.GEOCACHE })}</h4>
                <p className="text-sm text-muted-foreground">
                  {t('about.nip.kind1.description')}
                </p>
              </div>
              <div className="p-4 border rounded-lg">
                <h4 className="font-semibold mb-2">{t('about.nip.kind2.title', { kind: NIP_GC_KINDS.FOUND_LOG })}</h4>
                <p className="text-sm text-muted-foreground">
                  {t('about.nip.kind2.description')}
                </p>
              </div>
              <div className="p-4 border rounded-lg">
                <h4 className="font-semibold mb-2">{t('about.nip.kind3.title', { kind: NIP_GC_KINDS.VERIFICATION })}</h4>
                <p className="text-sm text-muted-foreground">
                  {t('about.nip.kind3.description')}
                </p>
              </div>
              <div className="p-4 border rounded-lg">
                <h4 className="font-semibold mb-2">{t('about.nip.kind4.title', { kind: NIP_GC_KINDS.COMMENT_LOG })}</h4>
                <p className="text-sm text-muted-foreground">
                  {t('about.nip.kind4.description')}
                </p>
              </div>
            </div>

            <div className="flex justify-center">
              <Button variant="outline" asChild>
                <a
                  href="https://nostrhub.io/naddr1qvzqqqrcvypzppscgyy746fhmrt0nq955z6xmf80pkvrat0yq0hpknqtd00z8z68qqgkwet0vdskx6rfdenj6etkv4h8guc6gs5y5"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2"
                >
                  <ExternalLink className="h-4 w-4" />
                  {t('about.nip.readSpec')}
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <Card>
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <p className="text-sm text-muted-foreground">
                {t('about.footer.description')}
              </p>
              <div className="flex justify-center">
                <Button variant="outline" asChild>
                  <a
                    href="https://gitlab.com/chad.curtis/treasures"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2"
                  >
                    <ExternalLink className="h-4 w-4" />
                    {t('about.footer.viewSource')}
                  </a>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  );
}
