// NOTE: This file is stable and usually should not be modified.
// It is important that all functionality in this file is preserved, and should only be modified if explicitly requested.

import React, { useState } from 'react';
import { User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import LoginDialog from './LoginDialog';
import SignupDialog from './SignupDialog';
import { useLoggedInAccounts } from '@/hooks/useLoggedInAccounts';
import { AccountSwitcher } from './AccountSwitcher';

interface LoginAreaProps {
  compact?: boolean;
}

export function LoginArea({ compact = false }: LoginAreaProps) {
  const { currentUser } = useLoggedInAccounts();
  const [loginDialogOpen, setLoginDialogOpen] = useState(false);
  const [signupDialogOpen, setSignupDialogOpen] = useState(false);

  const handleLogin = () => {
    setLoginDialogOpen(false);
    setSignupDialogOpen(false);
  };

  return (
    <>
      {currentUser ? (
        <AccountSwitcher onAddAccountClick={() => setLoginDialogOpen(true)} />
      ) : (
        <Button
          onClick={() => setLoginDialogOpen(true)}
          className={`flex items-center gap-1 xs:gap-2 rounded-full bg-primary text-primary-foreground font-medium transition-all hover:bg-primary/90 animate-scale-in ${
            compact ? 'px-2 xs:px-3 py-2' : 'px-3 xs:px-4 py-2'
          }`}
          size={compact ? "sm" : "default"}
        >
          <User className='w-3 h-3 xs:w-4 xs:h-4' />
          {!compact && <span className="text-xs xs:text-sm">Log in</span>}
        </Button>
      )}

      <LoginDialog
        isOpen={loginDialogOpen} 
        onClose={() => setLoginDialogOpen(false)} 
        onLogin={handleLogin}
        onSignup={() => setSignupDialogOpen(true)}
      />

      <SignupDialog
        isOpen={signupDialogOpen}
        onClose={() => setSignupDialogOpen(false)}
      />
    </>
  );
}