import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Eye, EyeOff } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface HintDisplayProps {
  hint: string;
  className?: string;
}

export function HintDisplay({ hint, className = "" }: HintDisplayProps) {
  const { t } = useTranslation();
  const [isHintVisible, setIsHintVisible] = useState(false);

  return (
    <Alert className={`py-2 ${className}`}>
      <AlertDescription className="break-words">
        <div className="flex items-center justify-between gap-2">
          <div className="flex-1">
            <strong className="text-foreground-muted">{t('cacheDetail.hint.label')}</strong>{' '}
            <span 
              className={`transition-all duration-200 ${
                isHintVisible ? '' : 'blur-sm'
              }`}
            >
              {hint}
            </span>
          </div>
          <button
            onClick={() => setIsHintVisible(!isHintVisible)}
            className="flex-shrink-0 p-0.5 -mr-4 sm:-mr-0 rounded hover:bg-gray-100 transition-colors"
            title={isHintVisible ? t('cacheDetail.hint.hide') : t('cacheDetail.hint.reveal')}
            type="button"
          >
            {isHintVisible ? (
              <EyeOff className="h-3.5 w-3.5 text-gray-600" />
            ) : (
              <Eye className="h-3.5 w-3.5 text-gray-600" />
            )}
          </button>
        </div>
      </AlertDescription>
    </Alert>
  );
}