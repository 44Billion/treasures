import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BlurredImageProps {
  src: string;
  alt: string;
  className?: string;
  onClick?: () => void;
  blurIntensity?: 'light' | 'medium' | 'heavy';
  showToggle?: boolean;
  defaultBlurred?: boolean;
}

export function BlurredImage({
  src,
  alt,
  className,
  onClick,
  blurIntensity = 'medium',
  showToggle = true,
  defaultBlurred = true,
}: BlurredImageProps) {
  const [isBlurred, setIsBlurred] = useState(defaultBlurred);

  const blurClasses = {
    light: 'blur-sm',
    medium: 'blur-md',
    heavy: 'blur-lg',
  };

  const handleToggleBlur = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsBlurred(!isBlurred);
  };

  const handleCenterEyeClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isBlurred) {
      setIsBlurred(false);
    }
  };

  const handleImageClick = () => {
    if (onClick) {
      onClick();
    }
  };

  return (
    <div className={cn("relative group overflow-hidden", className)}>
      {/* Image container with blur applied only to content, not borders */}
      <div className="relative w-full h-full">
        <img
          src={src}
          alt={alt}
          className={cn(
            "w-full h-full object-cover transition-all duration-300",
            isBlurred && blurClasses[blurIntensity],
            onClick && "cursor-pointer hover:opacity-90"
          )}
          onClick={handleImageClick}
        />
      </div>
      
      {/* Corner toggle button - only shows when not blurred */}
      {showToggle && !isBlurred && (
        <button
          onClick={handleToggleBlur}
          className={cn(
            "absolute top-2 right-2 p-2 rounded-full transition-all duration-200",
            "bg-black/50 hover:bg-black/70 text-white",
            "opacity-0 group-hover:opacity-100",
            "focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-white/50"
          )}
          title="Blur image"
          type="button"
        >
          <EyeOff className="h-4 w-4" />
        </button>
      )}
      
      {/* Center eye overlay when blurred - clicking unhides */}
      {isBlurred && showToggle && (
        <button
          onClick={handleCenterEyeClick}
          className="absolute inset-0 flex items-center justify-center bg-black/10 hover:bg-black/20 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-white/50"
          title="Show image"
          type="button"
        >
          <div className="bg-black/40 hover:bg-black/60 rounded-full p-4 transition-colors duration-200">
            <Eye className="h-8 w-8 text-white" />
          </div>
        </button>
      )}
    </div>
  );
}