import { useEffect, useRef } from 'react';
import { cn } from '@/utils/utils';
import { drawStyledQR } from '@/utils/qr-renderer';

interface QRCodeProps {
  value: string;
  size?: number;
  level?: 'L' | 'M' | 'Q' | 'H';
  className?: string;
}

export function QRCodeCanvas({ value, size = 256, level = 'M', className }: QRCodeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvasRef.current && value) {
      const ctx = canvasRef.current.getContext('2d');
      if (!ctx) return;

      // Clear before redraw
      ctx.clearRect(0, 0, size, size);

      try {
        drawStyledQR(ctx, 0, 0, {
          text: value,
          size,
          margin: 1,
          errorCorrectionLevel: level,
        });
      } catch (error) {
        console.error('QR Code generation error:', error);
      }
    }
  }, [value, size, level]);

  return (
    <canvas
      ref={canvasRef}
      className={cn('rounded-lg', className)}
      width={size}
      height={size}
    />
  );
}
