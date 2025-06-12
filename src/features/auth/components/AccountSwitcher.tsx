// NOTE: This file is stable and usually should not be modified.
// It is important that all functionality in this file is preserved, and should only be modified if explicitly requested.

import { LogOut, UserIcon, UserPlus, Settings, Bookmark } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/components/ui/avatar';
import { useLoggedInAccounts } from '@/features/geocache/hooks/useLoggedInAccounts';
import { useNavigate } from 'react-router-dom';

interface AccountSwitcherProps {
  onAddAccountClick: () => void;
}

export function AccountSwitcher({ onAddAccountClick }: AccountSwitcherProps) {
  const { currentUser, otherUsers, setLogin, removeLogin } = useLoggedInAccounts();
  const navigate = useNavigate();

  if (!currentUser) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className='flex items-center gap-3 p-2 rounded-full hover:bg-accent adventure:hover:bg-stone-200 transition-all text-foreground'>
          <Avatar className='w-8 h-8'>
            <AvatarImage src={currentUser.metadata.picture} alt={currentUser.metadata.name} />
            <AvatarFallback>{currentUser.metadata.name?.charAt(0) || <UserIcon />}</AvatarFallback>
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
            <div className='font-medium text-sm px-2 py-1.5'>Switch Account</div>
            {otherUsers.map((user) => (
              <DropdownMenuItem
                key={user.id}
                onClick={() => setLogin(user.id)}
                className='flex items-center gap-2 cursor-pointer p-2 rounded-md'
              >
                <Avatar className='w-8 h-8'>
                  <AvatarImage src={user.metadata.picture} alt={user.metadata.name} />
                  <AvatarFallback>{user.metadata.name?.charAt(0) || <UserIcon />}</AvatarFallback>
                </Avatar>
                <div className='flex-1 truncate'>
                  <p className='text-sm font-medium'>{user.metadata.name || user.pubkey}</p>
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
          <span>My Profile</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => navigate('/saved')}
          className='flex items-center gap-2 cursor-pointer p-2 rounded-md'
        >
          <Bookmark className='w-4 h-4' />
          <span>Saved Caches</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => navigate('/settings')}
          className='flex items-center gap-2 cursor-pointer p-2 rounded-md'
        >
          <Settings className='w-4 h-4' />
          <span>App Settings</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={onAddAccountClick}
          className='flex items-center gap-2 cursor-pointer p-2 rounded-md'
        >
          <UserPlus className='w-4 h-4' />
          <span>Add another account</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => removeLogin(currentUser.id)}
          className='flex items-center gap-2 cursor-pointer p-2 rounded-md text-red-500'
        >
          <LogOut className='w-4 h-4' />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}