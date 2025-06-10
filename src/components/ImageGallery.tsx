import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, X, Download, ExternalLink } from 'lucide-react';
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Button } from '@/components/ui/button';
import * as VisuallyHidden from '@radix-ui/react-visually-hidden';
import { cn } from "@/lib/utils";

interface ImageGalleryProps {
  images: string[];
  isOpen: boolean;
  onClose: () => void;
  initialIndex?: number;
}

// Custom DialogContent without the automatic close button
const ImageGalleryDialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay className="fixed inset-0 z-[100000] bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed left-[50%] top-[50%] z-[100001] grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]",
        className
      )}
      {...props}
    >
      {children}
      {/* No automatic close button */}
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
));
ImageGalleryDialogContent.displayName = "ImageGalleryDialogContent";

export function ImageGallery({ images, isOpen, onClose, initialIndex = 0 }: ImageGalleryProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  };

  const goToNext = () => {
    setCurrentIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') {
      goToPrevious();
    } else if (e.key === 'ArrowRight') {
      goToNext();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = images[currentIndex];
    link.download = `cache-image-${currentIndex + 1}`;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleOpenInNewTab = () => {
    window.open(images[currentIndex], '_blank');
  };

  // Update current index when initialIndex changes
  useEffect(() => {
    setCurrentIndex(initialIndex);
  }, [initialIndex]);

  if (!isOpen || images.length === 0) return null;

  return (
    <DialogPrimitive.Root open={isOpen} onOpenChange={onClose}>
      <ImageGalleryDialogContent 
        className="max-w-[100vw] max-h-[100vh] w-[100vw] h-[100vh] p-0 bg-black/95 border-0"
        onKeyDown={handleKeyDown}
      >
        <VisuallyHidden.Root>
          <DialogPrimitive.Title>
            Image Gallery - Viewing image {currentIndex + 1} of {images.length}
          </DialogPrimitive.Title>
        </VisuallyHidden.Root>
        <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
          {/* Close button */}
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 md:top-4 right-2 md:right-4 z-50 text-white hover:bg-white/20 bg-black/30"
            onClick={onClose}
          >
            <X className="h-5 w-5 md:h-6 md:w-6" />
          </Button>

          {/* Action buttons */}
          <div className="absolute top-2 md:top-4 left-2 md:left-4 z-50 flex gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20 bg-black/30"
              onClick={handleDownload}
              title="Download image"
            >
              <Download className="h-4 w-4 md:h-5 md:w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20 bg-black/30"
              onClick={handleOpenInNewTab}
              title="Open in new tab"
            >
              <ExternalLink className="h-4 w-4 md:h-5 md:w-5" />
            </Button>
          </div>

          {/* Navigation buttons */}
          {images.length > 1 && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="absolute left-2 md:left-4 top-1/2 -translate-y-1/2 z-50 text-white hover:bg-white/20 bg-black/30"
                onClick={goToPrevious}
              >
                <ChevronLeft className="h-6 w-6 md:h-8 md:w-8" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-2 md:right-4 top-1/2 -translate-y-1/2 z-50 text-white hover:bg-white/20 bg-black/30"
                onClick={goToNext}
              >
                <ChevronRight className="h-6 w-6 md:h-8 md:w-8" />
              </Button>
            </>
          )}

          {/* Main image */}
          <div className="w-full h-full flex items-center justify-center p-4 md:p-8">
            <img
              src={images[currentIndex]}
              alt={`Cache image ${currentIndex + 1}`}
              className="max-w-[calc(100vw-2rem)] max-h-[calc(100vh-8rem)] md:max-w-[calc(100vw-4rem)] md:max-h-[calc(100vh-8rem)] object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          </div>

          {/* Image counter and thumbnail navigation */}
          {images.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2">
              {/* Image counter */}
              <div className="bg-black/50 text-white px-3 py-1 rounded-full text-sm">
                {currentIndex + 1} of {images.length}
              </div>
              
              {/* Thumbnail navigation */}
              <div className="flex gap-2 max-w-[calc(100vw-2rem)] overflow-x-auto px-2">
                <div className="flex gap-2 pb-2">
                  {images.map((image, index) => (
                    <button
                      key={index}
                      onClick={() => setCurrentIndex(index)}
                      className={`flex-shrink-0 w-12 h-12 md:w-16 md:h-16 rounded-lg overflow-hidden border-2 transition-all ${
                        index === currentIndex 
                          ? 'border-white shadow-lg' 
                          : 'border-white/30 hover:border-white/60'
                      }`}
                    >
                      <img
                        src={image}
                        alt={`Thumbnail ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </ImageGalleryDialogContent>
    </DialogPrimitive.Root>
  );
}