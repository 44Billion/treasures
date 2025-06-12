/**
 * Common page layout patterns
 */

import { ReactNode } from 'react';
import { DesktopHeader } from '@/components/DesktopHeader';
import { cn } from '@/shared/utils/utils';

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
    sm: 'p-2',
    md: 'p-4',
    lg: 'p-8',
  };

  const backgroundClasses = {
    default: '',
    muted: 'bg-muted/50 dark:bg-muted',
  };

  return (
    <div className={cn('min-h-screen flex flex-col', backgroundClasses[background])}>
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

interface CenteredLayoutProps {
  children: ReactNode;
  title?: string;
  description?: string;
  className?: string;
}

export function CenteredLayout({ children, title, description, className }: CenteredLayoutProps) {
  return (
    <PageLayout maxWidth="md" className={cn('flex items-center justify-center', className)}>
      <div className="w-full space-y-6">
        {(title || description) && (
          <div className="text-center space-y-2">
            {title && <h1 className="text-2xl font-bold text-foreground">{title}</h1>}
            {description && <p className="text-muted-foreground">{description}</p>}
          </div>
        )}
        {children}
      </div>
    </PageLayout>
  );
}

interface TwoColumnLayoutProps {
  sidebar: ReactNode;
  main: ReactNode;
  sidebarWidth?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function TwoColumnLayout({ 
  sidebar, 
  main, 
  sidebarWidth = 'md',
  className 
}: TwoColumnLayoutProps) {
  const sidebarWidthClasses = {
    sm: 'w-64',
    md: 'w-80',
    lg: 'w-96',
  };

  return (
    <PageLayout maxWidth="full" padding="none" className={className}>
      <div className="flex h-full">
        <aside className={cn(
          'hidden lg:block border-r bg-muted/50 dark:bg-muted',
          sidebarWidthClasses[sidebarWidth]
        )}>
          <div className="p-4">
            {sidebar}
          </div>
        </aside>
        <main className="flex-1 p-4">
          {main}
        </main>
      </div>
    </PageLayout>
  );
}