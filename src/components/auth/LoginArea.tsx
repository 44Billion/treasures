// NOTE: This file is stable and usually should not be modified.
// It is important that all functionality in this file is preserved, and should only be modified if explicitly requested.

import React, { useState, useEffect } from 'react';
import { User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import LoginDialog from './LoginDialog';
import SignupDialog from './SignupDialog';
import { WelcomeModal } from './WelcomeModal';
import { useLoggedInAccounts } from '@/features/geocache/hooks/useLoggedInAccounts';
import { AccountSwitcher } from './AccountSwitcher';

interface LoginAreaProps {
  compact?: boolean;
}

export function LoginArea({ compact = false }: LoginAreaProps) {
  const { currentUser } = useLoggedInAccounts();
  const [loginDialogOpen, setLoginDialogOpen] = useState(false);
  const [signupDialogOpen, setSignupDialogOpen] = useState(false);
  const [welcomeModalOpen, setWelcomeModalOpen] = useState(false);
  const [isNewUser, setIsNewUser] = useState(false);
  const [pendingWelcome, setPendingWelcome] = useState<{ isNewUser: boolean } | null>(null);

  const handleWelcomeModalClose = () => {
    setWelcomeModalOpen(false);
    setIsNewUser(false);
    setPendingWelcome(null);
    // Clean up any remaining signup markers
    localStorage.removeItem('treasures_last_signup');
  };

  const handleLogin = (isNewUserLogin = false) => {
    setLoginDialogOpen(false);
    setSignupDialogOpen(false);
    setIsNewUser(isNewUserLogin);
    
    // Set pending welcome state to show modal once user is logged in
    setPendingWelcome({ isNewUser: isNewUserLogin });
    

  };

  // Show welcome modal when user logs in and we have pending welcome
  useEffect(() => {
    const loggedInUser = currentUser;
    
    if (loggedInUser && pendingWelcome) {

      
      // Add a longer delay to ensure all state updates have settled
      // This accounts for the time needed for login state to fully propagate
      const timer = setTimeout(() => {
        setIsNewUser(pendingWelcome.isNewUser);
        setWelcomeModalOpen(true);
        setPendingWelcome(null);
        

      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, [currentUser, pendingWelcome]);

  // Fallback effect: if we have a user but no welcome modal has been shown for a new user
  // This handles edge cases where the timing doesn't work perfectly
  useEffect(() => {
    const loggedInUser = currentUser;
    
    // If we have a user, no pending welcome, no modal open, and this might be a new signup
    if (loggedInUser && !pendingWelcome && !welcomeModalOpen && !loginDialogOpen && !signupDialogOpen) {
      // Check if this might be a fresh signup by looking at localStorage
      const lastSignupTime = localStorage.getItem('treasures_last_signup');
      const now = Date.now();
      
      // If signup happened in the last 10 seconds, show welcome modal
      if (lastSignupTime && (now - parseInt(lastSignupTime)) < 10000) {

        
        setIsNewUser(true);
        setWelcomeModalOpen(true);
        localStorage.removeItem('treasures_last_signup'); // Clean up
      }
    }
  }, [currentUser, pendingWelcome, welcomeModalOpen, loginDialogOpen, signupDialogOpen]);

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
        onComplete={() => handleLogin(true)}
      />

      <WelcomeModal
        isOpen={welcomeModalOpen}
        onClose={handleWelcomeModalClose}
        isNewUser={isNewUser}
      />
    </>
  );
}