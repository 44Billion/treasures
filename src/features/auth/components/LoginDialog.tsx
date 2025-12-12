// NOTE: This file is stable and usually should not be modified.
// It is important that all functionality in this file is preserved, and should only be modified if explicitly requested.

import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Shield, Upload, AlertTriangle, Sparkles, Crown, Gem, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { BaseDialog } from '@/components/ui/base-dialog';
import { TabsContent } from '@/components/ui/tabs';
import { LoginMethodTabs } from '@/components/ui/mobile-button-patterns';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useLoginActions } from '@/features/auth/hooks/useLoginActions';
import { validateNsec, validateBunkerUri } from '@/shared/utils/security';

interface LoginDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onLogin: () => void;
  onSignup?: () => void;
}

const LoginDialog: React.FC<LoginDialogProps> = ({ isOpen, onClose, onLogin, onSignup }) => {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const [isFileLoading, setIsFileLoading] = useState(false);
  const [nsec, setNsec] = useState('');
  const [bunkerUri, setBunkerUri] = useState('');
  const [errors, setErrors] = useState<{
    nsec?: string;
    bunker?: string;
    file?: string;
    extension?: string;
  }>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const login = useLoginActions();

  const handleExtensionLogin = async () => {
    setIsLoading(true);
    setErrors(prev => ({ ...prev, extension: undefined }));
    
    try {
      if (!('nostr' in window)) {
        throw new Error(t('login.extension.notFound'));
      }
      await login.extension();
      onLogin();
      onClose();
    } catch (error) {
      setErrors(prev => ({ 
        ...prev, 
        extension: error instanceof Error ? error.message : t('login.extension.failed')
      }));
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyLogin = () => {
    if (!nsec.trim()) {
      setErrors(prev => ({ ...prev, nsec: t('login.key.enterKey') }));
      return;
    }
    
    if (!validateNsec(nsec)) {
      setErrors(prev => ({ ...prev, nsec: t('login.key.invalidFormat') }));
      return;
    }

    setIsLoading(true);
    setErrors(prev => ({ ...prev, nsec: undefined }));
    
    try {
      login.nsec(nsec);
      onLogin();
      onClose();
      // Clear the key from memory
      setNsec('');
    } catch (error) {
      setErrors(prev => ({ 
        ...prev, 
        nsec: t('login.key.failed')
      }));
    } finally {
      setIsLoading(false);
    }
  };

  const handleBunkerLogin = async () => {
    if (!bunkerUri.trim()) {
      setErrors(prev => ({ ...prev, bunker: t('login.bunker.enterUri') }));
      return;
    }
    
    if (!validateBunkerUri(bunkerUri)) {
      setErrors(prev => ({ ...prev, bunker: t('login.bunker.invalidFormat') }));
      return;
    }

    setIsLoading(true);
    setErrors(prev => ({ ...prev, bunker: undefined }));
    
    try {
      await login.bunker(bunkerUri);
      onLogin();
      onClose();
      // Clear the URI from memory
      setBunkerUri('');
    } catch (error) {
      setErrors(prev => ({ 
        ...prev, 
        bunker: t('login.bunker.failed')
      }));
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsFileLoading(true);
    setErrors(prev => ({ ...prev, file: undefined }));

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        const trimmedContent = content.trim();
        if (validateNsec(trimmedContent)) {
          setNsec(trimmedContent);
        } else {
          setErrors(prev => ({ ...prev, file: t('login.key.fileInvalid') }));
        }
      } else {
        setErrors(prev => ({ ...prev, file: t('login.key.fileReadError') }));
      }
      setIsFileLoading(false);
    };
    reader.onerror = () => {
      setErrors(prev => ({ ...prev, file: t('login.key.fileFailed') }));
      setIsFileLoading(false);
    };
    reader.readAsText(file);
  };

  const handleSignupClick = () => {
    onClose();
    if (onSignup) {
      onSignup();
    }
  };

  return (
    <BaseDialog 
      isOpen={isOpen} 
      onOpenChange={onClose}
      size="auth"
      title={<span className='font-semibold text-center'>{t('login.title')}</span>}
      description={t('login.description')}
      headerClassName='px-6 pt-6 pb-1 relative'
      contentClassName='flex flex-col max-h-[90vh]'
    >
      <div className='px-6 pt-2 pb-4 space-y-4 overflow-y-auto flex-1'>
        {/* Prominent Sign Up Section */}
        <div className='relative p-4 rounded-2xl bg-gradient-to-br from-green-50 to-emerald-100 dark:from-green-950/50 dark:to-emerald-950/50 adventure:from-amber-50 adventure:to-orange-100 adventure:dark:from-amber-950/50 adventure:dark:to-orange-950/50 border border-green-200 dark:border-green-800 adventure:border-amber-200 adventure:dark:border-amber-800 overflow-hidden'>
          {/* Magical sparkles */}
          <div className='absolute inset-0 pointer-events-none'>
            <Sparkles className='absolute top-2 right-3 w-3 h-3 text-yellow-400 animate-pulse' style={{animationDelay: '0s'}} />
            <Star className='absolute top-4 left-4 w-2 h-2 text-yellow-500 animate-pulse' style={{animationDelay: '0.5s'}} />
            <Gem className='absolute bottom-3 right-4 w-2 h-2 text-yellow-400 animate-pulse' style={{animationDelay: '1s'}} />
          </div>
          
          <div className='relative z-10 text-center space-y-3'>
            <div className='flex justify-center items-center gap-2 mb-2'>
              <Crown className='w-5 h-5 text-green-600 adventure:text-amber-700' />
              <span className='font-semibold text-green-800 dark:text-green-200 adventure:text-amber-800 adventure:dark:text-amber-200'>
                <span className='adventure:hidden'>{t('login.newToGeocaching')}</span>
                <span className='hidden adventure:inline'>{t('login.newToQuest')}</span>
              </span>
            </div>
            
            <p className='text-sm text-green-700 dark:text-green-300 adventure:text-amber-700 adventure:dark:text-amber-300 mb-3'>
              <span className='adventure:hidden'>
                {t('login.joinGuild')}
              </span>
              <span className='hidden adventure:inline'>
                {t('login.joinGuildAdventure')}
              </span>
            </p>
            
            <Button
              onClick={handleSignupClick}
              className='w-full rounded-full py-3 text-base font-semibold bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 adventure:from-amber-700 adventure:to-orange-700 adventure:hover:from-amber-800 adventure:hover:to-orange-800 transform transition-all duration-200 hover:scale-105 shadow-lg border-0'
            >
              <Sparkles className='w-4 h-4 mr-2' />
              <span className='adventure:hidden'>{t('login.startAdventure')}</span>
              <span className='hidden adventure:inline'>{t('login.beginQuest')}</span>
            </Button>
          </div>
        </div>

        {/* Divider */}
        <div className='relative'>
          <div className='absolute inset-0 flex items-center'>
            <div className='w-full border-t border-gray-300 dark:border-gray-600'></div>
          </div>
          <div className='relative flex justify-center text-sm'>
            <span className='px-3 bg-background text-muted-foreground'>
              <span>{t('login.orReturn')}</span>
            </span>
          </div>
        </div>

        {/* Login Methods */}
        <LoginMethodTabs defaultMethod='key'>
            <TabsContent value='extension' className='space-y-3 bg-muted'>
              {errors.extension && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{errors.extension}</AlertDescription>
                </Alert>
              )}
              <div className='text-center p-4 rounded-lg bg-gray-50 dark:bg-gray-800'>
                <Shield className='w-12 h-12 mx-auto mb-3 text-primary' />
                <p className='text-sm text-gray-600 dark:text-gray-300 mb-4'>
                  {t('login.extension.title')}
                </p>
                <div className="flex justify-center">
                  <Button
                    className='w-full rounded-full py-4'
                    onClick={handleExtensionLogin}
                    disabled={isLoading}
                  >
                    {isLoading ? t('login.extension.loggingIn') : t('login.extension.button')}
                  </Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value='key' className='space-y-4'>
              <div className='space-y-4'>
                <div className='space-y-2'>
                  <label htmlFor='nsec' className='text-sm font-medium'>
                    {t('login.key.label')}
                  </label>
                  <Input
                    id='nsec'
                    type="password"
                    value={nsec}
                    onChange={(e) => {
                      setNsec(e.target.value);
                      if (errors.nsec) setErrors(prev => ({ ...prev, nsec: undefined }));
                    }}
                    className={`rounded-lg ${
                      errors.nsec ? 'border-red-500 focus-visible:ring-red-500' : ''
                    }`}
                    placeholder={t('login.key.placeholder')}
                    autoComplete="off"
                  />
                  {errors.nsec && (
                    <p className="text-sm text-red-500">{errors.nsec}</p>
                  )}
                </div>

                <Button
                  className='w-full rounded-full py-3'
                  onClick={handleKeyLogin}
                  disabled={isLoading || !nsec.trim()}
                >
                  {isLoading ? t('login.key.verifying') : t('login.key.logIn')}
                </Button>

                <div className='relative'>
                  <div className='absolute inset-0 flex items-center'>
                    <div className='w-full border-t border-muted'></div>
                  </div>
                  <div className='relative flex justify-center text-xs'>
                    <span className='px-2 bg-background text-muted-foreground'>
                      {t('login.key.or')}
                    </span>
                  </div>
                </div>

                <div className='text-center'>
                  <input
                    type='file'
                    accept='.txt'
                    className='hidden'
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                  />
                  <Button
                    variant='outline'
                    className='w-full'
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isLoading || isFileLoading}
                  >
                    <Upload className='w-4 h-4 mr-2' />
                    {isFileLoading ? t('login.key.readingFile') : t('login.key.upload')}
                  </Button>
                  {errors.file && (
                    <p className="text-sm text-red-500 mt-2">{errors.file}</p>
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value='bunker' className='space-y-3 bg-muted'>
              <div className='space-y-2'>
                <label htmlFor='bunkerUri' className='text-sm font-medium text-gray-700 dark:text-gray-400'>
                  {t('login.bunker.label')}
                </label>
                <Input
                  id='bunkerUri'
                  value={bunkerUri}
                  onChange={(e) => {
                    setBunkerUri(e.target.value);
                    if (errors.bunker) setErrors(prev => ({ ...prev, bunker: undefined }));
                  }}
                  className={`rounded-lg border-gray-300 dark:border-gray-700 focus-visible:ring-primary ${
                    errors.bunker ? 'border-red-500' : ''
                  }`}
                  placeholder={t('login.bunker.placeholder')}
                  autoComplete="off"
                />
                {errors.bunker && (
                  <p className="text-sm text-red-500">{errors.bunker}</p>
                )}
              </div>

              <div className="flex justify-center">
                <Button
                  className='w-full rounded-full py-4'
                  onClick={handleBunkerLogin}
                  disabled={isLoading || !bunkerUri.trim()}
                >
                  {isLoading ? t('login.bunker.connecting') : t('login.bunker.button')}
                </Button>
              </div>
            </TabsContent>
          </LoginMethodTabs>
        </div>
      </BaseDialog>
    );
  };

export default LoginDialog;
