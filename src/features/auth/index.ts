// Auth Feature Barrel Export
// This file provides a clean interface for importing auth-related functionality

// Components
export { LoginArea } from './components/LoginArea';
export { LoginDialog } from './components/LoginDialog';
export { SignupDialog } from './components/SignupDialog';
export { AccountSwitcher } from './components/AccountSwitcher';
export { WelcomeModal } from './components/WelcomeModal';

// Hooks
export { useCurrentUser } from './hooks/useCurrentUser';
export { useLoginActions } from './hooks/useLoginActions';
export { useAuthor } from './hooks/useAuthor';

// Types (to be defined)
export type * from './types';