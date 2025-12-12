// NOTE: This file is stable and usually should not be modified.
// It is important that all functionality in this file is preserved, and should only be modified if explicitly requested.

import { LogOut, UserIcon, UserPlus, Settings, Bookmark, Wallet } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useLoggedInAccounts } from '@/features/geocache/hooks/useLoggedInAccounts';
import { useNavigate } from 'react-router-dom';
import { WalletModal } from '@/components/WalletModal';

interface AccountSwitcherProps {
  onAddAccountClick: () => void;
}

export function AccountSwitcher({ onAddAccountClick }: AccountSwitcherProps) {
  const { t } = useTranslation();
  const { currentUser, otherUsers, setLogin, removeLogin, isLoadingCurrentUser } = useLoggedInAccounts();
  const navigate = useNavigate();

  if (!currentUser) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className='flex items-center gap-3 p-2 rounded-full hover:bg-accent adventure:hover:bg-stone-200 transition-all text-foreground'>
          <Avatar className='w-8 h-8'>
            {/* Show loading state for avatar to prevent layout shift */}
            {isLoadingCurrentUser ? (
              <AvatarFallback>
                <div className="animate-pulse bg-muted rounded-full w-full h-full flex items-center justify-center">
                  <UserIcon className="w-4 h-4 text-muted-foreground" />
                </div>
              </AvatarFallback>
            ) : (
              <>
                <AvatarImage src={currentUser.metadata.picture} alt={currentUser.metadata.name} />
                <AvatarFallback>{currentUser.metadata.name?.charAt(0) || <UserIcon />}</AvatarFallback>
              </>
            )}
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        className='w-56 p-2 animate-scale-in'
        side="bottom"
        sideOffset={8}
        avoidCollisions={true}
        collisionPadding={{ bottom: 80 }}
      >
        {otherUsers.length > 0 && (
          <>
            <div className='font-medium text-sm px-2 py-1.5'>{t('navigation.switchAccount')}</div>
            {otherUsers.map((user) => (
              <DropdownMenuItem
                key={user.id}
                onClick={() => setLogin(user.id)}
                className='flex items-center gap-2 cursor-pointer p-2 rounded-md'
              >
                <Avatar className='w-8 h-8'>
                  {user.isLoadingMetadata ? (
                    <AvatarFallback>
                      <div className="animate-pulse bg-muted rounded-full w-full h-full flex items-center justify-center">
                        <UserIcon className="w-4 h-4 text-muted-foreground" />
                      </div>
                    </AvatarFallback>
                  ) : (
                    <>
                      <AvatarImage src={user.metadata.picture} alt={user.metadata.name} />
                      <AvatarFallback>{user.metadata.name?.charAt(0) || <UserIcon />}</AvatarFallback>
                    </>
                  )}
                </Avatar>
                <div className='flex-1 truncate'>
                  <p className='text-sm font-medium'>
                    {user.isLoadingMetadata ? (
                      <span className="animate-pulse bg-muted rounded w-20 h-4 inline-block"></span>
                    ) : (
                      user.metadata.name || user.pubkey
                    )}
                  </p>
                </div>
                {user.id === currentUser.id && <div className='w-2 h-2 rounded-full bg-primary'></div>}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem
          onClick={() => navigate(`/profile/${currentUser.pubkey}`)}
          className='flex items-center gap-2 cursor-pointer p-2 rounded-md'
        >
          <UserIcon className='w-4 h-4' />
          <span>{t('navigation.myProfile')}</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => navigate('/saved')}
          className='flex items-center gap-2 cursor-pointer p-2 rounded-md'
        >
          <Bookmark className='w-4 h-4' />
          <span>{t('navigation.savedCaches')}</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => navigate('/settings')}
          className='flex items-center gap-2 cursor-pointer p-2 rounded-md'
        >
          <Settings className='w-4 h-4' />
          <span>{t('navigation.appSettings')}</span>
        </DropdownMenuItem>
        <WalletModal>
          <DropdownMenuItem
            className='flex items-center gap-2 cursor-pointer p-2 rounded-md'
            onSelect={(e) => e.preventDefault()}
          >
            <Wallet className='w-4 h-4' />
            <span>{t('navigation.walletSettings')}</span>
          </DropdownMenuItem>
        </WalletModal>
        <DropdownMenuItem
          onClick={onAddAccountClick}
          className='flex items-center gap-2 cursor-pointer p-2 rounded-md'
        >
          <UserPlus className='w-4 h-4' />
          <span>{t('navigation.addAnotherAccount')}</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => removeLogin(currentUser.id)}
          className='flex items-center gap-2 cursor-pointer p-2 rounded-md text-red-500'
        >
          <LogOut className='w-4 h-4' />
          <span>{t('navigation.logOut')}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}