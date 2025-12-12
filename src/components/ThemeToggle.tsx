import { useTranslation } from "react-i18next"
import { Moon, Sun, Sword, Monitor } from "lucide-react"
import { useTheme } from "@/shared/hooks/useTheme"
import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

interface ThemeToggleProps {
  variant?: 'default' | 'mobile-sheet' | 'compact-icon';
}

export function ThemeToggle({ variant = 'default' }: ThemeToggleProps) {
  const { t } = useTranslation();
  const { setTheme, theme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true)
  }, [])

  // Adventure theme styling - matches the navigation bar brown
  const adventureClasses = "adventure:bg-[rgb(74,64,61)] adventure:border-[rgb(60,50,47)] adventure:text-stone-200 adventure:hover:bg-[rgb(60,50,47)]";

  const getAdventureClasses = () => {
    // Mobile sheet doesn't need special adventure styling
    return variant === 'mobile-sheet' ? "" : adventureClasses;
  };

  // Get theme display name
  const getThemeDisplayName = () => {
    switch (theme) {
      case 'light': return t('theme.light');
      case 'dark': return t('theme.dark');
      case 'adventure': return t('theme.adventure');
      case 'system': return t('theme.system');
      default: return t('theme.system');
    }
  };

  if (!mounted) {
    return (
      <Button
        variant="outline"
        size={variant === 'mobile-sheet' ? 'sm' : 'icon'}
        disabled
        className={cn(
          getAdventureClasses(),
          variant === 'mobile-sheet' && "flex-1 justify-start gap-2",
          variant === 'compact-icon' && "h-6 w-6 p-0"
        )}
      >
        {variant === 'mobile-sheet' ? (
          <>
            <Monitor className="h-4 w-4" />
            {t('theme.system')}
          </>
        ) : variant === 'compact-icon' ? (
          <Monitor className="h-3 w-3" />
        ) : (
          <Sun className="h-[1.2rem] w-[1.2rem]" />
        )}
      </Button>
    )
  }

  // Get theme icon
  const getThemeIcon = () => {
    switch (theme) {
      case 'light': return <Sun className="h-4 w-4 text-black" />;
      case 'dark': return <Moon className="h-4 w-4" />;
      case 'adventure': return <Sword className="h-4 w-4" />;
      case 'system': return <Monitor className="h-4 w-4" />;
      default: return <Monitor className="h-4 w-4" />;
    }
  };

  // Shared dropdown menu configuration
  const dropdownMenuProps = {
    align: "end" as const,
    side: "bottom" as const,
    sideOffset: 8,
    avoidCollisions: true,
    collisionPadding: { bottom: 80 }
  };

  // Shared dropdown menu items
  const dropdownMenuItems = (
    <>
      <DropdownMenuItem onClick={() => setTheme("light")}>
        <Sun className="mr-2 h-4 w-4" />
        {t('theme.light')}
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => setTheme("dark")}>
        <Moon className="mr-2 h-4 w-4" />
        {t('theme.dark')}
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => setTheme("adventure")}>
        <Sword className="mr-2 h-4 w-4" />
        {t('theme.adventure')}
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => setTheme("system")}>
        <Monitor className="mr-2 h-4 w-4" />
        {t('theme.system')}
      </DropdownMenuItem>
    </>
  );

  if (variant === 'mobile-sheet') {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(getAdventureClasses(), "flex-1 justify-start gap-2")}
          >
            {mounted ? getThemeIcon() : <Monitor className="h-4 w-4" />}
            {getThemeDisplayName()}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent {...dropdownMenuProps}>
          {dropdownMenuItems}
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  if (variant === 'compact-icon') {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className={cn(
              getAdventureClasses(),
              "h-6 w-6 p-0",
              // Ensure proper contrast in light mode - stronger borders and text
              "border-border text-gray-800 dark:text-foreground hover:bg-gray-100 dark:hover:bg-accent hover:text-gray-900 dark:hover:text-accent-foreground bg-transparent"
            )}
            title={`${t('theme.toggle')}: ${getThemeDisplayName()}`}
          >
            {mounted ? (
              <>
                <Sun className={cn(
                  "h-3 w-3 transition-all",
                  resolvedTheme === 'light' ? "rotate-0 scale-100" : "-rotate-90 scale-0"
                )} />
                <Moon className={cn(
                  "absolute h-3 w-3 transition-all",
                  resolvedTheme === 'dark' ? "rotate-0 scale-100" : "rotate-90 scale-0"
                )} />
                <Sword className={cn(
                  "absolute h-3 w-3 transition-all",
                  resolvedTheme === 'adventure' ? "rotate-0 scale-100" : "rotate-90 scale-0"
                )} />
              </>
            ) : (
              <Monitor className="h-3 w-3" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent {...dropdownMenuProps}>
          {dropdownMenuItems}
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className={cn(getAdventureClasses())}
        >
          <Sun className={cn(
            "h-[1.2rem] w-[1.2rem] transition-all",
            resolvedTheme === 'light' ? "rotate-0 scale-100" : "-rotate-90 scale-0"
          )} />
          <Moon className={cn(
            "absolute h-[1.2rem] w-[1.2rem] transition-all",
            resolvedTheme === 'dark' ? "rotate-0 scale-100" : "rotate-90 scale-0"
          )} />
          <Sword className={cn(
            "absolute h-[1.2rem] w-[1.2rem] transition-all",
            resolvedTheme === 'adventure' ? "rotate-0 scale-100" : "rotate-90 scale-0"
          )} />
          <span className="sr-only">{t('theme.toggle')}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent {...dropdownMenuProps}>
        {dropdownMenuItems}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}