import { UserCheck, Users, Globe, XCircle, Swords } from 'lucide-react';
import { useWotStore } from '../shared/stores/useWotStore';
import { useNostr } from '@nostrify/react';
import { useCurrentUser } from '../features/auth/hooks/useCurrentUser';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Progress } from './ui/progress';
import { WotAuthorCard } from './WotAuthorCard';

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

  const handleCalculate = () => {
    calculateWot(nostr, user?.pubkey);
  };

  const handleStartingPointChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setStartingPoint(e.target.value);
  };
  
  const isFilterEnabled = trustLevel > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Web of Trust Filter</CardTitle>
        <CardDescription>
          Filter content based on your social network to reduce spam and discover relevant notes.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label>Trust Level</Label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Button
              variant={trustLevel === 1 ? 'secondary' : 'outline'}
              onClick={() => setTrustLevel(1)}
              disabled={isLoading}
              className="flex-1 flex-col h-auto py-2"
            >
              <UserCheck className="h-6 w-6 mb-1" />
              <span className="text-base">Strict</span>
            </Button>
            <Button
              variant={trustLevel === 2 ? 'secondary' : 'outline'}
              onClick={() => setTrustLevel(2)}
              disabled={isLoading}
              className="flex-1 flex-col h-auto py-2"
            >
              <Users className="h-6 w-6 mb-1" />
              <span className="text-base">Normal</span>
            </Button>
            <Button
              variant={trustLevel === 3 ? 'secondary' : 'outline'}
              onClick={() => setTrustLevel(3)}
              disabled={isLoading}
              className="flex-1 flex-col h-auto py-2"
            >
              <Globe className="h-6 w-6 mb-1" />
              <span className="text-base">Lax</span>
            </Button>
            <Button
              variant={trustLevel === 0 ? 'secondary' : 'outline'}
              onClick={() => setTrustLevel(0)}
              disabled={isLoading}
              className="flex-1 flex-col h-auto py-2"
            >
              <Swords className="h-6 w-6 mb-1" />
              <span className="text-base">All</span>
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            {trustLevel === 1 && "Strict: Only show content from people you directly follow."}
            {trustLevel === 2 && "Normal: Include content from people your follows follow (recommended)."}
            {trustLevel === 3 && "Lax: Include content from two degrees of separation."}
            {trustLevel === 0 && "All: Show content from everyone (filter disabled)."}
          </p>
        </div>

        <div className="space-y-2">
          <Label>Follow Limit</Label>
          <div className="flex gap-2">
            <Button
              variant={followLimit === 150 ? 'secondary' : 'outline'}
              onClick={() => setFollowLimit(150)}
              disabled={!isFilterEnabled || isLoading}
              className="flex-1"
            >
              150
            </Button>
            <Button
              variant={followLimit === 250 ? 'secondary' : 'outline'}
              onClick={() => setFollowLimit(250)}
              disabled={!isFilterEnabled || isLoading}
              className="flex-1"
            >
              250
            </Button>
            <Button
              variant={followLimit === 500 ? 'secondary' : 'outline'}
              onClick={() => setFollowLimit(500)}
              disabled={!isFilterEnabled || isLoading}
              className="flex-1"
            >
              500
            </Button>
            <Button
              variant={followLimit === 1000 ? 'secondary' : 'outline'}
              onClick={() => setFollowLimit(1000)}
              disabled={!isFilterEnabled || isLoading}
              className="flex-1"
            >
              1000
            </Button>
            <Button
              variant={followLimit === 2500 ? 'secondary' : 'outline'}
              onClick={() => setFollowLimit(2500)}
              disabled={!isFilterEnabled || isLoading}
              className="flex-1"
            >
              2500
            </Button>
            <Button
              variant={followLimit === 0 ? 'secondary' : 'outline'}
              onClick={() => setFollowLimit(0)}
              disabled={!isFilterEnabled || isLoading}
              className="flex-1 text-lg"
            >
              &infin;
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Ignore users with more than this many follows.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="starting-point">Starting Point (pubkey or hex)</Label>
          <p className="text-sm text-muted-foreground">
            The center of your trust network. Use your own profile by default.
          </p>
          {(startingPoint || user?.pubkey) && <WotAuthorCard pubkey={startingPoint || user?.pubkey || ""} />}
          <div className="flex gap-2">
            <Input
              id="starting-point"
              placeholder={user?.pubkey || 'Defaults to your pubkey'}
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
              {isLoading ? 'Calculating...' : 'Recalculate Now'}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
