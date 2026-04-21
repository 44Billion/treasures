import { useTranslation } from 'react-i18next';
import { ExternalLink, Globe, Users, Shield, Zap, Compass, MapPin, Trophy, ShieldCheck, MessageSquare, HelpCircle } from "lucide-react";
import { PageLayout } from "@/components/PageLayout";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { CacheIcon } from "@/utils/cacheIcons";
import { useTheme } from "@/hooks/useTheme";
import { NIP_GC_KINDS } from "@/utils/nip-gc";

export default function About() {
  const { t } = useTranslation();
  const { theme } = useTheme();

  return (
    <PageLayout maxWidth="2xl" background="muted">
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="text-center pt-10 pb-8 px-4">
          <img
            src="/icon.svg"
            alt="Treasures"
            className="w-20 h-20 mx-auto mb-4"
          />
          <h1 className="text-3xl font-bold text-foreground mb-2">
            {t('about.title')}
          </h1>
          <p className="text-muted-foreground max-w-md mx-auto">
            {t('about.subtitle')}
          </p>
        </div>

        {/* Main content - single card with sections */}
        <div className="rounded-xl border bg-card mx-4 md:mx-0 mb-8">

          {/* What is Treasures */}
          <div className="p-5 md:p-6">
            <h2 className="text-lg font-semibold text-foreground mb-2">
              {t('about.treasures.title')}
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              {t('about.treasures.description1')}
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-start gap-2.5">
                <Globe className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground">{t('about.treasures.feature1.title')}</p>
                  <p className="text-xs text-muted-foreground">{t('about.treasures.feature1.description')}</p>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <Shield className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground">{t('about.treasures.feature2.title')}</p>
                  <p className="text-xs text-muted-foreground">{t('about.treasures.feature2.description')}</p>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <Users className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground">{t('about.treasures.feature3.title')}</p>
                  <p className="text-xs text-muted-foreground">{t('about.treasures.feature3.description')}</p>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <Zap className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground">{t('about.treasures.feature4.title')}</p>
                  <p className="text-xs text-muted-foreground">{t('about.treasures.feature4.description')}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t" />

          {/* Cache Types */}
          <div className="p-5 md:p-6">
            <div className="flex items-center gap-2 mb-1">
              <Compass className="h-4 w-4 text-primary" />
              <h2 className="text-lg font-semibold text-foreground">
                {t('about.cacheTypes.title')}
              </h2>
            </div>
            <p className="text-xs text-muted-foreground mb-4">{t('about.cacheTypes.description')}</p>

            <div className="grid grid-cols-3 gap-4">
              <div className="flex flex-col items-center text-center">
                <div className="w-10 h-10 flex items-center justify-center mb-2">
                  <CacheIcon type="traditional" size="lg" theme={theme} />
                </div>
                <p className="text-sm font-medium text-foreground">{t('about.cacheTypes.traditional.title')}</p>
                <p className="text-[11px] text-muted-foreground mt-1 leading-snug">
                  {t('about.cacheTypes.traditional.description')}
                </p>
              </div>

              <div className="flex flex-col items-center text-center">
                <div className="w-10 h-10 flex items-center justify-center mb-2">
                  <CacheIcon type="multi" size="lg" theme={theme} />
                </div>
                <p className="text-sm font-medium text-foreground">{t('about.cacheTypes.multi.title')}</p>
                <p className="text-[11px] text-muted-foreground mt-1 leading-snug">
                  {t('about.cacheTypes.multi.description')}
                </p>
              </div>

              <div className="flex flex-col items-center text-center">
                <div className="w-10 h-10 flex items-center justify-center mb-2">
                  <CacheIcon type="mystery" size="lg" theme={theme} />
                </div>
                <p className="text-sm font-medium text-foreground">{t('about.cacheTypes.mystery.title')}</p>
                <p className="text-[11px] text-muted-foreground mt-1 leading-snug">
                  {t('about.cacheTypes.mystery.description')}
                </p>
              </div>
            </div>
          </div>

          <div className="border-t" />

          {/* Nostr Event Kinds */}
          <div className="p-5 md:p-6">
            <h2 className="text-lg font-semibold text-foreground mb-1">
              {t('about.nip.title')}
            </h2>
            <p className="text-xs text-muted-foreground mb-4">
              {t('about.nip.description')}
            </p>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="flex flex-col items-center text-center">
                <MapPin className="h-5 w-5 text-primary mb-1.5" />
                <p className="text-xs font-semibold text-foreground mb-0.5">{t('about.nip.kind1.title', { kind: NIP_GC_KINDS.GEOCACHE })}</p>
                <p className="text-[11px] text-muted-foreground leading-snug">
                  {t('about.nip.kind1.description')}
                </p>
              </div>
              <div className="flex flex-col items-center text-center">
                <Trophy className="h-5 w-5 text-primary mb-1.5" />
                <p className="text-xs font-semibold text-foreground mb-0.5">{t('about.nip.kind2.title', { kind: NIP_GC_KINDS.FOUND_LOG })}</p>
                <p className="text-[11px] text-muted-foreground leading-snug">
                  {t('about.nip.kind2.description')}
                </p>
              </div>
              <div className="flex flex-col items-center text-center">
                <ShieldCheck className="h-5 w-5 text-primary mb-1.5" />
                <p className="text-xs font-semibold text-foreground mb-0.5">{t('about.nip.kind3.title', { kind: NIP_GC_KINDS.VERIFICATION })}</p>
                <p className="text-[11px] text-muted-foreground leading-snug">
                  {t('about.nip.kind3.description')}
                </p>
              </div>
              <div className="flex flex-col items-center text-center">
                <MessageSquare className="h-5 w-5 text-primary mb-1.5" />
                <p className="text-xs font-semibold text-foreground mb-0.5">{t('about.nip.kind4.title', { kind: NIP_GC_KINDS.COMMENT_LOG })}</p>
                <p className="text-[11px] text-muted-foreground leading-snug">
                  {t('about.nip.kind4.description')}
                </p>
              </div>
            </div>

            <div className="flex justify-center mt-4">
              <Button variant="outline" size="sm" asChild>
                <a
                  href="https://nostrhub.io/naddr1qvzqqqrcvypzppscgyy746fhmrt0nq955z6xmf80pkvrat0yq0hpknqtd00z8z68qqgkwet0vdskx6rfdenj6etkv4h8guc6gs5y5"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  {t('about.nip.readSpec')}
                </a>
              </Button>
            </div>
          </div>

          <div className="border-t" />

          {/* Built With */}
          <div className="p-5 md:p-6">
            <h2 className="text-lg font-semibold text-foreground mb-2">
              {t('about.tech.title')}
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-3">
              {t('about.tech.description1')}
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {t('about.tech.description2.prefix')}{' '}
              <a
                href="https://shakespeare.diy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:text-primary/80 underline font-medium"
              >
                🎭 Shakespeare
              </a>
              {t('about.tech.description2.middle')}{' '}
              {t('about.tech.description2.suffix')}
            </p>
          </div>

          <div className="border-t" />

          {/* FAQ */}
          <div className="p-5 md:p-6">
            <div className="flex items-center gap-2 mb-1">
              <HelpCircle className="h-4 w-4 text-primary" />
              <h2 className="text-lg font-semibold text-foreground">
                {t('about.faq.title')}
              </h2>
            </div>

            <Accordion type="single" collapsible className="w-full">
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <AccordionItem key={n} value={`faq-${n}`}>
                  <AccordionTrigger className="text-sm text-left">
                    {t(`about.faq.q${n}`)}
                  </AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground leading-relaxed">
                    {t(`about.faq.a${n}`)}
                  </AccordionContent>
                </AccordionItem>
              ))}

              {/* Differences from Geocaching.com — compact table */}
              <AccordionItem value="faq-7">
                <AccordionTrigger className="text-sm text-left">
                  {t('about.faq.q7')}
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground leading-relaxed">
                  <p className="mb-3">{t('about.faq.a7.intro')}</p>
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr className="border-b text-left">
                        <th className="pb-1.5 font-medium text-foreground/50 w-[28%]"></th>
                        <th className="pb-1.5 font-medium text-foreground/60 w-[36%]">{t('about.faq.a7.col.gc')}</th>
                        <th className="pb-1.5 font-medium text-primary w-[36%]">{t('about.faq.a7.col.tr')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {([
                        { row: 1, sources: [{ n: 1, url: 'https://payments.geocaching.com/?renew=true' }] },
                        { row: 2, sources: [{ n: 2, url: 'https://payments.geocaching.com/?renew=true' }] },
                        { row: 3, sources: [{ n: 3, url: 'https://www.geocaching.com/about/termsofuse.aspx' }] },
                        { row: 4, sources: [{ n: 4, url: 'https://geocaching.com/help/index.php?pg=kb.page&id=482' }] },
                        { row: 5, sources: [{ n: 5, url: 'https://geocaching.com/help/index.php?pg=kb.page&id=102' }] },
                        { row: 6, sources: [
                          { n: 6, url: 'https://www.geocaching.com/help/index.php?pg=kb.chapter&id=97&pgid=863' },
                          { n: 7, url: 'https://geocaching.com/help/index.php?pg=kb.page&id=434' },
                        ]},
                        { row: 7, sources: [
                          { n: 8, url: 'https://www.cgeo.org/faq.html#why-no-api' },
                          { n: 9, url: 'https://apidevelopers.geocaching.com/geocachingapi' },
                          { n: 10, url: 'https://partnerships.geocaching.com/api-license-agreement' },
                        ]},
                      ] as const).map(({ row, sources }) => (
                        <tr key={row} className="border-b border-border/30">
                          <td className="py-1.5 font-medium text-foreground/70">{t(`about.faq.a7.row${row}.topic`)}</td>
                          <td className="py-1.5 pr-1">
                            {t(`about.faq.a7.row${row}.gc`)}{' '}
                            {sources.map(({ n, url }) => (
                              <a key={n} href={url} target="_blank" rel="noopener noreferrer" className="text-primary/50 hover:text-primary text-[9px]">[{n}]</a>
                            ))}
                          </td>
                          <td className="py-1.5 text-primary/80 font-medium">{t(`about.faq.a7.row${row}.tr`)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </div>

        {/* Footer links */}
        <div className="text-center pb-10 px-4 space-y-3">
          <p className="text-xs text-muted-foreground">
            {t('about.footer.description')}
          </p>
          <div className="flex justify-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <a
                href="https://gitlab.com/chad.curtis/treasures"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                {t('about.footer.viewSource')}
              </a>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a
                href="https://shakespeare.diy"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5"
              >
                <span>🎭</span>
                {t('about.tech.learnMore')}
              </a>
            </Button>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
