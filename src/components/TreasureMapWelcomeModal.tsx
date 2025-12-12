import { useState, useEffect } from "react";
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { Button } from "@/components/ui/button";
import { Sparkles, Scroll } from "lucide-react";

interface TreasureMapWelcomeModalProps {
  onClose?: () => void;
}

export function TreasureMapWelcomeModal({ onClose }: TreasureMapWelcomeModalProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [hasSeenModal, setHasSeenModal] = useState(false);

  useEffect(() => {
    // Check if user has seen this modal before
    const seen = localStorage.getItem('treasures_trf_welcome_seen');
    if (!seen) {
      // Small delay for dramatic effect
      const timer = setTimeout(() => {
        setIsOpen(true);
      }, 300);
      return () => clearTimeout(timer);
    } else {
      setHasSeenModal(true);
    }
  }, []);

  const handleClose = () => {
    setIsOpen(false);
    localStorage.setItem('treasures_trf_welcome_seen', 'true');
    setHasSeenModal(true);
    onClose?.();
  };

  if (hasSeenModal) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl p-0 overflow-hidden border-4 border-amber-700 bg-gradient-to-br from-amber-50 via-yellow-50 to-amber-100 dark:from-amber-950 dark:via-yellow-950 dark:to-amber-900">
        <VisuallyHidden>
          <DialogTitle>{t('treasureMapWelcome.title')}</DialogTitle>
          <DialogDescription>
            {t('treasureMapWelcome.description')}
          </DialogDescription>
        </VisuallyHidden>

        {/* Mystical header with animation */}
        <div className="relative bg-gradient-to-r from-amber-900 via-amber-800 to-amber-900 text-white py-12 px-6 text-center overflow-hidden">
          {/* Animated background elements */}
          <div className="absolute inset-0 opacity-20">
            <div className="absolute top-4 left-4 animate-pulse">
              <Sparkles className="h-8 w-8" />
            </div>
            <div className="absolute top-8 right-8 animate-pulse animation-delay-300">
              <Sparkles className="h-6 w-6" />
            </div>
            <div className="absolute bottom-6 left-1/4 animate-pulse animation-delay-500">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="absolute bottom-8 right-1/3 animate-pulse animation-delay-700">
              <Sparkles className="h-7 w-7" />
            </div>
          </div>

          {/* Main icon */}
          <div className="relative mb-6 flex justify-center">
            <div className="relative">
              <Scroll className="h-24 w-24 text-amber-200 animate-bounce" />
              <Sparkles className="absolute -top-2 -right-2 h-8 w-8 text-yellow-300 animate-pulse" />
            </div>
          </div>

          {/* Title */}
          <h2 className="text-4xl md:text-5xl font-bold mb-3 font-serif tracking-wide">
            {t('treasureMapWelcome.heading')}
          </h2>
          <p className="text-xl text-amber-200 font-serif italic">
            {t('treasureMapWelcome.subheading')}
          </p>
        </div>

        {/* Content */}
        <div className="p-8 space-y-6">
          {/* Welcome message */}
          <div className="text-center space-y-4">
            <p className="text-lg text-foreground/90 leading-relaxed font-serif">
              {t('treasureMapWelcome.message1.prefix')}{' '}
              <span className="font-bold text-amber-800 dark:text-amber-400">{t('treasureMapWelcome.message1.legendary')}</span>
              {' '}{t('treasureMapWelcome.message1.middle')}{' '}
              <span className="font-bold">{t('treasureMapWelcome.message1.festival')}</span>
              {' '}{t('treasureMapWelcome.message1.suffix')}
            </p>
            <p className="text-base text-muted-foreground leading-relaxed">
              {t('treasureMapWelcome.message2.prefix')}{' '}
              <span className="font-semibold text-amber-700 dark:text-amber-400">{t('treasureMapWelcome.message2.secret')}</span>
              {' '}{t('treasureMapWelcome.message2.suffix')}
            </p>
          </div>

          {/* Action button */}
          <div className="flex justify-center pt-4">
            <Button
              size="lg"
              onClick={handleClose}
              className="bg-gradient-to-r from-amber-600 via-amber-700 to-amber-800 hover:from-amber-700 hover:via-amber-800 hover:to-amber-900 text-white font-bold px-8 py-6 text-lg shadow-lg hover:shadow-xl transition-all border-2 border-amber-900"
            >
              <Sparkles className="mr-2 h-5 w-5" />
              {t('treasureMapWelcome.button')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
