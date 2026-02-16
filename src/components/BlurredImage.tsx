import React, { useState, useEffect, useRef } from 'react';
import { Eye, Image as ImageIcon } from 'lucide-react';
import { cn } from '@/utils/utils';

interface BlurredImageProps {
  src: string;
  alt: string;
  className?: string;
  onClick?: () => void;
  blurIntensity?: 'light' | 'medium' | 'heavy';
  showToggle?: boolean;
  defaultBlurred?: boolean;
}

// Utility function to detect if an image is likely animated
function isLikelyAnimated(src: string): boolean {
  const url = src.toLowerCase();
  return url.includes('.gif') || url.includes('gif') || url.includes('webp');
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
  const [isAnimated, setIsAnimated] = useState(false);
  const [staticFrame, setStaticFrame] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const blurClasses = {
    light: 'blur-sm',
    medium: 'blur-md',
    heavy: 'blur-lg',
  };

  // Check if image is animated and create static frame
  useEffect(() => {
    const checkIfAnimated = async () => {
      // First, do a quick check based on URL
      if (isLikelyAnimated(src)) {
        setIsAnimated(true);
        
        // Create a static frame for animated images
        const img = new Image();
        img.crossOrigin = 'anonymous';
        
        img.onload = () => {
          const canvas = canvasRef.current;
          if (!canvas) return;
          
          const ctx = canvas.getContext('2d');
          if (!ctx) return;
          
          // Set canvas size to match image
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          
          // Draw the first frame
          ctx.drawImage(img, 0, 0);
          
          // Convert to data URL
          const staticDataUrl = canvas.toDataURL('image/jpeg', 0.8);
          setStaticFrame(staticDataUrl);
        };
        
        img.onerror = () => {
          // If we can't create a static frame, just use the original
          setStaticFrame(null);
        };
        
        img.src = src;
      } else {
        setIsAnimated(false);
        setStaticFrame(null);
      }
    };

    checkIfAnimated();
  }, [src]);

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

  // Determine which image source to use
  const displaySrc = isBlurred && isAnimated && staticFrame ? staticFrame : src;
  const shouldBlur = isBlurred; // Always blur when isBlurred is true

  return (
    <div className={cn("relative group overflow-hidden", className)}>
      {/* Hidden canvas for creating static frames */}
      <canvas ref={canvasRef} className="hidden" />
      
      {/* Image container */}
      <div className="relative w-full h-full">
        {isBlurred && isAnimated && !staticFrame ? (
          // Show placeholder for animated images when we can't create a static frame
          <div className="w-full h-full bg-muted flex items-center justify-center">
            <ImageIcon className="h-12 w-12 text-muted-foreground" />
          </div>
        ) : (
          <img
            ref={imgRef}
            src={displaySrc}
            alt={alt}
            className={cn(
              "w-full h-full object-cover transition-all duration-300",
              shouldBlur && blurClasses[blurIntensity],
              onClick && "cursor-pointer hover:opacity-90"
            )}
            onClick={handleImageClick}
          />
        )}
      </div>
      
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