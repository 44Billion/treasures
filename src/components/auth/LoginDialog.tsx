// NOTE: This file is stable and usually should not be modified.
// It is important that all functionality in this file is preserved, and should only be modified if explicitly requested.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Shield, Upload, AlertTriangle, Sparkles, Crown, Gem, Star, Loader2, Copy, Check, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import { QRCodeCanvas } from '@/components/ui/qrcode';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { BaseDialog } from '@/components/ui/base-dialog';
import { TabsContent } from '@/components/ui/tabs';
import { LoginMethodTabs } from '@/components/ui/mobile-button-patterns';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  useLoginActions,
  generateNostrConnectParams,
  generateNostrConnectURI,
  type NostrConnectParams,
} from '@/hooks/useLoginActions';
import { validateNsec, validateBunkerUri } from '@/utils/security';
import { useIsMobile } from '@/hooks/useIsMobile';

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
  const [nostrConnectParams, setNostrConnectParams] = useState<NostrConnectParams | null>(null);
  const [nostrConnectUri, setNostrConnectUri] = useState<string>('');
  const [isWaitingForConnect, setIsWaitingForConnect] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showBunkerInput, setShowBunkerInput] = useState(false);
  const [errors, setErrors] = useState<{
    nsec?: string;
    bunker?: string;
    file?: string;
    extension?: string;
  }>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const login = useLoginActions();

  // Check if on mobile device
  const isMobile = useIsMobile();
  // Generate nostrconnect params (sync) - just creates the QR code data
  const generateConnectSession = useCallback(() => {
    const relayUrls = login.getRelayUrls();
    const params = generateNostrConnectParams(relayUrls);
    const uri = generateNostrConnectURI(params, 'Treasures.to');
    setNostrConnectParams(params);
    setNostrConnectUri(uri);
    setConnectError(null);
  }, [login]);

  // Start listening for connection (async) - runs after params are set
  useEffect(() => {
    if (!nostrConnectParams || isWaitingForConnect) return;

    const startListening = async () => {
      setIsWaitingForConnect(true);
      abortControllerRef.current = new AbortController();

      try {
        await login.nostrconnect(nostrConnectParams);
        onLogin();
        onClose();
      } catch (error) {
        console.error('Nostrconnect failed:', error);
        setConnectError(error instanceof Error ? error.message : 'Connection failed');
        setIsWaitingForConnect(false);
      }
    };

    startListening();
  }, [nostrConnectParams, login, onLogin, onClose, isWaitingForConnect]);

  // Reset all state when dialog opens/closes
  useEffect(() => {
    if (!isOpen) {
      // Reset state when dialog closes
      setIsLoading(false);
      setIsFileLoading(false);
      setNsec('');
      setBunkerUri('');
      setNostrConnectParams(null);
      setNostrConnectUri('');
      setIsWaitingForConnect(false);
      setConnectError(null);
      setShowBunkerInput(false);
      setErrors({});
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [isOpen]);

  // Retry connection with new params
  const handleRetry = useCallback(() => {
    setNostrConnectParams(null);
    setNostrConnectUri('');
    setIsWaitingForConnect(false);
    setConnectError(null);
    // Generate new session after state clears
    setTimeout(() => generateConnectSession(), 0);
  }, [generateConnectSession]);

  const handleCopyUri = async () => {
    await navigator.clipboard.writeText(nostrConnectUri);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Open the nostrconnect URI in the system - this will launch a signer app like Amber if installed
  const handleOpenSignerApp = () => {
    if (!nostrConnectUri) return;
    // On mobile, this will trigger the system to find an app that handles nostrconnect:// URIs
    window.location.href = nostrConnectUri;
  };

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
      setErrors(prev => ({ ...prev, bunker: 'Please enter a bunker URI' }));
      return;
    }
    
    if (!validateBunkerUri(bunkerUri)) {
      setErrors(prev => ({ ...prev, bunker: 'Invalid bunker URI format. Must start with bunker://' }));
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
        bunker: 'Failed to connect to bunker. Please check the URI.'
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
        <div className='relative p-4 rounded-2xl bg-gradient-to-br from-secondary to-secondary/80 dark:from-primary-100 dark:to-primary-50 adventure:from-amber-50 adventure:to-orange-100 adventure:dark:from-amber-950/50 adventure:dark:to-orange-950/50 border border-primary-200 dark:border-primary-100 adventure:border-amber-200 adventure:dark:border-amber-800 overflow-hidden'>
          {/* Magical sparkles */}
          <div className='absolute inset-0 pointer-events-none'>
            <Sparkles className='absolute top-2 right-3 w-3 h-3 text-yellow-400 animate-pulse' style={{animationDelay: '0s'}} />
            <Star className='absolute top-4 left-4 w-2 h-2 text-yellow-500 animate-pulse' style={{animationDelay: '0.5s'}} />
            <Gem className='absolute bottom-3 right-4 w-2 h-2 text-yellow-400 animate-pulse' style={{animationDelay: '1s'}} />
          </div>
          
          <div className='relative z-10 text-center space-y-3'>
            <div className='flex justify-center items-center gap-2 mb-2'>
              <Crown className='w-5 h-5 text-primary adventure:text-amber-700' />
              <span className='font-semibold text-foreground adventure:text-amber-800 adventure:dark:text-amber-200'>
                <span className='adventure:hidden'>{t('login.newToGeocaching')}</span>
                <span className='hidden adventure:inline'>{t('login.newToQuest')}</span>
              </span>
            </div>
            
            <p className='text-sm text-muted-foreground adventure:text-amber-700 adventure:dark:text-amber-300 mb-3'>
              <span className='adventure:hidden'>
                {t('login.joinGuild')}
              </span>
              <span className='hidden adventure:inline'>
                {t('login.joinGuildAdventure')}
              </span>
            </p>
            
            <Button
              onClick={handleSignupClick}
              className='w-full rounded-full py-3 text-base font-semibold bg-primary hover:bg-primary/90 text-primary-foreground adventure:bg-gradient-to-r adventure:from-amber-700 adventure:to-orange-700 adventure:hover:from-amber-800 adventure:hover:to-orange-800 transform transition-all duration-200 hover:scale-105 shadow-lg border-0'
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
        <LoginMethodTabs 
          defaultMethod='key'
          onValueChange={(value) => {
            if (value === 'connect' && !nostrConnectParams && !connectError) {
              generateConnectSession();
            }
          }}
        >
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

            <TabsContent value='connect' className='space-y-4'>
              {/* Nostrconnect Section */}
              <div className='flex flex-col items-center space-y-4'>
                {connectError ? (
                  <div className='flex flex-col items-center space-y-4 py-4'>
                    <p className='text-sm text-red-500 text-center'>{connectError}</p>
                    <Button variant='outline' onClick={handleRetry}>
                      {t('login.connect.retry')}
                    </Button>
                  </div>
                ) : nostrConnectUri ? (
                  <>
                    {/* QR Code - only show on desktop */}
                    {!isMobile && (
                      <div className='p-4 bg-white dark:bg-white rounded-xl'>
                        <QRCodeCanvas
                          value={nostrConnectUri}
                          size={180}
                          level='M'
                        />
                      </div>
                    )}

                    {/* Status message */}
                    <div className='flex items-center gap-2 text-sm text-muted-foreground'>
                      {isWaitingForConnect ? (
                        <>
                          <Loader2 className='w-4 h-4 animate-spin' />
                          <span>{t('login.connect.waiting')}</span>
                        </>
                      ) : (
                        <span>{isMobile ? t('login.connect.openApp') : t('login.connect.scanQR')}</span>
                      )}
                    </div>

                    {/* Open Signer App button - primary action on mobile */}
                    {isMobile && (
                      <Button
                        className='w-full gap-2 py-6 rounded-full'
                        onClick={handleOpenSignerApp}
                      >
                        <ExternalLink className='w-5 h-5' />
                        {t('login.connect.openSignerApp')}
                      </Button>
                    )}

                    {/* Copy button */}
                    <Button
                      variant='outline'
                      size={isMobile ? 'default' : 'sm'}
                      className={isMobile ? 'w-full gap-2 rounded-full' : 'gap-2'}
                      onClick={handleCopyUri}
                    >
                      {copied ? (
                        <>
                          <Check className='w-4 h-4' />
                          {t('login.connect.copied')}
                        </>
                      ) : (
                        <>
                          <Copy className='w-4 h-4' />
                          {t('login.connect.copy')}
                        </>
                      )}
                    </Button>
                  </>
                ) : (
                  <div className='flex items-center justify-center h-[100px]'>
                    <Loader2 className='w-8 h-8 animate-spin text-muted-foreground' />
                  </div>
                )}
              </div>

              {/* Manual URI input section - collapsible */}
              <div className='pt-4 border-t border-gray-200 dark:border-gray-700'>
                <button
                  type='button'
                  onClick={() => setShowBunkerInput(!showBunkerInput)}
                  className='flex items-center justify-center gap-2 w-full text-sm text-muted-foreground hover:text-foreground transition-colors py-2'
                >
                  <span>{t('login.connect.manualBunker')}</span>
                  {showBunkerInput ? (
                    <ChevronUp className='w-4 h-4' />
                  ) : (
                    <ChevronDown className='w-4 h-4' />
                  )}
                </button>

                {showBunkerInput && (
                  <div className='space-y-3 mt-3'>
                    <div className='space-y-2'>
                      <Input
                        id='connectBunkerUri'
                        value={bunkerUri}
                        onChange={(e) => setBunkerUri(e.target.value)}
                        className='rounded-lg border-gray-300 dark:border-gray-700 focus-visible:ring-primary text-sm'
                        placeholder='bunker://'
                      />
                      {bunkerUri && !validateBunkerUri(bunkerUri) && (
                        <p className='text-red-500 text-xs'>{t('login.bunker.invalidFormat')}</p>
                      )}
                    </div>

                    <Button
                      className='w-full rounded-full py-4'
                      variant='outline'
                      onClick={handleBunkerLogin}
                      disabled={isLoading || !bunkerUri.trim() || !validateBunkerUri(bunkerUri)}
                    >
                      {isLoading ? t('login.bunker.connecting') : t('login.bunker.button')}
                    </Button>
                  </div>
                )}
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
          </LoginMethodTabs>
        </div>
      </BaseDialog>
    );
  };

export default LoginDialog;
