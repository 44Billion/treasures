import React from 'react';
import { ShieldCheck, Sparkles, Crown, MapPin, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BaseDialog } from '@/components/ui/base-dialog';
import { Card, CardContent } from '@/components/ui/card';

interface VerifiedLoginPromptDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onLogin: () => void;
  onSignup: () => void;
  geocacheName?: string;
}

export const VerifiedLoginPromptDialog: React.FC<VerifiedLoginPromptDialogProps> = ({
  isOpen,
  onClose,
  onLogin,
  onSignup,
  geocacheName
}) => {
  const handleLogin = () => {
    onClose();
    onLogin();
  };

  const handleSignup = () => {
    onClose();
    onSignup();
  };

  return (
    <BaseDialog
      isOpen={isOpen}
      onOpenChange={onClose}
      size="auth"
      title={
        <span className="flex items-center justify-center gap-2">
          <ShieldCheck className="w-5 h-5 text-green-600 adventure:text-amber-700" />
          Verified Discovery!
        </span>
      }
      description={
        <span className="text-center">
          You've found a verified treasure!
        </span>
      }
      headerClassName='px-6 pt-6 pb-1 relative'
      contentClassName='flex flex-col max-h-[90vh]'
    >
      <div className='px-6 pt-2 pb-4 space-y-4 overflow-y-auto flex-1'>
        {/* Success celebration */}
        <div className='relative p-6 rounded-2xl bg-gradient-to-br from-green-50 to-emerald-100 dark:from-green-950/50 dark:to-emerald-950/50 adventure:from-amber-50 adventure:to-orange-100 adventure:dark:from-amber-950/50 adventure:dark:to-orange-950/50 overflow-hidden'>
          {/* Magical sparkles */}
          <div className='absolute inset-0 pointer-events-none'>
            <Sparkles className='absolute top-2 right-3 w-3 h-3 text-yellow-400 animate-pulse' style={{animationDelay: '0s'}} />
            <Star className='absolute top-4 left-4 w-2 h-2 text-yellow-500 animate-pulse' style={{animationDelay: '0.5s'}} />
            <Sparkles className='absolute bottom-3 right-4 w-3 h-3 text-yellow-400 animate-pulse' style={{animationDelay: '1s'}} />
            <Star className='absolute bottom-3 left-3 w-2 h-2 text-yellow-500 animate-pulse' style={{animationDelay: '1.5s'}} />
          </div>

          <div className='relative z-10 text-center space-y-3'>
            <div className='flex justify-center items-center gap-2 mb-2'>
              <div className='relative'>
                <div className='w-16 h-16 bg-gradient-to-br from-green-200 to-emerald-300 adventure:from-amber-200 adventure:to-orange-300 rounded-full flex items-center justify-center shadow-lg animate-pulse'>
                  <ShieldCheck className='w-8 h-8 text-green-800 adventure:text-amber-800' />
                </div>
                <div className='absolute -top-1 -right-1 w-5 h-5 bg-green-500 adventure:bg-amber-500 rounded-full flex items-center justify-center animate-bounce'>
                  <Sparkles className='w-3 h-3 text-white' />
                </div>
              </div>
            </div>

            <div className='space-y-2'>
              <h3 className='font-bold text-green-800 dark:text-green-200 adventure:text-amber-800 adventure:dark:text-amber-200 text-lg'>
                Congratulations, Treasure Hunter!
              </h3>
              <p className='text-sm text-green-700 dark:text-green-300 adventure:text-amber-700 adventure:dark:text-amber-300'>
                You've discovered <span className="font-semibold">{geocacheName || 'a verified treasure'}</span>!
              </p>
            </div>
          </div>
        </div>

        {/* Benefits explanation */}
        <div className='space-y-3'>
          <div className='text-center'>
            <p className='text-sm font-medium text-muted-foreground mb-3'>
              Create your account to claim this verified find:
            </p>
          </div>

          <div className='grid grid-cols-1 gap-2'>
            <Card className='border-green-200 dark:border-green-800 adventure:border-amber-200 adventure:dark:border-amber-800'>
              <CardContent className='p-3'>
                <div className='flex items-center gap-3'>
                  <div className='p-1.5 rounded-lg bg-green-100 dark:bg-green-900 adventure:bg-amber-100 adventure:dark:bg-amber-900'>
                    <ShieldCheck className='w-4 h-4 text-green-600 adventure:text-amber-600' />
                  </div>
                  <div className='flex-1'>
                    <div className='font-medium text-sm'>
                      Verified Badge
                    </div>
                    <div className='text-xs text-muted-foreground'>
                      Your find will be marked with a special verification badge
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className='border-green-200 dark:border-green-800 adventure:border-amber-200 adventure:dark:border-amber-800'>
              <CardContent className='p-3'>
                <div className='flex items-center gap-3'>
                  <div className='p-1.5 rounded-lg bg-green-100 dark:bg-green-900 adventure:bg-amber-100 adventure:dark:bg-amber-900'>
                    <MapPin className='w-4 h-4 text-green-600 adventure:text-amber-600' />
                  </div>
                  <div className='flex-1'>
                    <div className='font-medium text-sm'>
                      Track Your Adventures
                    </div>
                    <div className='text-xs text-muted-foreground'>
                      Keep a permanent record of all your treasure discoveries
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className='border-green-200 dark:border-green-800 adventure:border-amber-200 adventure:dark:border-amber-800'>
              <CardContent className='p-3'>
                <div className='flex items-center gap-3'>
                  <div className='p-1.5 rounded-lg bg-green-100 dark:bg-green-900 adventure:bg-amber-100 adventure:dark:bg-amber-900'>
                    <Crown className='w-4 h-4 text-green-600 adventure:text-amber-600' />
                  </div>
                  <div className='flex-1'>
                    <div className='font-medium text-sm'>
                      Join the Community
                    </div>
                    <div className='text-xs text-muted-foreground'>
                      Connect with fellow treasure hunters worldwide
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Action buttons */}
        <div className='space-y-3'>
          <Button
            onClick={handleSignup}
            className='w-full rounded-full py-4 text-base font-semibold bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 adventure:from-amber-700 adventure:to-orange-700 adventure:hover:from-amber-800 adventure:hover:to-orange-800 transform transition-all duration-200 hover:scale-105 shadow-lg'
          >
            <Sparkles className='w-4 h-4 mr-2' />
            Create My Account & Log Find
          </Button>

          <Button
            onClick={handleLogin}
            variant="outline"
            className='w-full rounded-full py-3'
          >
            I Already Have an Account
          </Button>
        </div>


      </div>
    </BaseDialog>
  );
};