// Inline-friendly clone of LoginDialog body. This is a near-verbatim copy of
// the dialog's login methods used by HowTo to embed login in the page rather
// than in a modal. LoginDialog itself remains the source of truth used
// everywhere else; it is marked "stable, do not modify". Keep this file in
// sync if/when the login methods change.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Upload, Sparkles, Crown, Gem, Star, Loader2, Copy, Check, ChevronDown, ExternalLink, Shield, KeyRound } from 'lucide-react';
import { QRCodeCanvas } from '@/components/ui/qrcode';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  useLoginActions,
  generateNostrConnectParams,
  generateNostrConnectURI,
  type NostrConnectParams,
} from '@/hooks/useLoginActions';
import { validateNsec, validateBunkerUri } from '@/utils/security';
import { useIsMobile } from '@/hooks/useIsMobile';

interface LoginFlowProps {
  /** Fires after a successful login. */
  onLogin: () => void;
  /** Fires when the user wants to go to the signup flow instead. */
  onSignup?: () => void;
}

/**
 * Inline login flow: extension button, remote signer (nostrconnect), and
 * secret-key paste. Behaves like LoginDialog without the modal chrome.
 */
export function LoginFlow({ onLogin, onSignup }: LoginFlowProps) {
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
  const [showConnectSection, setShowConnectSection] = useState(false);
  const [showKeySection, setShowKeySection] = useState(false);
  const [errors, setErrors] = useState<{
    nsec?: string;
    bunker?: string;
    file?: string;
    extension?: string;
  }>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const nsecInputRef = useRef<HTMLInputElement>(null);
  const login = useLoginActions();

  const hasExtension = typeof window !== 'undefined' && 'nostr' in window;
  const isMobile = useIsMobile();

  useEffect(() => {
    if (hasExtension && !showKeySection) return;
    const timer = setTimeout(() => {
      nsecInputRef.current?.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, [hasExtension, showKeySection]);

  const generateConnectSession = useCallback(() => {
    const relayUrls = login.getRelayUrls();
    const params = generateNostrConnectParams(relayUrls);
    const uri = generateNostrConnectURI(params, 'Treasures.to');
    setNostrConnectParams(params);
    setNostrConnectUri(uri);
    setConnectError(null);
  }, [login]);

  useEffect(() => {
    if (!nostrConnectParams || isWaitingForConnect) return;

    const startListening = async () => {
      setIsWaitingForConnect(true);
      abortControllerRef.current = new AbortController();

      try {
        await login.nostrconnect(nostrConnectParams);
        onLogin();
      } catch (error) {
        console.error('Nostrconnect failed:', error);
        setConnectError(error instanceof Error ? error.message : 'Connection failed');
        setIsWaitingForConnect(false);
      }
    };

    startListening();
  }, [nostrConnectParams, login, onLogin, isWaitingForConnect]);

  // Cleanup on unmount: abort any in-flight nostrconnect listen.
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const handleRetry = useCallback(() => {
    setNostrConnectParams(null);
    setNostrConnectUri('');
    setIsWaitingForConnect(false);
    setConnectError(null);
    setTimeout(() => generateConnectSession(), 0);
  }, [generateConnectSession]);

  const handleCopyUri = async () => {
    await navigator.clipboard.writeText(nostrConnectUri);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenSignerApp = () => {
    if (!nostrConnectUri) return;
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
    } catch (error) {
      setErrors(prev => ({
        ...prev,
        extension: error instanceof Error ? error.message : t('login.extension.failed'),
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
      setNsec('');
    } catch {
      setErrors(prev => ({
        ...prev,
        nsec: t('login.key.failed'),
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
      setBunkerUri('');
    } catch {
      setErrors(prev => ({
        ...prev,
        bunker: 'Failed to connect to bunker. Please check the URI.',
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
          setErrors(prev => ({ ...prev, nsec: undefined }));
          setIsFileLoading(false);
          setIsLoading(true);
          try {
            login.nsec(trimmedContent);
            onLogin();
            setNsec('');
          } catch {
            setErrors(prev => ({ ...prev, nsec: t('login.key.failed') }));
          } finally {
            setIsLoading(false);
          }
          return;
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

  const keyInput = (
    <>
      <div className='space-y-2'>
        <Input
          ref={nsecInputRef}
          type='password'
          value={nsec}
          onChange={(e) => {
            setNsec(e.target.value);
            if (errors.nsec) setErrors(prev => ({ ...prev, nsec: undefined }));
          }}
          className={`rounded-xl ${errors.nsec ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
          placeholder={t('login.key.placeholder')}
          autoComplete='off'
        />
        {errors.nsec && (
          <p className='text-sm text-red-500 text-center' role='alert'>{errors.nsec}</p>
        )}
      </div>

      <div className='flex gap-2'>
        <Button
          onClick={handleKeyLogin}
          disabled={isLoading || !nsec.trim()}
          className='flex-1 rounded-full'
        >
          {isLoading ? t('login.key.verifying') : t('login.key.logIn')}
        </Button>
        <input
          type='file'
          accept='.txt'
          className='hidden'
          ref={fileInputRef}
          onChange={handleFileUpload}
        />
        <Button
          variant='outline'
          size='icon'
          onClick={() => fileInputRef.current?.click()}
          disabled={isLoading || isFileLoading}
          className='rounded-full'
          aria-label={t('login.key.uploadFile', 'Upload nsec from .txt file')}
        >
          <Upload className='w-4 h-4' aria-hidden='true' />
        </Button>
      </div>
      {errors.file && (
        <p className='text-sm text-red-500 text-center' role='alert'>{errors.file}</p>
      )}
    </>
  );

  return (
    <div className='relative overflow-hidden rounded-2xl border border-border/40 bg-background text-foreground'>
      <div className='px-6 pt-6 pb-1 text-center'>
        <div className='font-semibold text-lg'>{t('login.title')}</div>
        <div className='text-sm text-muted-foreground mt-1'>{t('login.description')}</div>
      </div>

      <div className='px-6 pt-2 pb-4 space-y-4'>
        {/* Prominent Sign Up section */}
        {onSignup && (
          <div className='relative p-4 rounded-2xl bg-gradient-to-br from-secondary to-secondary/80 dark:from-primary-100 dark:to-primary-50 adventure:from-amber-50 adventure:to-orange-100 adventure:dark:from-amber-950/50 adventure:dark:to-orange-950/50 border border-primary-200 dark:border-primary-100 adventure:border-amber-200 adventure:dark:border-amber-800 overflow-hidden'>
            <div className='absolute inset-0 pointer-events-none'>
              <Sparkles className='absolute top-2 right-3 w-3 h-3 text-yellow-400 animate-pulse' style={{ animationDelay: '0s' }} />
              <Star className='absolute top-4 left-4 w-2 h-2 text-yellow-500 animate-pulse' style={{ animationDelay: '0.5s' }} />
              <Gem className='absolute bottom-3 right-4 w-2 h-2 text-yellow-400 animate-pulse' style={{ animationDelay: '1s' }} />
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
                <span className='adventure:hidden'>{t('login.joinGuild')}</span>
                <span className='hidden adventure:inline'>{t('login.joinGuildAdventure')}</span>
              </p>

              <Button
                onClick={onSignup}
                className='w-full rounded-full py-3 text-base font-semibold bg-primary hover:bg-primary/90 text-primary-foreground adventure:bg-gradient-to-r adventure:from-amber-700 adventure:to-orange-700 adventure:hover:from-amber-800 adventure:hover:to-orange-800 transform transition-all duration-200 hover:scale-105 shadow-lg border-0'
              >
                <Sparkles className='w-4 h-4 mr-2' />
                <span className='adventure:hidden'>{t('login.startAdventure')}</span>
                <span className='hidden adventure:inline'>{t('login.beginQuest')}</span>
              </Button>
            </div>
          </div>
        )}

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

        <div className='space-y-3'>
          {hasExtension && (
            <>
              <Button
                onClick={handleExtensionLogin}
                disabled={isLoading}
                className='w-full py-5 rounded-full'
              >
                <Shield className='w-4 h-4 mr-2' />
                {isLoading && !showConnectSection ? t('login.extension.loggingIn') : t('login.extension.button')}
              </Button>
              {errors.extension && (
                <p className='text-sm text-red-500 text-center' role='alert'>{errors.extension}</p>
              )}
            </>
          )}

          <Button
            variant='outline'
            onClick={() => {
              setShowConnectSection(!showConnectSection);
              if (!showConnectSection && !nostrConnectParams && !connectError) {
                generateConnectSession();
              }
            }}
            className='w-full rounded-full'
          >
            <ExternalLink className='w-4 h-4 mr-2' />
            {t('login.tab.connect')}
          </Button>

          {showConnectSection && (
            <div className='space-y-4 pt-2'>
              <div className='flex flex-col items-center space-y-4'>
                {connectError ? (
                  <div className='flex flex-col items-center space-y-3 py-4'>
                    <p className='text-sm text-red-500 text-center' role='alert'>{connectError}</p>
                    <Button variant='outline' onClick={handleRetry} className='rounded-full'>
                      {t('login.connect.retry')}
                    </Button>
                  </div>
                ) : nostrConnectUri ? (
                  <>
                    {!isMobile && (
                      <div className='p-4 bg-white rounded-2xl shadow-sm'>
                        <QRCodeCanvas value={nostrConnectUri} size={160} level='M' />
                      </div>
                    )}

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

                    {isMobile && (
                      <Button className='w-full gap-2 py-5 rounded-full' onClick={handleOpenSignerApp}>
                        <ExternalLink className='w-5 h-5' />
                        {t('login.connect.openSignerApp')}
                      </Button>
                    )}

                    <Button variant='outline' className='rounded-full' onClick={handleCopyUri}>
                      {copied ? (
                        <>
                          <Check className='w-4 h-4 mr-2' />
                          {t('login.connect.copied')}
                        </>
                      ) : (
                        <>
                          <Copy className='w-4 h-4 mr-2' />
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

              <Collapsible open={showBunkerInput} onOpenChange={setShowBunkerInput}>
                <CollapsibleTrigger className='w-full flex items-center justify-center gap-1 text-sm text-muted-foreground hover:text-foreground py-2'>
                  <span>{t('login.connect.manualBunker')}</span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${showBunkerInput ? 'rotate-180' : ''}`} />
                </CollapsibleTrigger>

                <CollapsibleContent className='space-y-3 pt-2'>
                  <Input
                    value={bunkerUri}
                    onChange={(e) => setBunkerUri(e.target.value)}
                    placeholder='bunker://'
                    className='rounded-xl text-sm'
                  />
                  {bunkerUri && !validateBunkerUri(bunkerUri) && (
                    <p className='text-red-500 text-xs'>{t('login.bunker.invalidFormat')}</p>
                  )}
                  <Button
                    className='w-full rounded-full'
                    variant='outline'
                    onClick={handleBunkerLogin}
                    disabled={isLoading || !bunkerUri.trim() || !validateBunkerUri(bunkerUri)}
                  >
                    {isLoading ? t('login.bunker.connecting') : t('login.bunker.button')}
                  </Button>
                </CollapsibleContent>
              </Collapsible>
            </div>
          )}

          {hasExtension ? (
            <Collapsible open={showKeySection} onOpenChange={setShowKeySection}>
              <CollapsibleTrigger className='w-full flex items-center justify-center gap-1 text-sm text-muted-foreground hover:text-foreground py-2'>
                <KeyRound className='w-4 h-4' />
                <span>{t('login.useSecretKey')}</span>
                <ChevronDown className={`w-4 h-4 transition-transform ${showKeySection ? 'rotate-180' : ''}`} />
              </CollapsibleTrigger>

              <CollapsibleContent className='space-y-3'>
                {keyInput}
              </CollapsibleContent>
            </Collapsible>
          ) : (
            <div className='space-y-3'>{keyInput}</div>
          )}
        </div>
      </div>
    </div>
  );
}

export default LoginFlow;
