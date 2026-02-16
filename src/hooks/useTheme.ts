import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';

type Theme = 'light' | 'dark' | 'adventure' | 'system';
type ThemeContextType = {
  theme: Theme | undefined;
  setTheme: (theme: Theme) => void;
  resolvedTheme: 'light' | 'dark' | 'adventure';
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

interface ThemeProviderProps {
  children: ReactNode;
  attribute?: string;
  defaultTheme?: Theme;
  enableSystem?: boolean;
  disableTransitionOnChange?: boolean;
  themes?: Theme[];
  storageKey?: string;
}

export function ThemeProvider({
  children,
  attribute = 'class',
  defaultTheme = 'system',
  enableSystem = true,
  disableTransitionOnChange = true,
  themes = ['light', 'dark', 'system', 'adventure'],
  storageKey = 'ui-theme',
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(() => {
    // Try to get theme from localStorage first
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(storageKey) as Theme;
      if (stored && themes.includes(stored)) {
        return stored;
      }
    }
    return defaultTheme;
  });

  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark' | 'adventure'>('light');

  // Function to set theme and save to localStorage
  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    if (typeof window !== 'undefined') {
      localStorage.setItem(storageKey, newTheme);
    }
  };

  // Apply theme to document
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const root = document.documentElement;

    // Remove all theme classes first
    themes.forEach(t => {
      if (t !== 'system') {
        root.classList.remove(t);
      }
    });

    // Determine the actual theme to apply
    let themeToApply: 'light' | 'dark' | 'adventure';

    if (theme === 'system') {
      // Check system preference
      const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      themeToApply = systemPrefersDark ? 'dark' : 'light';
    } else {
      themeToApply = theme as 'light' | 'dark' | 'adventure';
    }

    setResolvedTheme(themeToApply);

    // Apply the theme class
    if (attribute === 'class') {
      root.classList.add(themeToApply);
    } else {
      root.setAttribute(attribute, themeToApply);
    }

    // Handle transition disabling
    if (disableTransitionOnChange) {
      root.style.transition = 'none';
      // Force reflow
      root.offsetHeight; // eslint-disable-line @typescript-eslint/no-unused-expressions
      root.style.transition = '';
    }
  }, [theme, attribute, themes, disableTransitionOnChange]);

  // Listen for system theme changes
  useEffect(() => {
    if (!enableSystem || theme !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleChange = () => {
      // Re-apply theme when system preference changes
      const root = document.documentElement;
      const systemPrefersDark = mediaQuery.matches;
      const themeToApply = systemPrefersDark ? 'dark' : 'light';

      setResolvedTheme(themeToApply);

      if (attribute === 'class') {
        // Remove old theme classes
        ['light', 'dark', 'adventure'].forEach(t => {
          root.classList.remove(t);
        });
        root.classList.add(themeToApply);
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme, enableSystem, attribute]);

  const value = {
    theme,
    setTheme,
    resolvedTheme,
  };

  return React.createElement(ThemeContext.Provider, { value }, children);
}