import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2, Zap, Globe, WalletMinimal, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useNWC } from '@/hooks/useNWCContext';
import { useWallet } from '@/hooks/useWallet';
import { useToast } from '@/hooks/useToast';

/**
 * Inline wallet settings component for the Settings page.
 * Manages WebLN detection and NWC wallet connections.
 */
export function WalletSettings() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [connectionUri, setConnectionUri] = useState('');
  const [alias, setAlias] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);

  const {
    connections,
    activeConnection,
    connectionInfo,
    addConnection,
    removeConnection,
    setActiveConnection,
  } = useNWC();

  const { hasWebLN, isDetecting } = useWallet();
  const hasNWC = connections.length > 0 && connections.some(c => c.isConnected);

  const handleAddConnection = async () => {
    if (!connectionUri.trim()) {
      toast({
        title: t('wallet.nwc.connectionUriRequired'),
        description: t('wallet.nwc.connectionUriRequiredDescription'),
        variant: 'destructive',
      });
      return;
    }

    setIsConnecting(true);
    try {
      const success = await addConnection(connectionUri.trim(), alias.trim() || undefined);
      if (success) {
        setConnectionUri('');
        setAlias('');
        setAddDialogOpen(false);
      }
    } finally {
      setIsConnecting(false);
    }
  };

  const handleRemoveConnection = (connectionString: string) => {
    removeConnection(connectionString);
  };

  const handleSetActive = (connectionString: string) => {
    setActiveConnection(connectionString);
    toast({
      title: t('wallet.nwc.activeChanged'),
      description: t('wallet.nwc.activeChangedDescription'),
    });
  };

  return (
    <div>
      {/* Status */}
      <div className="pt-4 pb-4">
        <div className="px-3 space-y-3">
          <h3 className="text-sm font-medium">{t('wallet.currentStatus')}</h3>
        </div>
        <div className="mt-3 space-y-1 px-3">
          {/* WebLN */}
          <div className="flex items-center justify-between py-2.5">
            <div className="flex items-center gap-3">
              <Globe className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">{t('wallet.webln')}</p>
                <p className="text-xs text-muted-foreground">{t('wallet.webln.description')}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {hasWebLN && <CheckCircle className="h-4 w-4 text-primary" />}
              <Badge variant={hasWebLN ? 'default' : 'secondary'} className="text-xs">
                {isDetecting ? '...' : hasWebLN ? t('wallet.webln.ready') : t('wallet.webln.notFound')}
              </Badge>
            </div>
          </div>
          {/* NWC */}
          <div className="flex items-center justify-between py-2.5">
            <div className="flex items-center gap-3">
              <WalletMinimal className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">{t('wallet.nwc')}</p>
                <p className="text-xs text-muted-foreground">
                  {connections.length > 0
                    ? t('wallet.nwc.walletsConnected', {
                        count: connections.length,
                        defaultValue_one: '{{count}} wallet connected',
                        defaultValue_other: '{{count}} wallets connected',
                      })
                    : t('wallet.nwc.description')}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {hasNWC && <CheckCircle className="h-4 w-4 text-primary" />}
              <Badge variant={hasNWC ? 'default' : 'secondary'} className="text-xs">
                {hasNWC ? t('wallet.webln.ready') : t('wallet.nwc.none')}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {/* NWC Management */}
      <div className="pb-4 pt-4">
        <div className="px-3 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">{t('wallet.nwc')}</h3>
            <Button size="sm" variant="outline" onClick={() => setAddDialogOpen(true)} className="h-9 text-xs">
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              {t('wallet.nwc.add')}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Connect a Lightning wallet via Nostr Wallet Connect to send zaps directly.
          </p>
        </div>

        <div className="mt-3">
          {connections.length === 0 ? (
            <div className="text-xs text-muted-foreground py-8 text-center">
              {t('wallet.nwc.noWallets')}
            </div>
          ) : (
            <div className="space-y-1">
              {connections.map((connection) => {
                const info = connectionInfo[connection.connectionString];
                const isActive = activeConnection === connection.connectionString;
                return (
                  <div
                    key={connection.connectionString}
                    className="flex items-center gap-3 py-2.5 px-3 hover:bg-muted/20 transition-colors"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <WalletMinimal className="size-4 text-muted-foreground shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium leading-tight">
                          {connection.alias || info?.alias || t('wallet.title')}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {isActive ? 'Active' : t('wallet.nwc.connection')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {isActive ? (
                        <CheckCircle className="h-4 w-4 text-primary" />
                      ) : (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleSetActive(connection.connectionString)}
                          className="size-7 text-muted-foreground hover:text-foreground shrink-0"
                          title="Set as active"
                        >
                          <Zap className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveConnection(connection.connectionString)}
                        className="size-7 text-muted-foreground hover:text-destructive hover:bg-transparent shrink-0"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Add Wallet Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{t('wallet.nwc.connectTitle')}</DialogTitle>
            <DialogDescription>
              {t('wallet.nwc.connectDescription')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 px-4">
            <div>
              <Label htmlFor="wallet-alias">{t('wallet.nwc.walletName')}</Label>
              <Input
                id="wallet-alias"
                placeholder={t('wallet.nwc.walletNamePlaceholder')}
                value={alias}
                onChange={(e) => setAlias(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="wallet-uri">{t('wallet.nwc.connectionUri')}</Label>
              <Textarea
                id="wallet-uri"
                placeholder={t('wallet.nwc.connectionUriPlaceholder')}
                value={connectionUri}
                onChange={(e) => setConnectionUri(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter className="px-4">
            <Button
              onClick={handleAddConnection}
              disabled={isConnecting || !connectionUri.trim()}
              className="w-full"
            >
              {isConnecting ? t('wallet.nwc.connecting') : t('wallet.nwc.connect')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
