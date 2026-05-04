import React from 'react';
import { chest as chestPaths } from '@lucide/lab';

// Create a proper React component for the chest icon
export const Chest = React.forwardRef<SVGSVGElement, React.SVGProps<SVGSVGElement>>(
  ({ className, strokeWidth = 2, ...props }, ref) =>
    React.createElement('svg', {
      ref,
      xmlns: "http://www.w3.org/2000/svg",
      width: 24,
      height: 24,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      className,
      ...props
    }, chestPaths.map(([element, props], index) => 
      React.createElement(element, { key: props.key || index, ...props })
    ))
);

Chest.displayName = "Chest";

// Size classes for icons
export const sizeClasses = {
  sm: "h-4 w-4",
  md: "h-5 w-5", 
  lg: "h-8 w-8"
};

// Color classes for standard theme
export const colorClasses = {
  traditional: "text-primary",
  multi: "text-amber-600", 
  mystery: "text-purple-600"
};

// Adventure theme styling
export const adventureIconStyle: React.CSSProperties = {
  background: `url('/parchment-50.jpg'), #5f7292`,
  backgroundBlendMode: 'darken',
  backgroundSize: '50px 50px, auto',
  border: '2px solid #4a5a6b',
  borderRadius: '6px',
  width: '100%',
  height: '100%',
  color: '#FFFFFF',
  boxShadow: '0 2px 4px rgba(63, 74, 90, 0.3)',
  transition: 'all 0.2s ease',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
};

// Mojave (Pip-Boy CRT) theme styling — dark terminal panel with amber glow.
// Uses Pip-Boy amber (#e8a838) for icon strokes and border; background is
// near-black like a CRT off-state, with a subtle amber phosphor glow.
export const MOJAVE_AMBER = '#e8a838';
export const MOJAVE_AMBER_GLOW = 'rgba(232, 168, 56, 0.45)';
export const MOJAVE_TERMINAL_BG = '#0f0a05';
export const MOJAVE_AMBER_BORDER = '#c48f2a';

export const mojaveIconStyle: React.CSSProperties = {
  background: MOJAVE_TERMINAL_BG,
  border: `2px solid ${MOJAVE_AMBER_BORDER}`,
  borderRadius: '4px',
  width: '100%',
  height: '100%',
  color: MOJAVE_AMBER,
  boxShadow: `0 0 8px ${MOJAVE_AMBER_GLOW}, 0 2px 4px rgba(0, 0, 0, 0.5)`,
  transition: 'all 0.2s ease',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
};