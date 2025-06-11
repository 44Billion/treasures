import { useTheme } from "next-themes"
import { useEffect, useState } from "react"

export function useIsDarkMode() {
  const { resolvedTheme } = useTheme()
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    setIsDark(resolvedTheme === 'dark')
  }, [resolvedTheme])

  return isDark
}

export function useSystemThemePreference() {
  const [systemPrefersDark, setSystemPrefersDark] = useState(false)

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    setSystemPrefersDark(mediaQuery.matches)

    const handleChange = (e: MediaQueryListEvent) => {
      setSystemPrefersDark(e.matches)
    }

    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  return systemPrefersDark
}