import { useTheme } from "next-themes"
import { useIsDarkMode, useSystemThemePreference } from "@/hooks/useTheme"
import { useState, useEffect } from "react"

export function ThemeDebugInfo() {
  const { theme, resolvedTheme, systemTheme } = useTheme()
  const isDark = useIsDarkMode()
  const systemPrefersDark = useSystemThemePreference()
  const [mounted, setMounted] = useState(false)

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <div className="fixed bottom-4 right-4 bg-background border rounded-lg p-3 text-xs shadow-lg z-50">
        <div>Loading theme info...</div>
      </div>
    )
  }

  return (
    <div className="fixed bottom-4 right-4 bg-background border rounded-lg p-3 text-xs shadow-lg z-50">
      <div className="font-semibold mb-2">Theme Debug</div>
      <div>Theme: {theme}</div>
      <div>Resolved: {resolvedTheme}</div>
      <div>System: {systemTheme}</div>
      <div>Is Dark: {isDark ? 'Yes' : 'No'}</div>
      <div>System Prefers Dark: {systemPrefersDark ? 'Yes' : 'No'}</div>
    </div>
  )
}