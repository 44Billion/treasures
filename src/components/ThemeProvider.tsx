import { ThemeProvider as NextThemesProvider } from "next-themes"
import { type ThemeProviderProps } from "next-themes/dist/types"
import { createContext } from "react"

// Ensure React is available before next-themes tries to create contexts
if (typeof createContext !== 'function') {
  throw new Error('React is not properly loaded. Please ensure React is available before importing ThemeProvider.');
}

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>
}