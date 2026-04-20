// NOTE: This file is stable and usually should not be modified.
// It is important that all functionality in this file is preserved, and should only be modified if explicitly requested.

import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, Key, Compass, Sparkles, MapPin, Gem, Star, Crown, Map, Lock, Eye, EyeOff, Upload, Loader2, User, ScrollText, Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { BaseDialog } from '@/components/ui/base-dialog';
import { toast } from '@/hooks/useToast';
import { useLoginActions } from '@/hooks/useLoginActions';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useUploadFile } from '@/hooks/useUploadFile';
import { generateSecretKey, nip19 } from 'nostr-tools';
import { sanitizeFilename } from '@/utils/security';

interface SignupDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete?: () => void;
}

const SignupDialog: React.FC<SignupDialogProps> = ({ isOpen, onClose, onComplete }) => {
  const { t } = useTranslation();
  const [step, setStep] = useState<'welcome' | 'generate' | 'download' | 'profile' | 'done'>('welcome');
  const [isLoading, setIsLoading] = useState(false);
  const [nsec, setNsec] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [isSavingKey, setIsSavingKey] = useState(false);
  const [profileData, setProfileData] = useState({
    name: '',
    about: '',
    picture: ''
  });
  const login = useLoginActions();
  const { mutateAsync: publishEvent, isPending: isPublishing } = useNostrPublish();
  const { mutateAsync: uploadFile, isPending: isUploading } = useUploadFile();
  const avatarFileInputRef = useRef<HTMLInputElement>(null);

  // Generate a proper nsec key using nostr-tools
  const generateKey = () => {
    setIsLoading(true);

    // Meaningful pause -- the key is being forged
    setTimeout(() => {
      try {
        const sk = generateSecretKey();
        setNsec(nip19.nsecEncode(sk));
        setStep('download');
      } catch {
        toast({
          title: t('signup.toast.error.title'),
          description: t('signup.toast.error.generateFailed'),
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    }, 2000);
  };

  const saveKeyAndContinue = async () => {
    if (isSavingKey) return;
    setIsSavingKey(true);
    try {
      // Download the key file
      const blob = new Blob([nsec], { type: 'text/plain; charset=utf-8' });
      const url = globalThis.URL.createObjectURL(blob);
      const filename = sanitizeFilename('treasure-key.txt');
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      globalThis.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      // Log in and advance
      login.nsec(nsec);
      setStep('profile');
    } catch {
      toast({
        title: t('signup.toast.downloadFailed.title'),
        description: t('signup.toast.downloadFailed.description'),
        variant: 'destructive',
      });
    } finally {
      setIsSavingKey(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    if (!file.type.startsWith('image/')) {
      toast({
        title: t('signup.toast.invalidFileType.title'),
        description: t('signup.toast.invalidFileType.description'),
        variant: 'destructive',
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: t('signup.toast.fileTooLarge.title'),
        description: t('signup.toast.fileTooLarge.description'),
        variant: 'destructive',
      });
      return;
    }

    try {
      const tags = await uploadFile(file);
      const url = tags[0]?.[1];
      if (url) {
        setProfileData(prev => ({ ...prev, picture: url }));
      }
    } catch (error) {
      const errorObj = error as { message?: string };
      toast({
        title: t('signup.toast.uploadFailed.title'),
        description: errorObj.message || t('signup.toast.uploadFailed.description'),
        variant: 'destructive',
      });
    }
  };

  const finishSignup = async (skipProfile = false) => {
    localStorage.setItem('treasures_last_signup', Date.now().toString());

    try {
      if (!skipProfile && (profileData.name || profileData.about || profileData.picture)) {
        const metadata: Record<string, string> = {};
        if (profileData.name) metadata.name = profileData.name;
        if (profileData.about) metadata.about = profileData.about;
        if (profileData.picture) metadata.picture = profileData.picture;

        await publishEvent({
          kind: 0,
          content: JSON.stringify(metadata),
        });
      }

      onClose();
      if (onComplete) {
        setTimeout(() => onComplete(), 600);
      } else {
        setStep('done');
        setTimeout(() => onClose(), 3000);
      }
    } catch {
      // Still proceed even if profile publish failed
      onClose();
      if (onComplete) {
        setTimeout(() => onComplete(), 600);
      } else {
        setStep('done');
        setTimeout(() => onClose(), 3000);
      }
    }
  };

  const getTitle = () => {
    if (step === 'welcome') return (
      <span className="flex items-center justify-center gap-2">
        <Map className="w-5 h-5 text-primary adventure:text-amber-700" />
        {t('signup.dialog.welcome.title')}
      </span>
    );
    if (step === 'generate') return (
      <span className="flex items-center justify-center gap-2">
        <Sparkles className="w-5 h-5 text-purple-600 adventure:text-amber-700" />
        {t('signup.dialog.generate.title')}
      </span>
    );
    if (step === 'download') return (
      <span className="flex items-center justify-center gap-2">
        <Lock className="w-5 h-5 text-primary adventure:text-amber-700" />
        {t('signup.dialog.download.title')}
      </span>
    );
    if (step === 'profile') return (
      <span className="flex items-center justify-center gap-2">
        <Crown className="w-5 h-5 text-primary adventure:text-amber-700" />
        {t('signup.dialog.profile.title')}
      </span>
    );
    return (
      <span className="flex items-center justify-center gap-2">
        <Crown className="w-5 h-5 text-primary adventure:text-amber-700" />
        {t('signup.dialog.done.title')}
      </span>
    );
  };

  const getDescription = () => {
    if (step === 'welcome') return t('signup.dialog.welcome.description');
    if (step === 'generate') return t('signup.dialog.generate.description');
    if (step === 'download') return <>{t('signup.dialog.download.descriptionLine1')}<br />{t('signup.dialog.download.descriptionLine2')}</>;
    if (step === 'profile') return t('signup.dialog.profile.legendStarts');
    return t('signup.dialog.done.description');
  };

  // Reset state when dialog opens
  useEffect(() => {
    if (isOpen) {
      setStep('welcome');
      setIsLoading(false);
      setNsec('');
      setShowKey(false);
      setIsSavingKey(false);
      setProfileData({ name: '', about: '', picture: '' });
    }
  }, [isOpen]);

  return (
    <BaseDialog
      isOpen={isOpen}
      onOpenChange={onClose}
      size="auth"
      title={<span className='font-semibold text-center text-lg'>{getTitle()}</span>}
      description={<span className='text-muted-foreground text-center'>{getDescription()}</span>}
      headerClassName={`px-6 pt-6 pb-1 relative flex-shrink-0 ${step !== 'done' ? 'z-10' : ''}`}
      contentClassName={`flex flex-col max-h-[90vh] overflow-hidden ${
        step === 'welcome'
          ? 'bg-gradient-to-br from-secondary to-secondary/80 dark:from-primary-100 dark:to-primary-50 adventure:from-amber-50 adventure:to-orange-100 adventure:dark:from-amber-950/50 adventure:dark:to-orange-950/50'
          : step === 'generate'
            ? 'bg-gradient-to-br from-blue-50 to-purple-100 dark:from-blue-950/50 dark:to-purple-950/50 adventure:from-amber-50 adventure:to-yellow-100 adventure:dark:from-amber-950/50 adventure:dark:to-yellow-950/50'
          : step === 'download'
            ? 'bg-gradient-to-br from-amber-50/80 to-yellow-50/60 dark:from-amber-950/30 dark:to-yellow-950/20 adventure:from-amber-50 adventure:to-orange-50 adventure:dark:from-amber-950/40 adventure:dark:to-orange-950/30'
          : step === 'profile'
            ? 'bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-blue-950/50 dark:to-indigo-950/50 adventure:from-amber-50 adventure:to-yellow-100 adventure:dark:from-amber-950/50 adventure:dark:to-yellow-950/50'
            : ''
      }`}
    >
      {/* Watermark logo -- welcome step only */}
      {step === 'welcome' && (
        <img
          src="/icon.svg"
          alt=""
          className='absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 pointer-events-none opacity-[0.04]'
        />
      )}

      <div className={`px-6 pt-2 pb-5 space-y-4 overflow-y-auto overflow-x-hidden flex-1 ${step !== 'done' ? 'relative z-10' : ''}`}>

        {/* ── Welcome ── */}
        {step === 'welcome' && (
          <div className='text-center space-y-4'>
            {/* Glowing sparkles across the modal */}
            <div className='absolute inset-0 pointer-events-none overflow-hidden'>
              <Sparkles className='absolute top-12 right-6 w-3 h-3 text-yellow-400' style={{ animation: 'signup-mote-twinkle 3s ease-in-out 0s infinite' }} />
              <Star className='absolute top-16 left-8 w-2.5 h-2.5 text-yellow-500' style={{ animation: 'signup-mote-twinkle 2.8s ease-in-out 0.5s infinite' }} />
              <Sparkles className='absolute bottom-20 right-8 w-3 h-3 text-yellow-400' style={{ animation: 'signup-mote-twinkle 3.2s ease-in-out 1s infinite' }} />
              <Star className='absolute bottom-24 left-6 w-2.5 h-2.5 text-yellow-500' style={{ animation: 'signup-mote-twinkle 2.6s ease-in-out 1.5s infinite' }} />
              <Sparkles className='absolute top-1/2 left-4 w-2 h-2 text-yellow-400/60' style={{ animation: 'signup-mote-twinkle 3.5s ease-in-out 2s infinite' }} />
              <Star className='absolute top-1/3 right-4 w-2 h-2 text-yellow-500/60' style={{ animation: 'signup-mote-twinkle 3s ease-in-out 0.8s infinite' }} />
            </div>

            {/* Animated icons */}
            <div className='flex justify-center items-center space-x-4 py-4'>
              <div className='relative'>
                <MapPin className='w-12 h-12 text-primary adventure:text-amber-700 animate-bounce' />
                <Sparkles className='w-4 h-4 text-yellow-500 absolute -top-1 -right-1' style={{ animation: 'signup-mote-twinkle 2.5s ease-in-out 0.2s infinite' }} />
              </div>
                <Compass className='w-24 h-24 -mt-5 text-primary adventure:text-amber-800 animate-spin-slow' />
              <div className='relative'>
                <Gem className='w-12 h-12 text-primary adventure:text-amber-700 animate-bounce' style={{ animationDelay: '0.5s' }} />
                <Star className='w-4 h-4 text-yellow-500 absolute -top-1 -left-1' style={{ animation: 'signup-mote-twinkle 2.8s ease-in-out 0.3s infinite' }} />
              </div>
            </div>

            <p className='text-sm text-muted-foreground px-5 whitespace-pre-line'>
              {t('signup.dialog.welcome.joinText')}
            </p>

            <Button
              className='w-full rounded-full py-6 text-lg font-semibold shadow-lg'
              onClick={() => setStep('generate')}
            >
              <Compass className='w-5 h-5 mr-2' />
              {t('signup.dialog.welcome.beginQuest')}
            </Button>
          </div>
        )}

        {/* ── Forge ── */}
        {step === 'generate' && (
          <div className='text-center space-y-4'>
            {/* Sparkles across the modal */}
            <div className='absolute inset-0 pointer-events-none overflow-hidden'>
              {isLoading ? (
                /* During forging: more sparkles, pinging */
                Array.from({ length: 10 }).map((_, i) => (
                  <Sparkles
                    key={i}
                    className='absolute w-4 h-4 text-yellow-400'
                    style={{
                      left: `${12 + ((i * 31 + 17) % 76)}%`,
                      top: `${10 + ((i * 23 + 11) % 70)}%`,
                      animation: `signup-mote-twinkle ${2 + (i % 3) * 0.6}s ease-in-out ${(i * 0.3) % 2}s infinite`,
                    }}
                  />
                ))
              ) : (
                /* Before forging: gentle sparkles */
                <>
                  <Sparkles className='absolute top-14 right-6 w-3 h-3 text-yellow-400' style={{ animation: 'signup-mote-twinkle 3s ease-in-out 0s infinite' }} />
                  <Star className='absolute top-20 left-6 w-2.5 h-2.5 text-yellow-500' style={{ animation: 'signup-mote-twinkle 2.8s ease-in-out 0.6s infinite' }} />
                  <Sparkles className='absolute bottom-20 right-8 w-3 h-3 text-yellow-400' style={{ animation: 'signup-mote-twinkle 3.2s ease-in-out 1.2s infinite' }} />
                  <Star className='absolute bottom-28 left-8 w-2.5 h-2.5 text-yellow-500' style={{ animation: 'signup-mote-twinkle 2.6s ease-in-out 1.8s infinite' }} />
                </>
              )}
            </div>

            {/* Key icon with spinning ring and glow */}
            <div className='flex justify-center py-4'>
              <div className='relative'>
                {/* Warm glow behind key */}
                <div
                  className={`absolute w-40 h-40 rounded-full pointer-events-none transition-opacity duration-700 ${isLoading ? 'opacity-100' : 'opacity-50'}`}
                  style={{
                    left: '50%',
                    top: '50%',
                    marginLeft: -80,
                    marginTop: -80,
                    background: 'radial-gradient(circle, rgba(168,85,247,0.25) 0%, rgba(59,130,246,0.10) 50%, transparent 70%)',
                    animation: isLoading ? 'signup-forge-glow 2s ease-in-out infinite' : 'none',
                  }}
                />
                <Key
                  className={`relative w-28 h-28 mx-auto transition-all duration-700 ${isLoading ? 'animate-pulse' : ''}`}
                  style={{
                    color: 'rgb(126,87,194)',
                    filter: `drop-shadow(0 0 ${isLoading ? '20px' : '12px'} rgba(168,85,247,0.4))`,
                  }}
                />
                {isLoading && (
                  <div
                    className='absolute w-36 h-36 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin'
                    style={{
                      left: '50%',
                      top: '50%',
                      marginLeft: -72,
                      marginTop: -72,
                    }}
                  />
                )}
              </div>
            </div>

            {isLoading ? (
              <div className='space-y-2 pt-4'>
                <p className='text-lg font-semibold text-primary flex items-center justify-center gap-2'>
                  <Sparkles className='w-5 h-5' />
                  {t('signup.dialog.generate.forging')}
                </p>
                <p className='text-sm text-muted-foreground'>
                  {t('signup.dialog.generate.weaving')}
                </p>
              </div>
            ) : (
              <div className='space-y-2 px-4 pt-4'>
                <p className='text-sm text-muted-foreground'>
                  {t('signup.dialog.generate.passport')}
                </p>
              </div>
            )}

            {!isLoading && (
              <Button
                className='w-full rounded-full py-6 text-lg font-semibold bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 adventure:from-amber-700 adventure:to-yellow-700 adventure:hover:from-amber-800 adventure:hover:to-yellow-800 text-white shadow-lg'
                onClick={generateKey}
              >
                <Sparkles className='w-5 h-5 mr-2' />
                {t('signup.dialog.generate.forgeButton')}
              </Button>
            )}
          </div>
        )}

        {/* ── Secure ── */}
        {step === 'download' && (
          <div className='space-y-5'>
            {/* Rays, glow, sparkles -- all absolute, clipped to modal */}
            <div className='absolute inset-0 pointer-events-none overflow-hidden'>
              {/* Rotating light rays -- centered roughly behind key position */}
              <div
                aria-hidden='true'
                style={{
                  position: 'absolute',
                  width: 500,
                  height: 500,
                  left: '50%',
                  top: '33%',
                  marginLeft: -250,
                  marginTop: -250,
                }}
              >
                <div
                  className='w-full h-full'
                  style={{
                    background: `repeating-conic-gradient(
                      rgba(255,215,0,0.10) 0deg 12deg,
                      transparent 12deg 40deg
                    )`,
                    maskImage: 'radial-gradient(circle, black 8%, transparent 60%)',
                    WebkitMaskImage: 'radial-gradient(circle, black 8%, transparent 60%)',
                    animation: 'signup-key-spin 16s linear infinite',
                  }}
                />
              </div>

              {/* Warm radial glow */}
              <div
                style={{
                  position: 'absolute',
                  width: 200,
                  height: 200,
                  left: '50%',
                  top: '33%',
                  marginLeft: -100,
                  marginTop: -100,
                  background: 'radial-gradient(circle, rgba(255,215,0,0.22) 0%, rgba(255,200,50,0.06) 50%, transparent 70%)',
                }}
              />

              {/* Sparkles */}
              <Sparkles className='absolute top-10 right-4 w-3 h-3 text-yellow-400/60' style={{ animation: 'signup-mote-twinkle 3.5s ease-in-out 0s infinite' }} />
              <Star className='absolute top-20 left-3 w-2.5 h-2.5 text-yellow-500/50' style={{ animation: 'signup-mote-twinkle 4s ease-in-out 1s infinite' }} />
              <Sparkles className='absolute bottom-16 right-3 w-3 h-3 text-yellow-400/50' style={{ animation: 'signup-mote-twinkle 3.8s ease-in-out 1.8s infinite' }} />
              <Star className='absolute bottom-10 left-4 w-2.5 h-2.5 text-yellow-500/60' style={{ animation: 'signup-mote-twinkle 3.2s ease-in-out 0.6s infinite' }} />
              <Sparkles className='absolute top-1/3 right-2 w-2 h-2 text-yellow-400/40' style={{ animation: 'signup-mote-twinkle 3s ease-in-out 2.2s infinite' }} />
              <Star className='absolute top-1/2 left-2 w-2 h-2 text-yellow-500/40' style={{ animation: 'signup-mote-twinkle 3.4s ease-in-out 0.3s infinite' }} />
            </div>

            {/* The key -- in flow, front and center */}
            <div className='flex justify-center py-4'>
              <div className='relative w-32 h-32'>
                <Key
                  className='relative w-full h-full'
                  style={{
                    color: 'rgb(225,185,45)',
                    filter: 'drop-shadow(0 0 20px rgba(240,200,60,0.40)) drop-shadow(0 2px 6px rgba(200,160,30,0.25))',
                  }}
                />
                {/* Sheen */}
                <div className='absolute inset-0 pointer-events-none signup-key-sheen'>
                  <Key
                    className='w-full h-full'
                    style={{ color: 'rgb(255,240,150)' }}
                  />
                </div>
              </div>
            </div>

            {/* Key display -- masked by default */}
            <div className='relative'>
              <Input
                type={showKey ? 'text' : 'password'}
                value={nsec}
                readOnly
                onFocus={(e) => e.currentTarget.select()}
                onClick={(e) => e.currentTarget.select()}
                className='pr-10 font-mono text-xs'
              />
              <button
                type='button'
                onClick={() => setShowKey(!showKey)}
                className='absolute right-0 top-0 h-full px-3 hover:bg-transparent text-muted-foreground'
              >
                {showKey ? <EyeOff className='w-4 h-4' /> : <Eye className='w-4 h-4' />}
              </button>
            </div>

            {/* Warning -- warm, not alarming */}
            <div className='p-3 rounded-xl bg-accent/50 dark:bg-accent/30 border border-accent'>
              <p className='text-xs text-accent-foreground text-center'>
                {t('signup.dialog.download.warningText')}
              </p>
            </div>

            {/* Single gated button: save + login + advance */}
            <Button
              className='w-full rounded-full py-6 text-lg font-semibold bg-gradient-to-r from-amber-600 to-yellow-500 hover:from-amber-700 hover:to-yellow-600 adventure:from-amber-700 adventure:to-orange-600 adventure:hover:from-amber-800 adventure:hover:to-orange-700 text-white shadow-lg'
              onClick={saveKeyAndContinue}
              disabled={isSavingKey}
            >
              {isSavingKey ? (
                <>
                  <Loader2 className='w-5 h-5 mr-2 animate-spin' />
                  {t('signup.dialog.download.saving')}
                </>
              ) : (
                <>
                  <Key className='w-5 h-5 mr-2' />
                  {t('signup.dialog.download.saveAndContinue')}
                </>
              )}
            </Button>
          </div>
        )}

        {/* ── Profile ── */}
        {step === 'profile' && (
          <div className='space-y-3'>
            {/* Sparkles across the modal */}
            <div className='absolute inset-0 pointer-events-none overflow-hidden'>
              <Sparkles className='absolute top-12 right-6 w-3 h-3 text-yellow-400/50' style={{ animation: 'signup-mote-twinkle 3s ease-in-out 0s infinite' }} />
              <Star className='absolute top-16 left-6 w-2.5 h-2.5 text-yellow-500/40' style={{ animation: 'signup-mote-twinkle 3.4s ease-in-out 0.7s infinite' }} />
              <Sparkles className='absolute bottom-20 right-5 w-2.5 h-2.5 text-yellow-400/40' style={{ animation: 'signup-mote-twinkle 3.2s ease-in-out 1.4s infinite' }} />
              <Star className='absolute bottom-12 left-5 w-2 h-2 text-yellow-500/50' style={{ animation: 'signup-mote-twinkle 2.8s ease-in-out 0.3s infinite' }} />
            </div>

            {/* Crown -- large, glowing, like the forge key */}
            <div className='flex justify-center py-2'>
              <div className='relative'>
                {/* Glow behind crown */}
                <div
                  className='absolute pointer-events-none'
                  style={{
                    width: 160,
                    height: 160,
                    left: '50%',
                    top: '50%',
                    marginLeft: -80,
                    marginTop: -80,
                    background: 'radial-gradient(circle, rgba(99,102,241,0.18) 0%, rgba(99,102,241,0.05) 50%, transparent 70%)',
                  }}
                />
                <Crown
                  className='relative w-20 h-20'
                  style={{
                    color: 'rgb(99,102,241)',
                    filter: 'drop-shadow(0 0 16px rgba(99,102,241,0.35)) drop-shadow(0 2px 6px rgba(79,70,229,0.20))',
                  }}
                />
                <div className='absolute -top-1 -right-1 w-6 h-6 bg-blue-500 adventure:bg-amber-500 rounded-full flex items-center justify-center animate-bounce'>
                  <Sparkles className='w-3.5 h-3.5 text-white' />
                </div>
              </div>
            </div>

            <p className='text-sm text-muted-foreground text-center'>
              {t('signup.dialog.profile.legendStarts')}
            </p>

            {/* Profile form */}
            <div className={`space-y-3 text-left ${isPublishing ? 'opacity-50 pointer-events-none' : ''}`}>
              <div className='space-y-1.5'>
                <label htmlFor='profile-name' className='text-sm font-medium flex items-center gap-1.5'>
                  <User className='w-3.5 h-3.5 text-muted-foreground' />
                  {t('signup.dialog.profile.displayName')}
                </label>
                <Input
                  id='profile-name'
                  value={profileData.name}
                  onChange={(e) => setProfileData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder={t('signup.dialog.profile.displayNamePlaceholder')}
                  className='rounded-lg'
                  disabled={isPublishing}
                />
              </div>

              <div className='space-y-1.5'>
                <label htmlFor='profile-about' className='text-sm font-medium flex items-center gap-1.5'>
                  <ScrollText className='w-3.5 h-3.5 text-muted-foreground' />
                  {t('signup.dialog.profile.bio')}
                </label>
                <Input
                  id='profile-about'
                  value={profileData.about}
                  onChange={(e) => setProfileData(prev => ({ ...prev, about: e.target.value }))}
                  placeholder={t('signup.dialog.profile.bioPlaceholder')}
                  className='rounded-lg'
                  disabled={isPublishing}
                />
              </div>

              <div className='space-y-1.5'>
                <label htmlFor='profile-picture' className='text-sm font-medium flex items-center gap-1.5'>
                  <Camera className='w-3.5 h-3.5 text-muted-foreground' />
                  {t('signup.dialog.profile.avatar')}
                </label>
                <div className='flex gap-2'>
                  <Input
                    id='profile-picture'
                    value={profileData.picture}
                    onChange={(e) => setProfileData(prev => ({ ...prev, picture: e.target.value }))}
                    placeholder={t('signup.dialog.profile.avatarPlaceholder')}
                    className='rounded-lg flex-1'
                    disabled={isPublishing}
                  />
                  <input
                    type='file'
                    accept='image/*'
                    className='hidden'
                    ref={avatarFileInputRef}
                    onChange={handleAvatarUpload}
                  />
                  <Button
                    type='button'
                    variant='outline'
                    size='icon'
                    onClick={() => avatarFileInputRef.current?.click()}
                    disabled={isUploading || isPublishing}
                    className='rounded-lg shrink-0'
                    title={isUploading ? t('form.uploading') : t('signup.dialog.profile.uploadTitle')}
                  >
                    {isUploading ? (
                      <Loader2 className='w-4 h-4 animate-spin' />
                    ) : (
                      <Upload className='w-4 h-4' />
                    )}
                  </Button>
                </div>
              </div>
            </div>

            {/* Single CTA -- auto-skips profile if all fields empty */}
            <Button
              className='w-full rounded-full py-6 text-lg font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 adventure:from-amber-700 adventure:to-yellow-700 adventure:hover:from-amber-800 adventure:hover:to-yellow-800 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed text-white'
              onClick={() => {
                const hasProfile = profileData.name || profileData.about || profileData.picture;
                finishSignup(!hasProfile);
              }}
              disabled={isPublishing || isUploading}
            >
              {isPublishing ? (
                <>
                  <div className='w-5 h-5 mr-2 border-2 border-current border-t-transparent rounded-full animate-spin' />
                  {t('signup.dialog.profile.creating')}
                </>
              ) : (
                <>
                  <Compass className='w-5 h-5 mr-2' />
                  {t('signup.dialog.welcome.beginQuest')}
                </>
              )}
            </Button>
          </div>
        )}
      </div>
    </BaseDialog>
  );
};

export default SignupDialog;
