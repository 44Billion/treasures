// NOTE: This file is stable and usually should not be modified.
// It is important that all functionality in this file is preserved, and should only be modified if explicitly requested.

import { useState, useEffect, useRef } from 'react';
import { Download, Key, Compass, Scroll, Shield, Crown, Sparkles, MapPin, Gem, Map, Star, Zap, Lock, CheckCircle, Copy, Upload, Loader2 } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Textarea } from '@/shared/components/ui/textarea';
import { BaseDialog } from '@/shared/components/ui/base-dialog';
import { Card, CardContent } from '@/shared/components/ui/card';
import { toast } from '@/shared/hooks/useToast';
import { useLoginActions } from '../hooks/useLoginActions';
import { useNostrPublish } from '@/shared/hooks/useNostrPublish';
import { useUploadFile } from '@/shared/hooks/useUploadFile';
import { generateSecretKey, nip19 } from 'nostr-tools';
import { sanitizeFilename } from '@/shared/utils/security';

interface SignupDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete?: () => void;
}

const SignupDialog: React.FC<SignupDialogProps> = ({ isOpen, onClose, onComplete }) => {
  const [step, setStep] = useState<'welcome' | 'generate' | 'download' | 'profile' | 'done'>('welcome');
  const [isLoading, setIsLoading] = useState(false);
  const [nsec, setNsec] = useState('');
  const [showSparkles, setShowSparkles] = useState(false);
  const [keySecured, setKeySecured] = useState<'none' | 'copied' | 'downloaded'>('none');
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
    setShowSparkles(true);

    // Add a dramatic pause for the treasure generation effect
    setTimeout(() => {
      try {
        // Generate a new secret key
        const sk = generateSecretKey();

        // Convert to nsec format
        setNsec(nip19.nsecEncode(sk));
        setStep('download');

        toast({
          title: 'Your Treasure Key is Ready!',
          description: 'A magical key has been forged just for you.',
        });
      } catch (error) {
        toast({
          title: 'Error',
          description: 'Failed to generate key. Please try again.',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
        setShowSparkles(false);
      }
    }, 2000);
  };

  const downloadKey = () => {
    try {
      // Create a blob with the key text
      const blob = new Blob([nsec], { type: 'text/plain; charset=utf-8' });
      const url = globalThis.URL.createObjectURL(blob);

      // Sanitize filename
      const filename = sanitizeFilename('treasure-key.txt');

      // Create a temporary link element and trigger download
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();

      // Clean up immediately
      globalThis.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      // Mark as secured
      setKeySecured('downloaded');

      toast({
        title: 'Treasure Key Secured!',
        description: 'Your key has been safely stored in your vault. Guard it well!',
      });
    } catch (error) {
      toast({
        title: 'Download failed',
        description: 'Could not download the key file. Please copy it manually.',
        variant: 'destructive',
      });
    }
  };

  const copyKey = () => {
    navigator.clipboard.writeText(nsec);
    setKeySecured('copied');
    toast({
      title: 'Copied to your spellbook!',
      description: 'Key safely transcribed to clipboard',
    });
  };

  const finishKeySetup = () => {
    try {
      login.nsec(nsec);
      setStep('profile');
    } catch (error) {
      toast({
        title: 'Login Failed',
        description: 'Failed to login with the generated key. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset file input
    e.target.value = '';

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Invalid file type',
        description: 'Please select an image file for your avatar.',
        variant: 'destructive',
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: 'File too large',
        description: 'Avatar image must be smaller than 5MB.',
        variant: 'destructive',
      });
      return;
    }

    // Show uploading toast
    toast({
      title: 'Uploading avatar...',
      description: `Uploading ${file.name}...`,
    });

    try {
      const tags = await uploadFile(file);
      // Get the URL from the first tag
      const url = tags[0]?.[1];
      if (url) {
        setProfileData(prev => ({ ...prev, picture: url }));
        toast({
          title: 'Success!',
          description: 'Your avatar has been uploaded successfully.',
        });
      }
    } catch (error) {
      const errorObj = error as { message?: string };
      toast({
        title: 'Upload failed',
        description: errorObj.message || 'Failed to upload avatar. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const finishSignup = async (skipProfile = false) => {
    // Mark signup completion time for fallback welcome modal
    localStorage.setItem('treasures_last_signup', Date.now().toString());

    try {
      // Publish profile if user provided information
      if (!skipProfile && (profileData.name || profileData.about || profileData.picture)) {
        const metadata: Record<string, string> = {};
        if (profileData.name) metadata.name = profileData.name;
        if (profileData.about) metadata.about = profileData.about;
        if (profileData.picture) metadata.picture = profileData.picture;

        await publishEvent({
          kind: 0,
          content: JSON.stringify(metadata),
        });

        toast({
          title: 'Profile Created!',
          description: 'Your adventurer profile has been set up.',
        });
      }

      // Close signup and show welcome modal
      onClose();
      if (onComplete) {
        // Add a longer delay to ensure login state has fully propagated
        setTimeout(() => {
          onComplete();
        }, 600);
      } else {
        // Fallback for when used without onComplete
        setStep('done');
        setTimeout(() => {
          onClose();
          toast({
            title: 'Welcome to the Adventure!',
            description: 'Your quest begins now!',
          });
        }, 3000);
      }
    } catch (error) {
      toast({
        title: 'Profile Setup Failed',
        description: 'Your account was created but profile setup failed. You can update it later.',
        variant: 'destructive',
      });

      // Still proceed to completion even if profile failed
      onClose();
      if (onComplete) {
        // Add a longer delay to ensure login state has fully propagated
        setTimeout(() => {
          onComplete();
        }, 600);
      } else {
        // Fallback for when used without onComplete
        setStep('done');
        setTimeout(() => {
          onClose();
          toast({
            title: 'Welcome to the Adventure!',
            description: 'Your quest begins now!',
          });
        }, 3000);
      }
    }
  };

  const getTitle = () => {
    if (step === 'welcome') return (
      <span className="flex items-center justify-center gap-2">
        <Map className="w-5 h-5 text-green-600 adventure:text-amber-700" />
        Begin Your Quest
      </span>
    );
    if (step === 'generate') return (
      <span className="flex items-center justify-center gap-2">
        <Sparkles className="w-5 h-5 text-purple-600 adventure:text-amber-700" />
        Forging Your Key
      </span>
    );
    if (step === 'download') return (
      <span className="flex items-center justify-center gap-2">
        <Lock className="w-5 h-5 text-green-600 adventure:text-amber-700" />
        Secure Your Treasure Key
      </span>
    );
    if (step === 'profile') return (
      <span className="flex items-center justify-center gap-2">
        <Crown className="w-5 h-5 text-green-600 adventure:text-amber-700" />
        Create Your Profile
      </span>
    );
    return (
      <span className="flex items-center justify-center gap-2">
        <Crown className="w-5 h-5 text-green-600 adventure:text-amber-700" />
        Welcome, Adventurer!
      </span>
    );
  };

  const getDescription = () => {
    if (step === 'welcome') return (
      <div className="text-center">
        Ready to discover hidden geocaches around the world?
      </div>
    );
    if (step === 'generate') return (
      <div className="text-center">
        Creating your magical key to unlock Treasures
      </div>
    );
    if (step === 'download') return (
      <div className="text-center">
        This key is your passport to adventure - keep it safe!
      </div>
    );
    if (step === 'profile') return (
      <div className="text-center">
        Tell other adventurers about yourself
      </div>
    );
    return (
      <div className="text-center">
        Your adventure begins now!
      </div>
    );
  };

  // Reset state when dialog opens
  useEffect(() => {
    if (isOpen) {
      setStep('welcome');
      setIsLoading(false);
      setNsec('');
      setShowSparkles(false);
      setKeySecured('none');
      setProfileData({ name: '', about: '', picture: '' });
    }
  }, [isOpen]);

  // Add sparkle animation effect
  useEffect(() => {
    if (showSparkles) {
      const interval = setInterval(() => {
        // This will trigger re-renders for sparkle animation
      }, 100);
      return () => clearInterval(interval);
    }
    return undefined;
  }, [showSparkles]);

  return (
    <BaseDialog
      isOpen={isOpen}
      onOpenChange={onClose}
      size="auth"
      title={<span className='font-semibold text-center text-lg'>{getTitle()}</span>}
      description={<span className='text-muted-foreground'>{getDescription()}</span>}
      headerClassName='px-6 pt-6 pb-1 relative flex-shrink-0'
      contentClassName='flex flex-col max-h-[90vh]'
    >
      <div className='px-6 pt-2 pb-4 space-y-4 overflow-y-auto flex-1'>
        {/* Welcome Step - New engaging introduction */}
        {step === 'welcome' && (
          <div className='text-center space-y-4'>
            {/* Hero illustration */}
            <div className='relative p-6 rounded-2xl bg-gradient-to-br from-green-50 to-emerald-100 dark:from-green-950/50 dark:to-emerald-950/50 adventure:from-amber-50 adventure:to-orange-100 adventure:dark:from-amber-950/50 adventure:dark:to-orange-950/50'>
              <div className='flex justify-center items-center space-x-4 mb-3'>
                <div className='relative'>
                  <MapPin className='w-12 h-12 text-green-600 adventure:text-amber-700 animate-bounce' />
                  <Sparkles className='w-4 h-4 text-yellow-500 absolute -top-1 -right-1 animate-pulse' />
                </div>
                <Compass className='w-16 h-16 text-green-700 adventure:text-amber-800 animate-spin-slow' />
                <div className='relative'>
                  <Gem className='w-12 h-12 text-green-600 adventure:text-amber-700 animate-bounce' style={{animationDelay: '0.5s'}} />
                  <Star className='w-4 h-4 text-yellow-500 absolute -top-1 -left-1 animate-pulse' style={{animationDelay: '0.3s'}} />
                </div>
              </div>

              {/* Adventure benefits */}
              <div className='grid grid-cols-1 gap-2 text-sm'>
                <div className='flex items-center justify-center gap-2 text-green-700 dark:text-green-300 adventure:text-amber-800 adventure:dark:text-amber-200'>
                  <Shield className='w-4 h-4' />
                  Embark on legendary quests worldwide
                </div>
                <div className='flex items-center justify-center gap-2 text-green-700 dark:text-green-300 adventure:text-amber-800 adventure:dark:text-amber-200'>
                  <Crown className='w-4 h-4' />
                  Hide your own geocaches
                </div>
                <div className='flex items-center justify-center gap-2 text-green-700 dark:text-green-300 adventure:text-amber-800 adventure:dark:text-amber-200'>
                  <Map className='w-4 h-4' />
                  Unite with fellow adventurers
                </div>
              </div>
            </div>

            <div className='space-y-3'>
              <p className='text-muted-foreground px-5'>
                Join adventurers exploring the world through geocaching.
                Your quest begins with forging your very own treasure key.
              </p>

              <Button
                className='w-full rounded-full py-6 text-lg font-semibold bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 adventure:from-amber-700 adventure:to-orange-700 adventure:hover:from-amber-800 adventure:hover:to-orange-800 transform transition-all duration-200 hover:scale-105 shadow-lg'
                onClick={() => setStep('generate')}
              >
                <Zap className='w-5 h-5 mr-2' />
                Begin My Quest!
              </Button>

              <p className='text-xs text-muted-foreground'>
                Free forever • Decentralized • Your data, your control
              </p>
            </div>
          </div>
        )}

        {/* Generate Step - Enhanced with animations */}
        {step === 'generate' && (
          <div className='text-center space-y-4'>
            <div className='relative p-6 rounded-2xl bg-gradient-to-br from-blue-50 to-purple-100 dark:from-blue-950/50 dark:to-purple-950/50 adventure:from-amber-50 adventure:to-yellow-100 adventure:dark:from-amber-950/50 adventure:dark:to-yellow-950/50 overflow-hidden'>
              {/* Animated background elements */}
              {showSparkles && (
                <div className='absolute inset-0'>
                  {[...Array(12)].map((_, i) => (
                    <Sparkles
                      key={i}
                      className={`absolute w-4 h-4 text-yellow-400 animate-ping`}
                      style={{
                        left: `${Math.random() * 80 + 10}%`,
                        top: `${Math.random() * 80 + 10}%`,
                        animationDelay: `${Math.random() * 2}s`
                      }}
                    />
                  ))}
                </div>
              )}

              <div className='relative z-10'>
                {isLoading ? (
                  <div className='space-y-3'>
                    <div className='relative'>
                      <Key className='w-20 h-20 text-primary mx-auto animate-pulse' />
                      <div className='absolute inset-0 flex items-center justify-center'>
                        <div className='w-24 h-24 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin'></div>
                      </div>
                    </div>
                    <div className='space-y-2'>
                      <p className='text-lg font-semibold text-primary flex items-center justify-center gap-2'>
                        <Sparkles className='w-5 h-5' />
                        Forging your magical key...
                      </p>
                      <p className='text-sm text-muted-foreground'>
                        Weaving cryptographic spells
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className='space-y-3'>
                    <Key className='w-20 h-20 text-primary mx-auto' />
                    <div className='space-y-2'>
                      <p className='text-lg font-semibold'>
                        Ready to forge your treasure key?
                      </p>
                      <p className='text-sm text-muted-foreground px-5'>
                        This magical key will be your passport to the world of Treasures.
                      </p>
                      <p className='text-sm text-muted-foreground px-5'>
                        It's completely unique and secure - keep it secret, keep it safe!
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {!isLoading && (
              <Button
                className='w-full rounded-full py-6 text-lg font-semibold bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 adventure:from-amber-700 adventure:to-yellow-700 adventure:hover:from-amber-800 adventure:hover:to-yellow-800 transform transition-all duration-200 hover:scale-105 shadow-lg'
                onClick={generateKey}
                disabled={isLoading}
              >
                <Sparkles className='w-5 h-5 mr-2' />
                Forge My Treasure Key!
              </Button>
            )}
          </div>
        )}

        {/* Download Step - Whimsical and magical */}
        {step === 'download' && (
          <div className='text-center space-y-4'>
            {/* Magical treasure chest reveal */}
            <div className='relative p-6 rounded-2xl bg-gradient-to-br from-green-50 to-emerald-100 dark:from-green-950/50 dark:to-emerald-950/50 adventure:from-amber-50 adventure:to-orange-100 adventure:dark:from-amber-950/50 adventure:dark:to-orange-950/50 overflow-hidden'>
              {/* Magical sparkles floating around */}
              <div className='absolute inset-0 pointer-events-none'>
                <Sparkles className='absolute top-3 left-4 w-3 h-3 text-yellow-400 animate-pulse' style={{animationDelay: '0s'}} />
                <Star className='absolute top-6 right-6 w-3 h-3 text-yellow-500 animate-pulse' style={{animationDelay: '0.5s'}} />
                <Sparkles className='absolute bottom-4 left-6 w-3 h-3 text-yellow-400 animate-pulse' style={{animationDelay: '1s'}} />
                <Star className='absolute bottom-3 right-4 w-3 h-3 text-yellow-500 animate-pulse' style={{animationDelay: '1.5s'}} />
              </div>

              <div className='relative z-10 flex justify-center items-center mb-3'>
                <div className='relative'>
                  <div className='w-16 h-16 bg-gradient-to-br from-yellow-200 to-amber-300 adventure:from-amber-200 adventure:to-orange-300 rounded-full flex items-center justify-center shadow-lg animate-pulse'>
                    <Key className='w-8 h-8 text-amber-800 adventure:text-orange-900' />
                  </div>
                  <div className='absolute -top-1 -right-1 w-5 h-5 bg-green-500 adventure:bg-emerald-600 rounded-full flex items-center justify-center animate-bounce'>
                    <Sparkles className='w-3 h-3 text-white' />
                  </div>
                </div>
              </div>

              <div className='relative z-10 space-y-2'>
                <p className='text-base font-semibold'>
                  Behold! Your magical treasure key!
                </p>

                {/* Whimsical warning with scroll design */}
                <div className='relative mx-auto max-w-sm'>
                  <div className='p-3 bg-gradient-to-r from-amber-100 via-yellow-50 to-amber-100 dark:from-amber-950/40 dark:via-yellow-950/20 dark:to-amber-950/40 adventure:from-orange-100 adventure:via-amber-50 adventure:to-orange-100 adventure:dark:from-orange-950/40 adventure:dark:via-amber-950/20 adventure:dark:to-orange-950/40 rounded-lg border-2 border-amber-300 dark:border-amber-700 adventure:border-orange-400 adventure:dark:border-orange-600 shadow-md'>
                    <div className='flex items-center gap-2 mb-1'>
                      <Scroll className='w-3 h-3 text-amber-700 adventure:text-orange-800' />
                      <span className='text-xs font-bold text-amber-800 dark:text-amber-200 adventure:text-orange-900 adventure:dark:text-orange-200'>
                        Ancient Warning
                      </span>
                    </div>
                    <p className='text-xs text-amber-700 dark:text-amber-300 adventure:text-orange-800 adventure:dark:text-orange-300 italic'>
"Guard this key with your life, for once lost to the digital winds, it shall never return..."
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Enchanted key vault */}
            <div className='relative p-3 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 adventure:from-amber-100 adventure:to-yellow-200 adventure:dark:from-amber-900 adventure:to-yellow-900 rounded-xl border-2 border-dashed border-amber-400 dark:border-amber-600 adventure:border-orange-500 adventure:dark:border-orange-400 shadow-inner'>
              <div className='flex items-center gap-2 mb-2'>
                <Lock className='w-4 h-4 text-amber-600 adventure:text-orange-700' />
                <span className='text-sm font-medium text-amber-800 dark:text-amber-200 adventure:text-orange-800 adventure:dark:text-orange-200'>
                  Your Treasure Key
                </span>
              </div>
              <div className='p-2 bg-background/90 rounded-lg border border-amber-300 dark:border-amber-700 adventure:border-orange-400 adventure:dark:border-orange-600'>
                <code className='text-xs break-all font-mono text-amber-900 dark:text-amber-100 adventure:text-orange-900 adventure:dark:text-orange-100'>{nsec}</code>
              </div>
            </div>

            {/* Security options - clearly presented as choices */}
            <div className='space-y-3'>
              <div className='text-center'>
                <p className='text-sm font-medium text-muted-foreground mb-2'>
                  Choose how to secure your key:
                </p>
              </div>

              <div className='grid grid-cols-1 gap-2'>
                {/* Copy Option */}
                <Card className={`cursor-pointer transition-all duration-200 ${
                  keySecured === 'copied'
                    ? 'ring-2 ring-green-500 adventure:ring-amber-500 bg-green-50 dark:bg-green-950/20 adventure:bg-amber-50 adventure:dark:bg-amber-950/20'
                    : 'hover:bg-muted/50 dark:bg-muted'
                }`}>
                  <CardContent className='p-3'>
                    <Button
                      variant="ghost"
                      className='w-full h-auto p-0 justify-start'
                      onClick={copyKey}
                    >
                      <div className='flex items-center gap-3 w-full'>
                        <div className={`p-1.5 rounded-lg ${
                          keySecured === 'copied'
                            ? 'bg-green-100 dark:bg-green-900 adventure:bg-amber-100 adventure:dark:bg-amber-900'
                            : 'bg-muted'
                        }`}>
                          {keySecured === 'copied' ? (
                            <CheckCircle className='w-4 h-4 text-green-600 adventure:text-amber-600' />
                          ) : (
                            <Copy className='w-4 h-4 text-muted-foreground' />
                          )}
                        </div>
                        <div className='flex-1 text-left'>
                          <div className='font-medium text-sm'>
                            Copy to Clipboard
                          </div>
                          <div className='text-xs text-muted-foreground'>
                            Save to password manager
                          </div>
                        </div>
                        {keySecured === 'copied' && (
                          <div className='text-xs font-medium text-green-600 adventure:text-amber-600'>
                            ✓ Copied
                          </div>
                        )}
                      </div>
                    </Button>
                  </CardContent>
                </Card>

                {/* Download Option */}
                <Card className={`cursor-pointer transition-all duration-200 ${
                  keySecured === 'downloaded'
                    ? 'ring-2 ring-green-500 adventure:ring-amber-500 bg-green-50 dark:bg-green-950/20 adventure:bg-amber-50 adventure:dark:bg-amber-950/20'
                    : 'hover:bg-muted/50 dark:bg-muted'
                }`}>
                  <CardContent className='p-3'>
                    <Button
                      variant="ghost"
                      className='w-full h-auto p-0 justify-start'
                      onClick={downloadKey}
                    >
                      <div className='flex items-center gap-3 w-full'>
                        <div className={`p-1.5 rounded-lg ${
                          keySecured === 'downloaded'
                            ? 'bg-green-100 dark:bg-green-900 adventure:bg-amber-100 adventure:dark:bg-amber-900'
                            : 'bg-muted'
                        }`}>
                          {keySecured === 'downloaded' ? (
                            <CheckCircle className='w-4 h-4 text-green-600 adventure:text-amber-600' />
                          ) : (
                            <Download className='w-4 h-4 text-muted-foreground' />
                          )}
                        </div>
                        <div className='flex-1 text-left'>
                          <div className='font-medium text-sm'>
                            Download as File
                          </div>
                          <div className='text-xs text-muted-foreground'>
                            Save as treasure-key.txt file
                          </div>
                        </div>
                        {keySecured === 'downloaded' && (
                          <div className='text-xs font-medium text-green-600 adventure:text-amber-600'>
                            ✓ Downloaded
                          </div>
                        )}
                      </div>
                    </Button>
                  </CardContent>
                </Card>
              </div>

              {/* Continue button - blocked until key is secured */}
              <Button
                className={`w-full rounded-full py-4 text-base font-semibold transform transition-all duration-200 shadow-lg ${
                  keySecured !== 'none'
                    ? 'bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 adventure:from-amber-700 adventure:to-orange-700 adventure:hover:from-amber-800 adventure:hover:to-orange-800 hover:scale-105'
                    : 'bg-muted text-muted-foreground cursor-not-allowed'
                }`}
                onClick={finishKeySetup}
                disabled={keySecured === 'none'}
              >
                <Compass className='w-4 h-4 mr-2 flex-shrink-0' />
                <span className="text-center leading-tight">
                  {keySecured === 'none' ? (
                    <>
                      Please secure your key first
                    </>
                  ) : (
                    <>
                      <span className="hidden sm:inline">My Key is Safe - Let the Quest Begin!</span>
                      <span className="sm:hidden">Key Secured - Begin Quest!</span>
                    </>
                  )}
                </span>
              </Button>
            </div>
          </div>
        )}

        {/* Profile Step - Optional profile setup */}
        {step === 'profile' && (
          <div className='text-center space-y-4'>
            {/* Profile setup illustration */}
            <div className='relative p-6 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-blue-950/50 dark:to-indigo-950/50 adventure:from-amber-50 adventure:to-yellow-100 adventure:dark:from-amber-950/50 adventure:dark:to-yellow-950/50 overflow-hidden'>
              {/* Magical sparkles */}
              <div className='absolute inset-0 pointer-events-none'>
                <Sparkles className='absolute top-3 left-4 w-3 h-3 text-yellow-400 animate-pulse' style={{animationDelay: '0s'}} />
                <Star className='absolute top-6 right-6 w-3 h-3 text-yellow-500 animate-pulse' style={{animationDelay: '0.5s'}} />
                <Crown className='absolute bottom-4 left-6 w-3 h-3 text-yellow-400 animate-pulse' style={{animationDelay: '1s'}} />
              </div>

              <div className='relative z-10 flex justify-center items-center mb-3'>
                <div className='relative'>
                  <div className='w-16 h-16 bg-gradient-to-br from-blue-200 to-indigo-300 adventure:from-amber-200 adventure:to-yellow-300 rounded-full flex items-center justify-center shadow-lg'>
                    <Crown className='w-8 h-8 text-blue-800 adventure:text-amber-800' />
                  </div>
                  <div className='absolute -top-1 -right-1 w-5 h-5 bg-blue-500 adventure:bg-amber-500 rounded-full flex items-center justify-center animate-bounce'>
                    <Sparkles className='w-3 h-3 text-white' />
                  </div>
                </div>
              </div>

              <div className='relative z-10 space-y-2'>
                <p className='text-base font-semibold'>
                  Almost there! Let's set up your profile
                </p>

                <p className='text-sm text-muted-foreground'>
                  Your legend starts here
                </p>
              </div>
            </div>

            {/* Publishing status indicator */}
            {isPublishing && (
              <div className='relative p-4 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 adventure:from-amber-50 adventure:to-yellow-50 adventure:dark:from-amber-950/30 adventure:dark:to-yellow-950/30 border border-blue-200 dark:border-blue-800 adventure:border-amber-200 adventure:dark:border-amber-800'>
                <div className='flex items-center justify-center gap-3'>
                  <div className='w-5 h-5 border-2 border-blue-600 adventure:border-amber-600 border-t-transparent rounded-full animate-spin' />
                  <span className='text-sm font-medium text-blue-700 dark:text-blue-300 adventure:text-amber-700 adventure:dark:text-amber-300'>
                    Publishing your profile to the realm...
                  </span>
                </div>
              </div>
            )}

            {/* Profile form */}
            <div className={`space-y-4 text-left ${isPublishing ? 'opacity-50 pointer-events-none' : ''}`}>
              <div className='space-y-2'>
                <label htmlFor='profile-name' className='text-sm font-medium'>
                  Display Name
                </label>
                <Input
                  id='profile-name'
                  value={profileData.name}
                  onChange={(e) => setProfileData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder='Your name'
                  className='rounded-lg'
                  disabled={isPublishing}
                />
              </div>

              <div className='space-y-2'>
                <label htmlFor='profile-about' className='text-sm font-medium'>
                  Bio
                </label>
                <Textarea
                  id='profile-about'
                  value={profileData.about}
                  onChange={(e) => setProfileData(prev => ({ ...prev, about: e.target.value }))}
                  placeholder='Tell others about yourself...'
                  className='rounded-lg resize-none'
                  rows={3}
                  disabled={isPublishing}
                />
              </div>

              <div className='space-y-2'>
                <label htmlFor='profile-picture' className='text-sm font-medium'>
                  Avatar
                </label>
                <div className='flex gap-2'>
                  <Input
                    id='profile-picture'
                    value={profileData.picture}
                    onChange={(e) => setProfileData(prev => ({ ...prev, picture: e.target.value }))}
                    placeholder='https://example.com/your-avatar.jpg'
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
                    title={isUploading ? 'Uploading...' : 'Upload avatar image'}
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

            {/* Action buttons */}
            <div className='space-y-3'>
              <Button
                className='w-full rounded-full py-4 text-base font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 adventure:from-amber-700 adventure:to-yellow-700 adventure:hover:from-amber-800 adventure:hover:to-yellow-800 transform transition-all duration-200 hover:scale-105 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none'
                onClick={() => finishSignup(false)}
                disabled={isPublishing || isUploading}
              >
                {isPublishing ? (
                  <>
                    <div className='w-4 h-4 mr-2 border-2 border-current border-t-transparent rounded-full animate-spin' />
                    Creating Profile...
                  </>
                ) : (
                  <>
                    <Crown className='w-4 h-4 mr-2' />
                    Create Profile & Begin Quest!
                  </>
                )}
              </Button>

              <Button
                variant='outline'
                className='w-full rounded-full py-3 disabled:opacity-50 disabled:cursor-not-allowed'
                onClick={() => finishSignup(true)}
                disabled={isPublishing || isUploading}
              >
                {isPublishing ? (
                  <>
                    <div className='w-4 h-4 mr-2 border-2 border-current border-t-transparent rounded-full animate-spin' />
                    Setting up account...
                  </>
                ) : (
                  'Skip for now - Begin Quest!'
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </BaseDialog>
  );
};

export default SignupDialog;
