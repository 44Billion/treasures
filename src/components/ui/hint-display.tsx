import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Eye, EyeOff } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { maybeDecodeRot13 } from "@/utils/rot13";

interface HintDisplayProps {
  hint: string;
  className?: string;
}

export function HintDisplay({ hint, className = "" }: HintDisplayProps) {
  const { t } = useTranslation();
  const [isHintVisible, setIsHintVisible] = useState(false);

  // Some hints (especially those imported from traditional geocaching listings)
  // are stored ROT13-encoded. Auto-decode when detected so users see the real
  // hint after revealing.
  const displayHint = useMemo(() => maybeDecodeRot13(hint), [hint]);

  return (
    <Alert className={`py-2 ${className}`}>
      <AlertDescription className="break-words">
        <div className="flex items-center justify-between gap-2">
          <div className="flex-1">
            <strong className="text-foreground">{t('cacheDetail.hint.label')}</strong>{' '}
            <span
              className={`transition-all duration-200 ${
                isHintVisible ? '' : 'blur-sm'
              }`}
            >
              {displayHint}
            </span>
          </div>
          <button
            onClick={() => setIsHintVisible(!isHintVisible)}
            className="flex-shrink-0 p-0.5 -mr-4 sm:-mr-0 rounded hover:bg-muted transition-colors"
            title={isHintVisible ? t('cacheDetail.hint.hide') : t('cacheDetail.hint.reveal')}
            type="button"
          >
            {isHintVisible ? (
              <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
            ) : (
              <Eye className="h-3.5 w-3.5 text-muted-foreground" />
            )}
          </button>
        </div>
      </AlertDescription>
    </Alert>
  );
}