// NOTE: This file is stable and usually should not be modified.
// It is important that all functionality in this file is preserved, and should only be modified if explicitly requested.

import React, { useRef, useState } from 'react';
import { Shield, Upload, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { BaseDialog } from '@/components/ui/base-dialog';
import { TabsContent } from '@/components/ui/tabs';
import { LoginMethodTabs } from '@/components/ui/mobile-button-patterns';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useLoginActions } from '@/hooks/useLoginActions';
import { validateNsec, validateBunkerUri, validateFileContent } from '@/lib/security';

interface LoginDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onLogin: () => void;
  onSignup?: () => void;
}

const LoginDialog: React.FC<LoginDialogProps> = ({ isOpen, onClose, onLogin, onSignup }) => {
  const [isLoading, setIsLoading] = useState(false);
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
    if (!file) return;

    // Reset file input to allow re-uploading the same file
    e.target.value = '';
    
    // Validate file type
    if (!file.type.startsWith('text/') && file.type !== 'application/octet-stream') {
      setErrors(prev => ({ 
        ...prev, 
        file: 'Please select a text file (.txt) containing your secret key.' 
      }));
      return;
    }

    // Validate file size (max 10KB)
    if (file.size > 10 * 1024) {
      setErrors(prev => ({ 
        ...prev, 
        file: 'File too large. Secret key files should be small text files.' 
      }));
      return;
    }

    setErrors(prev => ({ ...prev, file: undefined }));

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      
      if (!content) {
        setErrors(prev => ({ 
          ...prev, 
          file: 'Could not read file content.' 
        }));
        return;
      }

      // Validate file content
      if (!validateFileContent(content)) {
        setErrors(prev => ({ 
          ...prev, 
          file: 'File content appears to be invalid or unsafe.' 
        }));
        return;
      }

      const trimmedContent = content.trim();
      
      // Validate the nsec from file
      if (!validateNsec(trimmedContent)) {
        setErrors(prev => ({ 
          ...prev, 
          file: 'File does not contain a valid secret key.' 
        }));
        return;
      }

      setNsec(trimmedContent);
    };

    reader.onerror = () => {
      setErrors(prev => ({ 
        ...prev, 
        file: 'Failed to read file. Please try again.' 
      }));
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
      title={<span className='font-semibold text-center'>Log in</span>}
      description={<span className='text-center text-muted-foreground mt-2'>Access your account securely with your preferred method</span>}
      headerClassName='px-6 pt-6 pb-0 relative'
    >
      <div className='px-6 py-6 pt-0 space-y-4'>
          <LoginMethodTabs defaultMethod={'nostr' in window ? 'extension' : 'key'}>
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

            <TabsContent value='key' className='space-y-3'>
              <div className='space-y-3'>
                <div className='space-y-2'>
                  <label htmlFor='nsec' className='text-sm font-medium text-gray-700 dark:text-gray-400'>
                    Enter your nsec
                  </label>
                  <Input
                    id='nsec'
                    type="password"
                    value={nsec}
                    onChange={(e) => {
                      setNsec(e.target.value);
                      if (errors.nsec) setErrors(prev => ({ ...prev, nsec: undefined }));
                    }}
                    className={`rounded-lg border-gray-300 dark:border-gray-700 focus-visible:ring-primary ${
                      errors.nsec ? 'border-red-500' : ''
                    }`}
                    placeholder='nsec1...'
                    autoComplete="off"
                  />
                  {errors.nsec && (
                    <p className="text-sm text-red-500">{errors.nsec}</p>
                  )}
                </div>

                <div className='text-center'>
                  <p className='text-sm mb-2 text-gray-600 dark:text-gray-400'>Or upload a key file</p>
                  <input
                    type='file'
                    accept='.txt,text/plain'
                    className='hidden'
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                  />
                  <div className="flex justify-center">
                    <Button
                      variant='outline'
                      className='w-full dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700'
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isLoading}
                    >
                      <Upload className='w-4 h-4 mr-2' />
                      Upload Nsec File
                    </Button>
                  </div>
                  {errors.file && (
                    <p className="text-sm text-red-500 mt-2">{errors.file}</p>
                  )}
                </div>

                <div className="flex justify-center">
                  <Button
                    className='w-full rounded-full py-4'
                    onClick={handleKeyLogin}
                    disabled={isLoading || !nsec.trim()}
                  >
                    {isLoading ? 'Verifying...' : 'Login with Nsec'}
                  </Button>
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

          <div className='text-center text-sm'>
            <p className='text-gray-600 dark:text-gray-400'>
              Don't have an account?{' '}
              <button
                onClick={handleSignupClick}
                className='text-primary hover:underline font-medium'
              >
                Sign up
              </button>
            </p>
          </div>
        </div>
      </BaseDialog>
    );
  };

export default LoginDialog;
