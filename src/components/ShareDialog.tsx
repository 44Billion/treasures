import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Copy, Share2, ExternalLink } from 'lucide-react';
import { hapticLight } from '@/utils/haptics';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { geocacheToNaddr } from '@/utils/naddr';
import { getAppOrigin } from '@/utils/appUrl';
import type { Geocache } from '@/types/geocache';

interface ShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  geocache: Geocache;
}

export function ShareDialog({ open, onOpenChange, geocache }: ShareDialogProps) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  // Generate the shareable URL using the actual geocache kind
  const naddr = geocacheToNaddr(geocache.pubkey, geocache.dTag, geocache.relays, geocache.kind);
  const shareUrl = `${getAppOrigin()}/${naddr}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      hapticLight();
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      // Fallback for browsers that don't support clipboard API
      const textArea = document.createElement('textarea');
      textArea.value = shareUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleNativeShare = async () => {
    if ('share' in navigator && navigator.share) {
      hapticLight();
      try {
        await navigator.share({
          title: geocache.name,
          text: t('shareDialog.shareText', { name: geocache.name }),
          url: shareUrl,
        });
      } catch (error) {
        // User cancelled or error occurred, fallback to copy
        handleCopyLink();
      }
    } else {
      // Fallback to copy if native sharing not available
      handleCopyLink();
    }
  };

  const handleOpenInNewTab = () => {
    window.open(shareUrl, '_blank');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            {t('shareDialog.title')}
          </DialogTitle>
          <DialogDescription>
            {t('shareDialog.description', { name: geocache.name })}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="share-url">{t('shareDialog.link')}</Label>
            <div className="flex gap-2">
              <Input
                id="share-url"
                value={shareUrl}
                readOnly
                className="flex-1"
              />
              <Button
                size="icon"
                variant="outline"
                onClick={handleCopyLink}
                className="shrink-0"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-primary" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          <div className="flex gap-2">
            {'share' in navigator && (
              <Button onClick={handleNativeShare} className="flex-1">
                <Share2 className="h-4 w-4 mr-2" />
                {t('common.share')}
              </Button>
            )}
            <Button 
              variant="outline" 
              onClick={handleOpenInNewTab}
              className="flex-1"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              {t('common.open')}
            </Button>
            {!('share' in navigator) && (
              <Button onClick={handleCopyLink} className="flex-1">
                {copied ? (
                  <>
                    <Check className="h-4 w-4 mr-2 text-primary" />
                    {t('common.copiedBang')}
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 mr-2" />
                    {t('common.copyLink')}
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}