import { ReactNode } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export interface BaseDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string | ReactNode;
  description?: string | ReactNode;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full' | 'auth';
  className?: string;
  headerClassName?: string;
  contentClassName?: string;
  showHeader?: boolean;
}

const sizeClasses = {
  sm: "sm:max-w-md",
  md: "sm:max-w-lg",
  lg: "sm:max-w-2xl", 
  xl: "sm:max-w-4xl",
  full: "max-w-[100vw] max-h-[100vh] w-[100vw] h-[100vh]",
  auth: "max-w-[95vw] sm:max-w-md max-h-[90vh] max-h-[90dvh] p-0 overflow-hidden rounded-2xl",
};

export function BaseDialog({
  isOpen,
  onOpenChange,
  title,
  description,
  children,
  size = 'md',
  className,
  headerClassName,
  contentClassName,
  showHeader = true,
  ...props
}: BaseDialogProps) {
  const sizeClass = sizeClasses[size];

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent 
        className={cn(sizeClass, contentClassName, className)}
        {...props}
      >
        {showHeader && (title || description) && (
          <DialogHeader className={cn(headerClassName)}>
            {title && (
              <DialogTitle className={typeof title === 'string' ? 'text-xl' : ''}>
                {title}
              </DialogTitle>
            )}
            {description && (
              <DialogDescription className="text-center">
                {description}
              </DialogDescription>
            )}
          </DialogHeader>
        )}
        {children}
      </DialogContent>
    </Dialog>
  );
}