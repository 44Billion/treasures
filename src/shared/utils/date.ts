import i18next from 'i18next';

export function formatDistanceToNow(date: Date, options?: { addSuffix?: boolean }): string {
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  const intervals = [
    { label: 'year', labelPlural: 'years', seconds: 31536000 },
    { label: 'month', labelPlural: 'months', seconds: 2592000 },
    { label: 'week', labelPlural: 'weeks', seconds: 604800 },
    { label: 'day', labelPlural: 'days', seconds: 86400 },
    { label: 'hour', labelPlural: 'hours', seconds: 3600 },
    { label: 'minute', labelPlural: 'minutes', seconds: 60 },
    { label: 'second', labelPlural: 'seconds', seconds: 1 }
  ];
  
  for (const interval of intervals) {
    const count = Math.floor(diffInSeconds / interval.seconds);
    if (count >= 1) {
      const labelKey = count === 1 ? `date.${interval.label}` : `date.${interval.labelPlural}`;
      const translatedLabel = i18next.t(labelKey);
      const result = `${count} ${translatedLabel}`;
      return options?.addSuffix ? i18next.t('date.ago', { time: result }) : result;
    }
  }
  
  return options?.addSuffix ? i18next.t('date.justNow') : `0 ${i18next.t('date.seconds')}`;
}