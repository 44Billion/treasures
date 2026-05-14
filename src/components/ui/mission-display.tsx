import { useTranslation } from "react-i18next";
import { KeyRound } from "lucide-react";

interface MissionDisplayProps {
  /** The "Key Quest" mission text (plain visible text, no obfuscation). */
  mission: string;
  className?: string;
}

/**
 * Displays the "Key Quest" mission for a treasure. Unlike {@link HintDisplay},
 * this is shown in plain text and styled prominently because the mission is a
 * requirement to claim/log the treasure, not a spoiler hint.
 *
 * The underlying event data field is named `mission` per NIP-GC; the user-facing
 * concept is "Key Quest".
 */
export function MissionDisplay({ mission, className = "" }: MissionDisplayProps) {
  const { t } = useTranslation();

  return (
    <aside
      aria-label={t('cacheDetail.mission.label')}
      className={
        `not-prose relative flex gap-4 rounded-xl border border-primary/30 ` +
        `bg-primary/5 dark:bg-primary/10 ` +
        `pl-5 pr-4 py-4 ${className}`
      }
    >
      <span
        aria-hidden="true"
        className="absolute left-0 top-3 bottom-3 w-1 rounded-r-full bg-primary"
      />

      <div className="shrink-0 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
        <KeyRound className="h-5 w-5" aria-hidden="true" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="text-[0.7rem] font-semibold uppercase tracking-[0.08em] text-primary">
          {t('cacheDetail.mission.label')}
        </div>
        <p className="mt-0.5 text-base font-medium leading-snug text-foreground whitespace-pre-wrap break-words select-text">
          {mission}
        </p>
        <p className="mt-1.5 text-xs text-muted-foreground">
          {t('cacheDetail.mission.help')}
        </p>
      </div>
    </aside>
  );
}
