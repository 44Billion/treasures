// NOTE: This file is stable and usually should not be modified.
// It is important that all functionality in this file is preserved, and should only be modified if explicitly requested.

import React, { useState, useEffect } from 'react';
import { Download, Key, AlertTriangle, Compass, Scroll, Shield, Crown, Sparkles, MapPin, Gem, Sword, Map, Star, Zap, Lock, CheckCircle, Copy, FileText, Eye, EyeOff } from 'lucide-react';
import { ComponentLoading } from '@/components/ui/loading';
import { Button } from '@/components/ui/button';
import { BaseDialog } from '@/components/ui/base-dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from '@/hooks/useToast.ts';
import { useLoginActions } from '@/hooks/useLoginActions';
import { generateSecretKey, nip19 } from 'nostr-tools';
import { sanitizeFilename } from '@/lib/security';

interface SignupDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

const SignupDialog: React.FC<SignupDialogProps> = ({ isOpen, onClose }) => {
  const [step, setStep] = useState<'welcome' | 'generate' | 'download' | 'done'>('welcome');
  const [isLoading, setIsLoading] = useState(false);
  const [nsec, setNsec] = useState('');
  const [showSparkles, setShowSparkles] = useState(false);
  const [keySecured, setKeySecured] = useState<'none' | 'copied' | 'downloaded'>('none');
  const login = useLoginActions();

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

  const finishSignup = () => {
    login.nsec(nsec);

    setStep('done');
    
    // Delay closing to show the completion animation
    setTimeout(() => {
      onClose();
      toast({
        title: 'Welcome to the Adventure!',
        description: 'Your treasure hunting journey begins now!',
      });
    }, 1500);
  };

  const getTitle = () => {
    if (step === 'welcome') return (
      <span className="flex items-center justify-center gap-2">
        <Map className="w-5 h-5 text-green-600 adventure:text-amber-700" />
        <span className="adventure:hidden">Join the Treasure Hunt</span>
        <span className="hidden adventure:inline">Begin Your Quest</span>
      </span>
    );
    if (step === 'generate') return (
      <span className="flex items-center justify-center gap-2">
        <Sparkles className="w-5 h-5 text-purple-600 adventure:text-amber-700" />
        <span className="adventure:hidden">Forging Your Key</span>
        <span className="hidden adventure:inline">Crafting Your Rune</span>
      </span>
    );
    if (step === 'download') return (
      <span className="flex items-center justify-center gap-2">
        <Lock className="w-5 h-5 text-green-600 adventure:text-amber-700" />
        <span className="adventure:hidden">Secure Your Treasure Key</span>
        <span className="hidden adventure:inline">Guard Your Sacred Rune</span>
      </span>
    );
    return (
      <span className="flex items-center justify-center gap-2">
        <Crown className="w-5 h-5 text-green-600 adventure:text-amber-700" />
        <span className="adventure:hidden">Welcome, Treasure Hunter!</span>
        <span className="hidden adventure:inline">Hail, Noble Adventurer!</span>
      </span>
    );
  };

  const getDescription = () => {
    if (step === 'welcome') return (
      <div className="text-center">
        <span className="adventure:hidden">
          Ready to discover hidden treasures around the world?
        </span>
      </div>
    );
    if (step === 'generate') return (
      <div className="text-center">
        <span className="adventure:hidden">
          Creating your magical key to unlock the treasure hunting world
        </span>
      </div>
    );
    if (step === 'download') return (
      <div className="text-center">
        <span className="adventure:hidden">
          This key is your passport to adventure - keep it safe!
        </span>
      </div>
    );
    return (
      <div className="text-center">
        <span className="adventure:hidden">
          Your adventure begins now!
        </span>
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
                  <span className='adventure:hidden'>Discover hidden treasures worldwide</span>
                  <span className='hidden adventure:inline'>Embark on legendary quests</span>
                </div>
                <div className='flex items-center justify-center gap-2 text-green-700 dark:text-green-300 adventure:text-amber-800 adventure:dark:text-amber-200'>
                  <Crown className='w-4 h-4' />
                  <span className='adventure:hidden'>Hide your own geocaches</span>
                  <span className='hidden adventure:inline'>Conceal mystical artifacts</span>
                </div>
                <div className='flex items-center justify-center gap-2 text-green-700 dark:text-green-300 adventure:text-amber-800 adventure:dark:text-amber-200'>
                  <Map className='w-4 h-4' />
                  <span className='adventure:hidden'>Join a global community</span>
                  <span className='hidden adventure:inline'>Unite with fellow adventurers</span>
                </div>
              </div>
            </div>

            <div className='space-y-3'>
              <p className='text-muted-foreground'>
                <span className='adventure:hidden'>
                  Join thousands of treasure hunters exploring the world through geocaching. 
                  Your adventure starts with creating a secure account.
                </span>
                <span className='hidden adventure:inline'>
                  Join the ancient guild of treasure seekers on epic quests across mystical realms. 
                  Your legend begins with forging a magical key.
                </span>
              </p>
              
              <Button
                className='w-full rounded-full py-6 text-lg font-semibold bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 adventure:from-amber-700 adventure:to-orange-700 adventure:hover:from-amber-800 adventure:hover:to-orange-800 transform transition-all duration-200 hover:scale-105 shadow-lg'
                onClick={() => setStep('generate')}
              >
                <Zap className='w-5 h-5 mr-2' />
                <span className='adventure:hidden'>Start My Treasure Hunt!</span>
                <span className='hidden adventure:inline'>Begin My Quest!</span>
              </Button>
              
              <p className='text-xs text-muted-foreground'>
                <span className='adventure:hidden'>Free forever • Decentralized • Your data, your control</span>
                <span className='hidden adventure:inline'>Forever free • Ancient magic • Your destiny, your choice</span>
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
                        <span className='adventure:hidden'>Forging your magical key...</span>
                        <span className='hidden adventure:inline'>Channeling ancient energies...</span>
                      </p>
                      <p className='text-sm text-muted-foreground'>
                        <span className='adventure:hidden'>Weaving cryptographic spells</span>
                        <span className='hidden adventure:inline'>Inscribing mystical runes</span>
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className='space-y-3'>
                    <Key className='w-20 h-20 text-primary mx-auto' />
                    <div className='space-y-2'>
                      <p className='text-lg font-semibold'>
                        <span className='adventure:hidden'>Ready to forge your treasure key?</span>
                        <span className='hidden adventure:inline'>Ready to craft your sacred rune?</span>
                      </p>
                      <p className='text-sm text-muted-foreground'>
                        <span className='adventure:hidden'>
                          This magical key will be your passport to the treasure hunting world. 
                          It's completely unique and secure.
                        </span>
                        <span className='hidden adventure:inline'>
                          This sacred rune will be your gateway to legendary adventures. 
                          It holds ancient power and is yours alone.
                        </span>
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
                <span className='adventure:hidden'>Forge My Treasure Key!</span>
                <span className='hidden adventure:inline'>Craft My Sacred Rune!</span>
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
                  <span className='adventure:hidden'>Behold! Your magical treasure key!</span>
                  <span className='hidden adventure:inline'>Witness! Your mystical rune of power!</span>
                </p>
                
                {/* Whimsical warning with scroll design */}
                <div className='relative mx-auto max-w-sm'>
                  <div className='p-3 bg-gradient-to-r from-amber-100 via-yellow-50 to-amber-100 dark:from-amber-950/40 dark:via-yellow-950/20 dark:to-amber-950/40 adventure:from-orange-100 adventure:via-amber-50 adventure:to-orange-100 adventure:dark:from-orange-950/40 adventure:dark:via-amber-950/20 adventure:dark:to-orange-950/40 rounded-lg border-2 border-amber-300 dark:border-amber-700 adventure:border-orange-400 adventure:dark:border-orange-600 shadow-md'>
                    <div className='flex items-center gap-2 mb-1'>
                      <Scroll className='w-3 h-3 text-amber-700 adventure:text-orange-800' />
                      <span className='text-xs font-bold text-amber-800 dark:text-amber-200 adventure:text-orange-900 adventure:dark:text-orange-200'>
                        <span className='adventure:hidden'>Ancient Warning</span>
                        <span className='hidden adventure:inline'>Sacred Prophecy</span>
                      </span>
                    </div>
                    <p className='text-xs text-amber-700 dark:text-amber-300 adventure:text-orange-800 adventure:dark:text-orange-300 italic'>
                      <span className='adventure:hidden'>"Guard this key with your life, for once lost to the digital winds, it shall never return..."</span>
                      <span className='hidden adventure:inline'>"Protect this rune with thy very soul, for if cast into the void, it cannot be summoned back..."</span>
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
                  <span className='adventure:hidden'>Your Treasure Key</span>
                  <span className='hidden adventure:inline'>Your Sacred Rune</span>
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
                  <span className='adventure:hidden'>Choose how to secure your key:</span>
                  <span className='hidden adventure:inline'>Choose how to guard your rune:</span>
                </p>
              </div>

              <div className='grid grid-cols-1 gap-2'>
                {/* Copy Option */}
                <Card className={`cursor-pointer transition-all duration-200 ${
                  keySecured === 'copied' 
                    ? 'ring-2 ring-green-500 adventure:ring-amber-500 bg-green-50 dark:bg-green-950/20 adventure:bg-amber-50 adventure:dark:bg-amber-950/20' 
                    : 'hover:bg-muted/50'
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
                            <span className='adventure:hidden'>Copy to Clipboard</span>
                            <span className='hidden adventure:inline'>Transcribe to Memory</span>
                          </div>
                          <div className='text-xs text-muted-foreground'>
                            <span className='adventure:hidden'>Save to password manager</span>
                            <span className='hidden adventure:inline'>Store in mystical archives</span>
                          </div>
                        </div>
                        {keySecured === 'copied' && (
                          <div className='text-xs font-medium text-green-600 adventure:text-amber-600'>
                            ✓ <span className='adventure:hidden'>Copied</span><span className='hidden adventure:inline'>Inscribed</span>
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
                    : 'hover:bg-muted/50'
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
                            <span className='adventure:hidden'>Download as File</span>
                            <span className='hidden adventure:inline'>Save to Grimoire</span>
                          </div>
                          <div className='text-xs text-muted-foreground'>
                            <span className='adventure:hidden'>Save as treasure-key.txt file</span>
                            <span className='hidden adventure:inline'>Preserve in sacred scroll</span>
                          </div>
                        </div>
                        {keySecured === 'downloaded' && (
                          <div className='text-xs font-medium text-green-600 adventure:text-amber-600'>
                            ✓ <span className='adventure:hidden'>Downloaded</span><span className='hidden adventure:inline'>Preserved</span>
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
                onClick={finishSignup}
                disabled={keySecured === 'none'}
              >
                <Compass className='w-4 h-4 mr-2' />
                {keySecured === 'none' ? (
                  <>
                    <span className='adventure:hidden'>Please secure your key first</span>
                    <span className='hidden adventure:inline'>Please guard your rune first</span>
                  </>
                ) : (
                  <>
                    <span className='adventure:hidden'>My Key is Safe - Let the Hunt Begin!</span>
                    <span className='hidden adventure:inline'>My Rune is Secured - Let the Quest Commence!</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Done Step - Celebration */}
        {step === 'done' && (
          <div className='text-center py-6 space-y-4'>
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
                <span className='adventure:hidden'>Welcome, Treasure Hunter!</span>
                <span className='hidden adventure:inline'>Hail, Noble Adventurer!</span>
              </h3>
              <p className='text-muted-foreground'>
                <span className='adventure:hidden'>Your adventure begins now. The world of hidden treasures awaits!</span>
                <span className='hidden adventure:inline'>Your legend starts here. Epic quests and ancient treasures await your discovery!</span>
              </p>
            </div>
            
            <ComponentLoading size="sm" title={
              <span className='adventure:hidden'>Preparing your treasure map...</span>
            } />
          </div>
        )}
      </div>
    </BaseDialog>
  );
};

export default SignupDialog;
