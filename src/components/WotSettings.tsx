import { UserCheck, Users, Globe } from 'lucide-react';
import { useWotStore } from '../shared/stores/useWotStore';
import { useNostr } from '@nostrify/react';
import { useCurrentUser } from '../features/auth/hooks/useCurrentUser';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Switch } from './ui/switch';
import { Progress } from './ui/progress';
import { WotAuthorCard } from './WotAuthorCard';

export function WotSettings() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const {
    isWotEnabled,
    degrees,
    startingPoint,
    wotPubkeys,
    isLoading,
    lastCalculated,
    progress,
    setEnabled,
    setDegrees,
    setStartingPoint,
    calculateWot,
    cancelCalculation,
  } = useWotStore();

  const handleCalculate = () => {
    calculateWot(nostr, user?.pubkey);
  };

  const handleStartingPointChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setStartingPoint(e.target.value);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Web of Trust Filter</CardTitle>
        <CardDescription>
          Filter content based on your social network to reduce spam and discover relevant notes.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <Label htmlFor="wot-enabled">Enable Web of Trust Filter</Label>
          <Switch
            id="wot-enabled"
            checked={isWotEnabled}
            onCheckedChange={setEnabled}
          />
        </div>

        <div className="space-y-2">
          <Label>Trust Level</Label>
          <div className="flex gap-2">
            <Button
              variant={degrees === 1 ? 'secondary' : 'outline'}
              onClick={() => setDegrees(1)}
              disabled={!isWotEnabled || isLoading}
              className="flex-1 flex-col h-auto py-2"
            >
              <UserCheck className="h-6 w-6 mb-1" />
              <span className="text-base">Strict</span>
            </Button>
            <Button
              variant={degrees === 2 ? 'secondary' : 'outline'}
              onClick={() => setDegrees(2)}
              disabled={!isWotEnabled || isLoading}
              className="flex-1 flex-col h-auto py-2"
            >
              <Users className="h-6 w-6 mb-1" />
              <span className="text-base">Normal</span>
            </Button>
            <Button
              variant={degrees === 3 ? 'secondary' : 'outline'}
              onClick={() => setDegrees(3)}
              disabled={!isWotEnabled || isLoading}
              className="flex-1 flex-col h-auto py-2"
            >
              <Globe className="h-6 w-6 mb-1" />
              <span className="text-base">Lax</span>
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            {degrees === 1 && "Strict: Only show content from people you directly follow."}
            {degrees === 2 && "Normal: Include content from people your follows follow (recommended)."}
            {degrees === 3 && "Lax: Include content from two degrees of separation."}
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="starting-point">Starting Point (pubkey or hex)</Label>
          <p className="text-sm text-muted-foreground">
            The center of your trust network. Leave blank to use your own profile.
          </p>
          {(startingPoint || user?.pubkey) && <WotAuthorCard pubkey={startingPoint || user?.pubkey} />}
          <div className="flex gap-2">
            <Input
              id="starting-point"
              placeholder={user?.npub || 'Defaults to your pubkey'}
              value={startingPoint}
              onChange={handleStartingPointChange}
              disabled={!isWotEnabled || isLoading}
              className="flex-1"
            />
            <Button
              onClick={() => setStartingPoint(user?.pubkey || '')}
              disabled={!isWotEnabled || isLoading}
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
            <Button onClick={handleCalculate} disabled={!isWotEnabled || isLoading}>
              {isLoading ? 'Calculating...' : 'Recalculate Now'}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
