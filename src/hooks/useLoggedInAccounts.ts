import { useNostrLogin } from '@nostrify/react/login';
import { NostrMetadata } from '@nostrify/nostrify';
import { useAuthors } from '@/hooks/useAuthors';

export interface Account {
  id: string;
  pubkey: string;
  metadata: NostrMetadata;
  isLoadingMetadata?: boolean;
}

export function useLoggedInAccounts() {
  const { logins, setLogin, removeLogin } = useNostrLogin();

  const allPubkeys = logins.map(login => login.pubkey);
  const authorQueries = useAuthors(allPubkeys);

  const accounts = logins.map((login, index) => {
    const authorQuery = authorQueries[index];
    return {
      id: login.id,
      pubkey: login.pubkey,
      metadata: (authorQuery?.data as any)?.metadata || {},
      isLoadingMetadata: authorQuery?.isLoading ?? false,
    };
  });

  const currentUser = accounts[0];
  const otherUsers = accounts.slice(1);

  return {
    authors: accounts,
    currentUser,
    otherUsers,
    setLogin,
    removeLogin,
    isLoadingCurrentUser: currentUser?.isLoadingMetadata ?? false,
    isLoadingAnyUser: accounts.some(account => account.isLoadingMetadata),
  };
}
