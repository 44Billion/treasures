// import React from 'react';
import { useTranslation } from 'react-i18next';
import { Crown, Sparkles } from 'lucide-react';
import { BaseDialog } from '@/shared/components/ui/base-dialog';
import { Button } from '@/shared/components/ui/button';

interface WelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  isNewUser?: boolean;
}

export function WelcomeModal({ isOpen, onClose, isNewUser = false }: WelcomeModalProps) {
  const { t } = useTranslation();
  // Debug logging in development
  if (process.env.NODE_ENV === 'development') {
    console.log('WelcomeModal render:', { isOpen, isNewUser });
  }
  
  return (
    <BaseDialog 
      isOpen={isOpen} 
      onOpenChange={onClose}
      size="auth"
      title={
        <span className='font-semibold text-center text-lg flex items-center justify-center gap-2'>
          <Crown className="w-5 h-5 text-green-600 adventure:text-amber-700" />
          {isNewUser ? t('welcomeModal.title.newUser') : t('welcomeModal.title.returningUser')}
        </span>
      }
      description={
        <div className="text-center text-muted-foreground">
          {isNewUser 
            ? t('welcomeModal.description.newUser')
            : t('welcomeModal.description.returningUser')
          }
        </div>
      }
      headerClassName='px-6 pt-6 pb-1 relative flex-shrink-0'
      contentClassName='flex flex-col max-h-[90vh]'
    >
      <div className='px-6 pt-2 pb-4 space-y-4 flex-1'>
        <div className='text-center py-8 space-y-4'>
          <div className='relative'>
            <div className='w-24 h-24 mx-auto bg-gradient-to-br from-green-400 to-emerald-500 adventure:from-amber-400 adventure:to-orange-500 rounded-full flex items-center justify-center'>
              <Crown className='w-12 h-12 text-white' />
            </div>
            <div className='absolute inset-0 flex items-center justify-center'>
              <div className='w-32 h-32 border-4 border-green-300 adventure:border-amber-300 rounded-full animate-ping opacity-75'></div>
            </div>
          </div>
          
          <div className='space-y-2'>
            <h3 className='text-2xl font-bold text-green-700 adventure:text-amber-700 flex items-center justify-center gap-2'>
              <Sparkles className='w-6 h-6' />
              {isNewUser ? t('welcomeModal.title.newUser') : t('welcomeModal.title.returningUser')}
            </h3>
            <p className='text-muted-foreground px-5'>
              {isNewUser 
                ? t('welcomeModal.message.newUser')
                : t('welcomeModal.message.returningUser')
              }
            </p>
          </div>
          
          <Button
            onClick={onClose}
            className='mt-6 rounded-full py-3 px-6 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 adventure:from-amber-700 adventure:to-orange-700 adventure:hover:from-amber-800 adventure:hover:to-orange-800 transform transition-all duration-200 hover:scale-105 shadow-lg'
          >
            {isNewUser ? t('welcomeModal.button.newUser') : t('welcomeModal.button.returningUser')}
          </Button>
        </div>
      </div>
    </BaseDialog>
  );
}