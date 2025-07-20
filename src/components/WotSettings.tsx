import { UserCheck, Users, Globe, Swords, ChevronDown, Info } from 'lucide-react';
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
      setFollowLimit(followLimitPegs[value[0]]);
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
        <CardTitle>Web of Trust Filter</CardTitle>
        <CardDescription>
          Filter geocache listings and logs based on your social network to reduce spam.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label>Trust Level</Label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Button
              variant={trustLevel === 1 ? 'secondary' : 'outline'}
              data-variant={trustLevel === 1 ? 'secondary' : 'outline'}
              onClick={() => setTrustLevel(1)}
              disabled={isLoading}
              className="flex-1 flex-col md:flex-row h-auto py-2 items-center"
            >
              <UserCheck className="h-6 w-6 mb-1 md:mb-0 md:mr-2" />
              <span className="text-base">Strict</span>
            </Button>
            <Button
              variant={trustLevel === 2 ? 'secondary' : 'outline'}
              data-variant={trustLevel === 2 ? 'secondary' : 'outline'}
              onClick={() => setTrustLevel(2)}
              disabled={isLoading}
              className="flex-1 flex-col md:flex-row h-auto py-2 items-center"
            >
              <Users className="h-6 w-6 mb-1 md:mb-0 md:mr-2" />
              <span className="text-base">Normal</span>
            </Button>
            <Button
              variant={trustLevel === 3 ? 'secondary' : 'outline'}
              data-variant={trustLevel === 3 ? 'secondary' : 'outline'}
              onClick={() => setTrustLevel(3)}
              disabled={isLoading}
              className="flex-1 flex-col md:flex-row h-auto py-2 items-center"
            >
              <Globe className="h-6 w-6 mb-1 md:mb-0 md:mr-2" />
              <span className="text-base">Lax</span>
            </Button>
            <Button
              variant={trustLevel === 0 ? 'secondary' : 'outline'}
              data-variant={trustLevel === 0 ? 'secondary' : 'outline'}
              onClick={() => setTrustLevel(0)}
              disabled={isLoading}
              className="flex-1 flex-col md:flex-row h-auto py-2 items-center"
            >
              <Swords className="h-6 w-6 mb-1 md:mb-0 md:mr-2" />
              <span className="text-base">All</span>
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            {trustLevel === 1 && "Strict: Only show content from people you directly follow."}
            {trustLevel === 2 && "Normal: Include content from people your follows follow (recommended)."}
            {trustLevel === 3 && "Lax: Include content from two degrees of separation."}
            {trustLevel === 0 && "All: Show content from everyone (filter disabled)."}
          </p>
          {trustLevel === 3 && (
            <div className="flex items-center gap-2 text-sm text-foreground bg-background border rounded-lg p-3 mt-2">
              <Info className="h-5 w-5 flex-shrink-0" />
              <p>
                Lax mode may be slow to calculate depending on the following count.
              </p>
            </div>
          )}
        </div>

        <Collapsible open={isAdvancedOpen} onOpenChange={setIsAdvancedOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full flex justify-between items-center">
              Advanced Settings
              <ChevronDown className={`h-4 w-4 transition-transform ${isAdvancedOpen ? 'rotate-180' : ''}`} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-6 pt-4">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label>Follow Limit</Label>
                <span className="text-sm font-medium">
                  {followLimit === 0 ? 'No Limit' : followLimit}
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
                Ignore users with more than this many follows.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="starting-point">Starting User (npub or hex)</Label>
              <p className="text-sm text-muted-foreground">
                The center of your trust network. Use a valid public key, or your own by default.
              </p>
              {(startingPoint || user?.pubkey) && <WotAuthorCard pubkey={startingPoint || user?.pubkey || ""} />}
              <div className="flex gap-2">
                <Input
                  id="starting-point"
                  placeholder='Enter a valid pubkey (npub or hex)'
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
                  Reset
                </Button>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>

        {isLoading && (
          <div className="space-y-2">
            <Label>Calculation Progress</Label>
            <Progress value={progress} className="w-full" />
            <p className="text-sm text-muted-foreground text-center">{Math.round(progress)}%</p>
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-center justify-between">
          <div>
            <p className="text-sm font-medium">
              {`Found ${wotPubkeys.size} trusted authors.`}
            </p>
            <p className="text-sm text-muted-foreground">
              {lastCalculated
                ? `Last updated: ${new Date(lastCalculated).toLocaleString()}`
                : 'Not calculated yet.'}
            </p>
          </div>
          <div className="flex gap-2 mt-4 sm:mt-0">
            {isLoading && (
              <Button onClick={cancelCalculation} variant="outline">
                Cancel
              </Button>
            )}
            <Button onClick={handleCalculate} disabled={!isFilterEnabled || isLoading}>
              {isLoading ? 'Updating...' : 'Update'}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
