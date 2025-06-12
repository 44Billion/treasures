// NOTE: This file is stable and usually should not be modified.
// It is important that all functionality in this file is preserved, and should only be modified if explicitly requested.

import React, { useRef, useState } from 'react';
import { Shield, Upload, AlertTriangle, Sparkles, Crown, Gem, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { BaseDialog } from '@/components/ui/base-dialog';
import { TabsContent } from '@/components/ui/tabs';
import { LoginMethodTabs } from '@/components/ui/mobile-button-patterns';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useLoginActions } from '@/features/auth/hooks/useLoginActions';
import { validateNsec, validateBunkerUri, validateFileContent } from '@/shared/utils/security';

interface LoginDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onLogin: () => void;
  onSignup?: () => void;
}

const LoginDialog: React.FC<LoginDialogProps> = ({ isOpen, onClose, onLogin, onSignup }) => {
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
        throw new Error('Nostr extension not found. Please install a NIP-07 extension.');
      }
      await login.extension();
      onLogin();
      onClose();
    } catch (error) {
      setErrors(prev => ({ 
        ...prev, 
        extension: error instanceof Error ? error.message : 'Extension login failed' 
      }));
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyLogin = () => {
    if (!nsec.trim()) {
      setErrors(prev => ({ ...prev, nsec: 'Please enter your secret key' }));
      return;
    }
    
    if (!validateNsec(nsec)) {
      setErrors(prev => ({ ...prev, nsec: 'Invalid secret key format. Must be a valid nsec starting with nsec1.' }));
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
        nsec: 'Failed to login with this key. Please check that it\'s correct.' 
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
    if (!file) {
      console.log('No file selected');
      return;
    }

    console.log('File selected:', {
      name: file.name,
      type: file.type,
      size: file.size,
      userAgent: navigator.userAgent
    });

    // Reset file input to allow re-uploading the same file
    e.target.value = '';
    
    // Validate file type - be more permissive for mobile devices
    const isValidFileType = file.type.startsWith('text/') || 
                           file.type === 'application/octet-stream' || 
                           file.type === '' || // Some systems don't set MIME type for .txt files
                           file.type === 'text/plain' ||
                           file.name.toLowerCase().endsWith('.txt') ||
                           file.name.toLowerCase().endsWith('.text');
    
    if (!isValidFileType) {
      console.log('Invalid file type:', file.type, 'for file:', file.name);
      setErrors(prev => ({ 
        ...prev, 
        file: `Please select a text file (.txt) containing your secret key. File type detected: ${file.type || 'unknown'}` 
      }));
      return;
    }

    // Validate file size (max 10KB)
    if (file.size > 10 * 1024) {
      console.log('File too large:', file.size);
      setErrors(prev => ({ 
        ...prev, 
        file: 'File too large. Secret key files should be small text files.' 
      }));
      return;
    }

    setErrors(prev => ({ ...prev, file: undefined }));
    setIsFileLoading(true);
    console.log('Starting file read...');

    const reader = new FileReader();
    
    // Add timeout for mobile devices that might have slower file reading
    const timeoutId = setTimeout(() => {
      console.log('File read timeout');
      setErrors(prev => ({ 
        ...prev, 
        file: 'File reading timed out. Please try again with a smaller file.' 
      }));
      setIsFileLoading(false);
    }, 10000); // 10 second timeout

    reader.onload = (event) => {
      clearTimeout(timeoutId);
      const content = event.target?.result as string;
      console.log('File read complete, content length:', content?.length);
      
      if (!content) {
        console.log('No content read from file');
        setErrors(prev => ({ 
          ...prev, 
          file: 'Could not read file content.' 
        }));
        setIsFileLoading(false);
        return;
      }

      // Validate file content
      const isValidContent = validateFileContent(content);
      console.log('File content validation result:', isValidContent);
      if (!isValidContent) {
        setErrors(prev => ({ 
          ...prev, 
          file: 'File content appears to be invalid or unsafe.' 
        }));
        setIsFileLoading(false);
        return;
      }

      const trimmedContent = content.trim();
      console.log('Trimmed content preview:', trimmedContent.substring(0, 20) + '...');
      
      // Validate the nsec from file
      const isValidNsec = validateNsec(trimmedContent);
      console.log('Nsec validation result:', isValidNsec);
      if (!isValidNsec) {
        setErrors(prev => ({ 
          ...prev, 
          file: 'File does not contain a valid secret key. Expected format: nsec1...' 
        }));
        setIsFileLoading(false);
        return;
      }

      console.log('Setting nsec from file upload and auto-logging in');
      setNsec(trimmedContent);
      setErrors(prev => ({ ...prev, file: undefined }));
      
      // Auto-login with the valid nsec from file - add delay for mobile
      setTimeout(() => {
        try {
          console.log('Attempting login with nsec from file');
          login.nsec(trimmedContent);
          console.log('Login successful, calling onLogin and onClose');
          onLogin();
          onClose();
          // Clear the key from memory
          setNsec('');
        } catch (error) {
          console.error('Login error:', error);
          setErrors(prev => ({ 
            ...prev, 
            file: 'Failed to login with the key from file. Please try again.' 
          }));
        } finally {
          setIsFileLoading(false);
        }
      }, 100); // Small delay to ensure state updates
    };

    reader.onerror = (error) => {
      clearTimeout(timeoutId);
      console.error('FileReader error:', error);
      setErrors(prev => ({ 
        ...prev, 
        file: 'Failed to read file. Please try again.' 
      }));
      setIsFileLoading(false);
    };

    reader.onabort = () => {
      clearTimeout(timeoutId);
      console.log('File read aborted');
      setErrors(prev => ({ 
        ...prev, 
        file: 'File reading was cancelled. Please try again.' 
      }));
      setIsFileLoading(false);
    };

    try {
      reader.readAsText(file);
    } catch (error) {
      clearTimeout(timeoutId);
      console.error('Error starting file read:', error);
      setErrors(prev => ({ 
        ...prev, 
        file: 'Failed to start reading file. Please try again.' 
      }));
      setIsFileLoading(false);
    }
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
      title={<span className='font-semibold text-center'>Welcome, Traveler!</span>}
      description="Start your quest, or login to return to your adventure"
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
                <span className='adventure:hidden'>New to Treasure Hunting?</span>
                <span className='hidden adventure:inline'>New to the Quest?</span>
              </span>
            </div>
            
            <p className='text-sm text-green-700 dark:text-green-300 adventure:text-amber-700 adventure:dark:text-amber-300 mb-3'>
              <span className='adventure:hidden'>
                Join the guild of adventurers discovering hidden treasures worldwide!
              </span>
              <span className='hidden adventure:inline'>
                Join the ancient guild of treasure seekers on legendary quests!
              </span>
            </p>
            
            <Button
              onClick={handleSignupClick}
              className='w-full rounded-full py-3 text-base font-semibold bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 adventure:from-amber-700 adventure:to-orange-700 adventure:hover:from-amber-800 adventure:hover:to-orange-800 transform transition-all duration-200 hover:scale-105 shadow-lg border-0'
            >
              <Sparkles className='w-4 h-4 mr-2' />
              <span className='adventure:hidden'>Start Your Treasure Hunt!</span>
              <span className='hidden adventure:inline'>Begin Your Quest!</span>
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
              <span>Or return to your adventure</span>
            </span>
          </div>
        </div>

        {/* Login Methods */}
        <LoginMethodTabs defaultMethod='key'>
            <TabsContent value='extension' className='space-y-3'>
              {errors.extension && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{errors.extension}</AlertDescription>
                </Alert>
              )}
              <div className='text-center p-4 rounded-lg bg-gray-50 dark:bg-gray-800'>
                <Shield className='w-12 h-12 mx-auto mb-3 text-primary' />
                <p className='text-sm text-gray-600 dark:text-gray-300 mb-4'>
                  Login with one click using the browser extension
                </p>
                <div className="flex justify-center">
                  <Button
                    className='w-full rounded-full py-4'
                    onClick={handleExtensionLogin}
                    disabled={isLoading}
                  >
                    {isLoading ? 'Logging in...' : 'Login with Extension'}
                  </Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value='key' className='space-y-4'>
              <div className='space-y-4'>
                <div className='space-y-2'>
                  <label htmlFor='nsec' className='text-sm font-medium'>
                    Secret Key (nsec)
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
                    placeholder='nsec1...'
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
                  {isLoading ? 'Verifying...' : 'Log In'}
                </Button>

                <div className='relative'>
                  <div className='absolute inset-0 flex items-center'>
                    <div className='w-full border-t border-muted'></div>
                  </div>
                  <div className='relative flex justify-center text-xs'>
                    <span className='px-2 bg-background text-muted-foreground'>
                      or
                    </span>
                  </div>
                </div>

                <div className='text-center'>
                  <input
                    type='file'
                    accept='.txt,.text,text/plain,application/octet-stream'
                    className='hidden'
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    capture={false}
                    multiple={false}
                  />
                  <Button
                    variant='outline'
                    className='w-full touch-manipulation'
                    onClick={() => {
                      console.log('File upload button clicked');
                      fileInputRef.current?.click();
                    }}
                    disabled={isLoading || isFileLoading}
                  >
                    <Upload className='w-4 h-4 mr-2' />
                    {isFileLoading ? 'Reading File...' : 'Upload Your Key File'}
                  </Button>
                  {errors.file && (
                    <p className="text-sm text-red-500 mt-2">{errors.file}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    Select a .txt file containing your nsec key
                  </p>
                </div>
              </div>
            </TabsContent>

            <TabsContent value='bunker' className='space-y-3'>
              <div className='space-y-2'>
                <label htmlFor='bunkerUri' className='text-sm font-medium text-gray-700 dark:text-gray-400'>
                  Bunker URI
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
                  placeholder='bunker://'
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
                  {isLoading ? 'Connecting...' : 'Login with Bunker'}
                </Button>
              </div>
            </TabsContent>
          </LoginMethodTabs>
        </div>
      </BaseDialog>
    );
  };

export default LoginDialog;
