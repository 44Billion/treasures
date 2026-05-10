import { Settings as SettingsIcon, Sun, Moon, Sword, Mountain, Monitor } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { DittoIcon } from '@/components/icons/DittoIcon';
import { useTheme } from '@/hooks/useTheme';
import { useActiveProfileTheme } from '@/hooks/useActiveProfileTheme';

interface PublicSettingsMenuProps {
  /**
   * Visual style for the trigger button. Defaults to a subtle ghost button so
   * the menu can sit next to other navigation buttons in the desktop header.
   */
  triggerClassName?: string;
  /**
   * Tailwind size token for the trigger button. Mirrors the parent header's
   * convention of using "default" on the adventure theme and "sm" elsewhere.
   */
  triggerSize?: 'default' | 'sm';
}

/**
 * Settings dropdown shown to logged-out visitors. Mirrors the public/no-login
 * subset of the AccountSwitcher menu — App Settings link plus the theme
 * selector — so users can still tweak appearance, language and relays without
 * signing in.
 *
 * Account-only items (profile, saved caches, switch account, log out) are
 * intentionally omitted.
 */
export function PublicSettingsMenu({
  triggerClassName = '',
  triggerSize = 'sm',
}: PublicSettingsMenuProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const { hasDittoTheme } = useActiveProfileTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size={triggerSize}
          className={triggerClassName}
          aria-label={t('navigation.appSettings')}
          title={t('navigation.appSettings')}
        >
          <SettingsIcon className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="w-56 p-2 animate-scale-in"
        align="end"
        sideOffset={8}
      >
        <DropdownMenuItem
          onClick={() => navigate('/settings')}
          className="flex items-center gap-2 cursor-pointer p-2 rounded-md"
        >
          <SettingsIcon className="w-4 h-4" />
          <span>{t('navigation.appSettings')}</span>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {/* Theme selector — same control as the AccountSwitcher menu so that
            switching to/from the public menu is visually consistent. */}
        <div className="px-2 py-1.5">
          <DropdownMenuLabel className="px-0 py-1 text-xs text-muted-foreground font-normal">
            {t('theme.toggle')}
          </DropdownMenuLabel>
          <Select value={theme} onValueChange={setTheme}>
            <SelectTrigger className="w-full">
              <SelectValue>
                <div className="flex items-center gap-2">
                  {theme === 'light' && <Sun className="h-4 w-4" />}
                  {theme === 'dark' && <Moon className="h-4 w-4" />}
                  {theme === 'adventure' && <Sword className="h-4 w-4" />}
                  {theme === 'mojave' && <Mountain className="h-4 w-4" />}
                  {theme === 'ditto' && <DittoIcon className="h-4 w-4" />}
                  {theme === 'system' && <Monitor className="h-4 w-4" />}
                  <span>
                    {theme === 'light' && t('theme.light')}
                    {theme === 'dark' && t('theme.dark')}
                    {theme === 'adventure' && t('theme.adventure')}
                    {theme === 'mojave' && t('theme.mojave')}
                    {theme === 'ditto' && t('theme.ditto')}
                    {theme === 'system' && t('theme.system')}
                  </span>
                </div>
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="z-[10000]">
              <SelectItem value="light">
                <div className="flex items-center gap-2">
                  <Sun className="h-4 w-4" />
                  {t('theme.light')}
                </div>
              </SelectItem>
              <SelectItem value="dark">
                <div className="flex items-center gap-2">
                  <Moon className="h-4 w-4" />
                  {t('theme.dark')}
                </div>
              </SelectItem>
              <SelectItem value="adventure">
                <div className="flex items-center gap-2">
                  <Sword className="h-4 w-4" />
                  {t('theme.adventure')}
                </div>
              </SelectItem>
              <SelectItem value="mojave">
                <div className="flex items-center gap-2">
                  <Mountain className="h-4 w-4" />
                  {t('theme.mojave')}
                </div>
              </SelectItem>
              {hasDittoTheme && (
                <SelectItem value="ditto">
                  <div className="flex items-center gap-2">
                    <DittoIcon className="h-4 w-4" />
                    {t('theme.ditto')}
                  </div>
                </SelectItem>
              )}
              <SelectItem value="system">
                <div className="flex items-center gap-2">
                  <Monitor className="h-4 w-4" />
                  {t('theme.system')}
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
