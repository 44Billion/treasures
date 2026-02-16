import { ThemeProvider as CustomThemeProvider } from "@/hooks/useTheme"
import { type ThemeProviderProps } from "@/hooks/useTheme"

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return <CustomThemeProvider {...props}>{children}</CustomThemeProvider>
}