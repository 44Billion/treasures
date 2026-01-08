import { useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { cn } from '@/shared/utils/utils';

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
      QRCode.toCanvas(
        canvasRef.current,
        value,
        {
          width: size,
          margin: 0,
          errorCorrectionLevel: level,
        },
        (error) => {
          if (error) {
            console.error('QR Code generation error:', error);
          }
        }
      );
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
