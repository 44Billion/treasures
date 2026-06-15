import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Bell, Trophy, SearchX, NotebookText, Wrench, Archive, Zap, Sparkles, ShieldCheck } from 'lucide-react';

import { DesktopHeader } from '@/components/DesktopHeader';
import { PageHero } from '@/components/PageHero';
import { LoginRequiredCard } from '@/components/LoginRequiredCard';
import { EmptyStateCard } from '@/components/ui/card-patterns';
import { ComponentLoading } from '@/components/ui/loading';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { CompactGeocacheCard } from '@/components/geocache-card';
import { LogText } from '@/components/LogText';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useAuthor } from '@/hooks/useAuthor';
import {
  useTreasureNotifications,
  type TreasureNotification,
  type TreasureNotificationType,
} from '@/hooks/useTreasureNotifications';
import { formatDistanceToNow } from '@/utils/date';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

const TYPE_ICON: Record<TreasureNotificationType, LucideIcon> = {
  found: Trophy,
  dnf: SearchX,
  note: NotebookText,
  maintenance: Wrench,
  archived: Archive,
  zap: Zap,
  'good-deed': Sparkles,
};

function NotificationRow({ notification }: { notification: TreasureNotification }) {
  const { t } = useTranslation();
  const author = useAuthor(notification.actorPubkey);
  const Icon = TYPE_ICON[notification.type];

  const actorName =
    author.data?.metadata?.name ||
    author.data?.metadata?.display_name ||
    `${notification.actorPubkey.slice(0, 8)}…`;
  const picture = author.data?.metadata?.picture;

  // Localized action verb per notification type.
  const action = t(`notifications.action.${notification.type}`, {
    defaultValue: {
      found: 'found your treasure',
      dnf: "couldn't find your treasure",
      note: 'left a note on your treasure',
      maintenance: 'reported maintenance on your treasure',
      archived: 'archived your treasure',
      zap: 'zapped your treasure',
      'good-deed': 'completed the Key Quest on your treasure',
    }[notification.type],
  });

  return (
    <div
      className={cn(
        'rounded-xl border p-3 space-y-3 transition-colors backdrop-blur-sm',
        notification.isNew
          ? 'bg-primary/15 dark:bg-primary/10 border-primary/40'
          : 'bg-background/70 dark:bg-card/80 border-border/60',
      )}
    >
      {/* Header: actor + action + type icon */}
      <div className="flex items-start gap-3">
        <Link to={`/profile/${notification.actorPubkey}`} className="shrink-0">
          <Avatar className="w-9 h-9">
            <AvatarImage src={picture} alt={actorName} />
            <AvatarFallback>{actorName.charAt(0)}</AvatarFallback>
          </Avatar>
        </Link>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-foreground">
            <Link
              to={`/profile/${notification.actorPubkey}`}
              className="font-semibold hover:underline"
            >
              {actorName}
            </Link>{' '}
            <span className="text-muted-foreground">{action}</span>
            {notification.type === 'zap' && notification.amountSats ? (
              <span className="font-medium text-amber-600 dark:text-amber-400">
                {' '}
                ({notification.amountSats.toLocaleString()} sats)
              </span>
            ) : null}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(notification.createdAt * 1000), {
                addSuffix: true,
              })}
            </span>
            {notification.type === 'found' && notification.isVerified && (
              <Badge
                variant="outline"
                className="gap-0.5 border-primary text-primary text-[10px] px-1.5 py-0"
              >
                <ShieldCheck className="h-3 w-3" />
                {t('notifications.verified', 'Verified')}
              </Badge>
            )}
          </div>
        </div>
        <div
          className={cn(
            'shrink-0 rounded-full p-1.5',
            notification.type === 'zap'
              ? 'text-amber-500 bg-amber-500/10'
              : 'text-primary bg-primary/10',
          )}
          aria-hidden="true"
        >
          <Icon className="w-4 h-4" />
        </div>
      </div>

      {/* Log / note / deed content */}
      {notification.text?.trim() && (
        <div className="pl-12">
          <LogText
            text={notification.text}
            hideNostrLinks
            className="text-sm text-foreground/90 line-clamp-4"
          />
        </div>
      )}

      {/* The treasure this activity targets */}
      {notification.geocache && (
        <CompactGeocacheCard cache={notification.geocache} />
      )}
    </div>
  );
}

export default function Notifications() {
  const { t } = useTranslation();
  const { user } = useCurrentUser();
  const { notifications, isLoading, markAsRead } = useTreasureNotifications();

  // Mark everything read shortly after the page is viewed.
  useEffect(() => {
    if (!user || notifications.length === 0) return;
    const id = setTimeout(() => {
      void markAsRead();
    }, 1000);
    return () => clearTimeout(id);
    // markAsRead identity changes each render; gate on stable inputs instead.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.pubkey, notifications.length]);

  if (!user) {
    return (
      <>
        <DesktopHeader />
        <PageHero
          icon={Bell}
          title={t('notifications.title', 'Notifications')}
          description={t(
            'notifications.description',
            'Activity on the treasures you created.',
          )}
        >
          <div className="container mx-auto px-4 max-w-2xl pb-12">
            <LoginRequiredCard
              icon={Bell}
              title={t('notifications.title', 'Notifications')}
              description={t(
                'notifications.loginRequired',
                'Log in to see activity on your treasures.',
              )}
            />
          </div>
        </PageHero>
      </>
    );
  }

  return (
    <>
      <DesktopHeader />
      <PageHero
        icon={Bell}
        title={t('notifications.title', 'Notifications')}
        description={t(
          'notifications.description',
          'Activity on the treasures you created.',
        )}
      >
        <div className="container mx-auto px-4 max-w-2xl pb-12">
          {isLoading ? (
            <ComponentLoading onHero />
          ) : notifications.length === 0 ? (
            <EmptyStateCard
              icon={Bell}
              title={t('notifications.emptyTitle', 'No notifications yet')}
              description={t(
                'notifications.emptyDescription',
                "When someone finds, logs, or zaps one of your treasures, you'll see it here.",
              )}
            />
          ) : (
            <div className="space-y-3">
              {notifications.map((n) => (
                <NotificationRow key={n.id} notification={n} />
              ))}
            </div>
          )}
        </div>
      </PageHero>
    </>
  );
}
