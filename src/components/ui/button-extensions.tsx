import React from 'react';
import { Button, ButtonProps } from '@/components/ui/button';
import { LucideIcon } from 'lucide-react';
import { CompassSpinner } from '@/components/ui/loading';
import { cn } from '@/lib/utils';

interface LoadingButtonProps extends Omit<ButtonProps, 'children'> {
  isLoading?: boolean;
  loadingText?: string;
  icon?: LucideIcon;
  iconPosition?: 'left' | 'right';
  children: React.ReactNode;
}

export function LoadingButton({
  isLoading = false,
  loadingText,
  icon: Icon,
  iconPosition = 'left',
  className,
  disabled,
  children,
  ...props
}: LoadingButtonProps) {
  const hasIcon = Icon && !isLoading;
  const showLoadingText = isLoading && loadingText;

  return (
    <Button
      className={cn('relative', className)}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && (
        <CompassSpinner 
          size={16}
          variant="component"
          className={cn(
            showLoadingText || (hasIcon && iconPosition === 'left') ? "mr-2" : "",
            hasIcon && iconPosition === 'right' ? "ml-2" : ""
          )}
        />
      )}
      
      {hasIcon && iconPosition === 'left' && (
        <Icon className={cn("h-4 w-4", "mr-2")} />
      )}
      
      {showLoadingText ? loadingText : children}
      
      {hasIcon && iconPosition === 'right' && (
        <Icon className={cn("h-4 w-4", "ml-2")} />
      )}
    </Button>
  );
}

interface IconButtonProps extends Omit<ButtonProps, 'children'> {
  icon: LucideIcon;
  iconPosition?: 'left' | 'right';
  children: React.ReactNode;
}

export function IconButton({
  icon: Icon,
  iconPosition = 'left',
  className,
  children,
  ...props
}: IconButtonProps) {
  return (
    <Button className={cn('flex items-center gap-2', className)} {...props}>
      {iconPosition === 'left' && <Icon className="h-4 w-4" />}
      {children}
      {iconPosition === 'right' && <Icon className="h-4 w-4" />}
    </Button>
  );
}