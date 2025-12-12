import { UserCheck, Users, Globe, Swords, ChevronDown, Info } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useWotStore } from '../shared/stores/useWotStore';
import { useNostr } from '@nostrify/react';
import { useCurrentUser } from '../features/auth/hooks/useCurrentUser';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Slider } from './ui/slider';
import { Progress } from './ui/progress';
import { WotAuthorCard } from './WotAuthorCard';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible';
import { useState } from 'react';

export function WotSettings() {
  const { t } = useTranslation();
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const {
    trustLevel,
    startingPoint,
    wotPubkeys,
    isLoading,
    lastCalculated,
    progress,
    setTrustLevel,
    setStartingPoint,
    calculateWot,
    cancelCalculation,
    followLimit,
    setFollowLimit,
  } = useWotStore();
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);

  const handleCalculate = () => {
    calculateWot(nostr, user?.pubkey);
  };

  const followLimitPegs = [150, 250, 500, 1000, 2500, 0]; // 0 represents infinity

  const handleFollowLimitChange = (value: number[]) => {
    if (value.length > 0 && value[0] !== undefined) {
      setFollowLimit(followLimitPegs[value[0]] ?? 0);
    }
  };

  const handleStartingPointChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setStartingPoint(e.target.value);
  };
  
  const isFilterEnabled = trustLevel > 0;
  const followLimitIndex = followLimitPegs.indexOf(followLimit);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('settings.wot.title')}</CardTitle>
        <CardDescription>
          {t('settings.wot.description')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label>{t('settings.wot.trustLevel')}</Label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Button
              variant={trustLevel === 1 ? 'secondary' : 'outline'}
              data-variant={trustLevel === 1 ? 'secondary' : 'outline'}
              onClick={() => setTrustLevel(1)}
              disabled={isLoading}
              className="flex-1 flex-col md:flex-row h-auto py-2 items-center"
            >
              <UserCheck className="h-6 w-6 mb-1 md:mb-0 md:mr-2" />
              <span className="text-base">{t('settings.wot.trustLevels.strict')}</span>
            </Button>
            <Button
              variant={trustLevel === 2 ? 'secondary' : 'outline'}
              data-variant={trustLevel === 2 ? 'secondary' : 'outline'}
              onClick={() => setTrustLevel(2)}
              disabled={isLoading}
              className="flex-1 flex-col md:flex-row h-auto py-2 items-center"
            >
              <Users className="h-6 w-6 mb-1 md:mb-0 md:mr-2" />
              <span className="text-base">{t('settings.wot.trustLevels.normal')}</span>
            </Button>
            <Button
              variant={trustLevel === 3 ? 'secondary' : 'outline'}
              data-variant={trustLevel === 3 ? 'secondary' : 'outline'}
              onClick={() => setTrustLevel(3)}
              disabled={isLoading}
              className="flex-1 flex-col md:flex-row h-auto py-2 items-center"
            >
              <Globe className="h-6 w-6 mb-1 md:mb-0 md:mr-2" />
              <span className="text-base">{t('settings.wot.trustLevels.lax')}</span>
            </Button>
            <Button
              variant={trustLevel === 0 ? 'secondary' : 'outline'}
              data-variant={trustLevel === 0 ? 'secondary' : 'outline'}
              onClick={() => setTrustLevel(0)}
              disabled={isLoading}
              className="flex-1 flex-col md:flex-row h-auto py-2 items-center"
            >
              <Swords className="h-6 w-6 mb-1 md:mb-0 md:mr-2" />
              <span className="text-base">{t('settings.wot.trustLevels.all')}</span>
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            {trustLevel === 1 && t('settings.wot.descriptions.strict')}
            {trustLevel === 2 && t('settings.wot.descriptions.normal')}
            {trustLevel === 3 && t('settings.wot.descriptions.lax')}
            {trustLevel === 0 && t('settings.wot.descriptions.all')}
          </p>
          {trustLevel === 3 && (
            <div className="flex items-center gap-2 text-sm text-foreground bg-background border rounded-lg p-3 mt-2">
              <Info className="h-5 w-5 flex-shrink-0" />
              <p>
                {t('settings.wot.laxWarning')}
              </p>
            </div>
          )}
        </div>

        <Collapsible open={isAdvancedOpen} onOpenChange={setIsAdvancedOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full flex justify-between items-center">
              {t('settings.wot.advancedSettings')}
              <ChevronDown className={`h-4 w-4 transition-transform ${isAdvancedOpen ? 'rotate-180' : ''}`} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-6 pt-4">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label>{t('settings.wot.followLimit')}</Label>
                <span className="text-sm font-medium">
                  {followLimit === 0 ? t('settings.wot.noLimit') : followLimit}
                </span>
              </div>
              <div className="relative flex flex-col gap-2 pt-4">
                <Slider
                  value={[followLimitIndex]}
                  onValueChange={handleFollowLimitChange}
                  min={0}
                  max={followLimitPegs.length - 1}
                  step={1}
                  disabled={!isFilterEnabled || isLoading}
                  className="flex-1"
                />
                <div className="relative flex justify-between h-4 mt-1">
                  {followLimitPegs.map((peg) => (
                    <span
                      key={peg}
                      className="text-xs text-muted-foreground"
                    >
                      {peg === 0 ? <span>&infin;</span> : peg}
                    </span>
                  ))}
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                {t('settings.wot.followLimitDescription')}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="starting-point">{t('settings.wot.startingUser')}</Label>
              <p className="text-sm text-muted-foreground">
                {t('settings.wot.startingUserDescription')}
              </p>
              {(startingPoint || user?.pubkey) && <WotAuthorCard pubkey={startingPoint || user?.pubkey || ""} />}
              <div className="flex gap-2">
                <Input
                  id="starting-point"
                  placeholder={t('settings.wot.startingUserPlaceholder')}
                  value={startingPoint}
                  onChange={handleStartingPointChange}
                  disabled={!isFilterEnabled || isLoading}
                  className="flex-1"
                />
                <Button
                  onClick={() => setStartingPoint(user?.pubkey || '')}
                  disabled={!isFilterEnabled || isLoading}
                  variant="ghost"
                >
                  {t('common.reset')}
                </Button>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>

        {isLoading && (
          <div className="space-y-2">
            <Label>{t('settings.wot.calculationProgress')}</Label>
            <Progress value={progress} className="w-full" />
            <p className="text-sm text-muted-foreground text-center">{Math.round(progress)}%</p>
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-center justify-between">
          <div>
            <p className="text-sm font-medium">
              {t('settings.wot.foundAuthors', { count: wotPubkeys.size })}
            </p>
            <p className="text-sm text-muted-foreground">
              {lastCalculated
                ? t('settings.wot.lastUpdated', { date: new Date(lastCalculated).toLocaleString() })
                : t('settings.wot.notCalculatedYet')}
            </p>
          </div>
          <div className="flex gap-2 mt-4 sm:mt-0">
            {isLoading && (
              <Button onClick={cancelCalculation} variant="outline">
                {t('common.cancel')}
              </Button>
            )}
            <Button onClick={handleCalculate} disabled={!isFilterEnabled || isLoading}>
              {isLoading ? t('settings.wot.updating') : t('settings.wot.update')}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
