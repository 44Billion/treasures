/**
 * Common page layout patterns
 */

import { ReactNode } from 'react';
import { DesktopHeader } from '@/components/DesktopHeader';
import { cn } from '@/lib/utils';

interface PageLayoutProps {
  children: ReactNode;
  className?: string;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  background?: 'default' | 'muted';
}

export function PageLayout({ 
  children, 
  className,
  maxWidth = 'xl',
  padding = 'md',
  background = 'default'
}: PageLayoutProps) {
  const maxWidthClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    full: 'max-w-full',
  };

  const paddingClasses = {
    none: '',
    sm: 'p-2 sm:p-3',
    md: 'p-4',
    lg: 'p-4 md:p-6 lg:p-8',
  };

  const backgroundClasses = {
    default: '',
    muted: 'bg-muted/50 dark:bg-muted',
  };

  return (
    <div className={cn('flex flex-col', backgroundClasses[background])}>
      <DesktopHeader />
      <div className={cn(
        'flex-1 mx-auto w-full',
        maxWidthClasses[maxWidth],
        paddingClasses[padding],
        className
      )}>
        {children}
      </div>
    </div>
  );
}
