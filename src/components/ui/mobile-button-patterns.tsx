import { ReactNode, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { LucideIcon, Shield, Trophy, MessageSquare, MapPin, List, Map, Cloud, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/shared/utils/utils';

// === MOBILE TABS ===

interface MobileTabItem {
  value: string;
  label: string;
  icon?: LucideIcon;
  count?: number;
  disabled?: boolean;
}

interface MobileTabsProps {
  items: MobileTabItem[];
  defaultValue: string;
  children: ReactNode;
  className?: string;
}

export function MobileTabs({ items, defaultValue, children, className }: MobileTabsProps) {
  const cols = items.length;

  return (
    <Tabs defaultValue={defaultValue} className={cn("w-full", className)}>
      <TabsList className={cn(
        "grid w-full h-auto bg-secondary",
        cols === 2 && "grid-cols-2",
        cols === 3 && "grid-cols-3",
        cols === 4 && "grid-cols-4",
        cols === 5 && "grid-cols-5"
      )}>
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <TabsTrigger
              key={item.value}
              value={item.value}
              disabled={item.disabled}
              className="flex items-center justify-center gap-1 sm:gap-2 text-xs sm:text-sm px-2 py-3 sm:px-3 sm:py-2 min-h-[3rem] sm:min-h-[2.5rem]"
            >
              {Icon && <Icon className="h-4 w-4 flex-shrink-0" />}
              <span className="text-xs sm:text-sm">{item.label}</span>
              {typeof item.count === 'number' && (
                <span className="text-xs sm:text-sm">({item.count})</span>
              )}
            </TabsTrigger>
          );
        })}
      </TabsList>
      {children}
    </Tabs>
  );
}

// === MOBILE BUTTON GROUPS ===

interface MobileButtonItem {
  id: string;
  label: string;
  icon?: LucideIcon;
  disabled?: boolean;
}

interface MobileButtonGroupProps {
  items: MobileButtonItem[];
  selected: string;
  onSelect: (id: string) => void;
  cols?: 2 | 3 | 4 | 5;
  variant?: 'default' | 'outline';
  size?: 'sm' | 'default' | 'lg';
  className?: string;
}

export function MobileButtonGroup({
  items,
  selected,
  onSelect,
  cols = 3,
  variant = 'outline',
  size = 'sm',
  className
}: MobileButtonGroupProps) {
  return (
    <div className={cn(
      "grid gap-1 sm:gap-2 bg-accent",
      cols === 2 && "grid-cols-2",
      cols === 3 && "grid-cols-3",
      cols === 4 && "grid-cols-4",
      cols === 5 && "grid-cols-5",
      className
    )}>
      {items.map((item) => {
        const Icon = item.icon;
        const isSelected = selected === item.id;

        return (
          <Button
            key={item.id}
            variant={isSelected ? "default" : variant}
            size={size}
            onClick={() => onSelect(item.id)}
            disabled={item.disabled}
            className="flex items-center justify-center gap-1 text-xs sm:text-sm px-2 py-2"
          >
            {Icon && <Icon className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />}
            <span className="text-xs sm:text-sm">{item.label}</span>
          </Button>
        );
      })}
    </div>
  );
}

// === LOG TYPE BUTTON GROUP (Specialized) ===

interface LogTypeButtonGroupProps {
  logType: string;
  onLogTypeChange: (type: string) => void;
  isOwner?: boolean;
  disabled?: boolean;
  className?: string;
}

export function LogTypeButtonGroup({
  logType,
  onLogTypeChange,
  isOwner = false,
  disabled = false,
  className
}: LogTypeButtonGroupProps) {
  const mainLogTypes: MobileButtonItem[] = [
    { id: 'found', label: 'Found It', icon: Trophy },
    { id: 'dnf', label: 'DNF', disabled },
    { id: 'note', label: 'Note', disabled },
  ];

  const ownerLogTypes: MobileButtonItem[] = [
    { id: 'maintenance', label: 'Maintenance', disabled },
    { id: 'archived', label: 'Archive', disabled },
  ];

  return (
    <div className={cn("space-y-3", className)}>
      <MobileButtonGroup
        items={mainLogTypes}
        selected={logType}
        onSelect={onLogTypeChange}
        cols={3}
      />

      {isOwner && (
        <div className="pt-2 border-t">
          <MobileButtonGroup
            items={ownerLogTypes}
            selected={logType}
            onSelect={onLogTypeChange}
            cols={2}
          />
        </div>
      )}
    </div>
  );
}

// === LOGIN METHOD TABS (Specialized) ===

interface LoginMethodTabsProps {
  defaultMethod?: 'extension' | 'connect' | 'key';
  children: ReactNode;
  className?: string;
  onValueChange?: (value: string) => void;
}

export function LoginMethodTabs({
  defaultMethod = 'key',
  children,
  className,
  onValueChange
}: LoginMethodTabsProps) {
  const { t } = useTranslation();

  // Check if extension is available
  const hasExtension = typeof window !== 'undefined' && 'nostr' in window;

  const loginMethods: MobileTabItem[] = useMemo(() => {
    const methods: MobileTabItem[] = [];

    // Only show extension tab if extension is available
    if (hasExtension) {
      methods.push({
        value: 'extension',
        label: t('login.tab.extension'),
        icon: Shield
      });
    }

    // Key tab (center/default) - using KeyRound icon
    methods.push({
      value: 'key',
      label: t('login.tab.nsec'),
      icon: KeyRound
    });

    // Connect tab (right) - using Cloud icon
    methods.push({
      value: 'connect',
      label: t('login.tab.connect'),
      icon: Cloud
    });

    return methods;
  }, [t, hasExtension]);

  const cols = loginMethods.length;
  const actualDefault = defaultMethod;

  return (
    <Tabs defaultValue={actualDefault} className={cn("w-full", className)} onValueChange={onValueChange}>
      <TabsList className={cn(
        "grid w-full h-auto bg-secondary",
        cols === 2 && "grid-cols-2",
        cols === 3 && "grid-cols-3"
      )}>
        {loginMethods.map((item) => {
          const Icon = item.icon;
          return (
            <TabsTrigger
              key={item.value}
              value={item.value}
              disabled={item.disabled}
              className="flex items-center justify-center gap-1 sm:gap-2 text-xs sm:text-sm px-2 py-3 sm:px-3 sm:py-2 min-h-[3rem] sm:min-h-[2.5rem]"
            >
              {Icon && <Icon className="h-4 w-4 flex-shrink-0" />}
              <span className="text-xs sm:text-sm">{item.label}</span>
              {typeof item.count === 'number' && (
                <span className="text-xs sm:text-sm">({item.count})</span>
              )}
            </TabsTrigger>
          );
        })}
      </TabsList>
      {children}
    </Tabs>
  );
}

// === CACHE DETAIL TABS (Specialized) ===

interface CacheDetailTabsProps {
  logCount?: number;
  children: ReactNode;
  className?: string;
  defaultTab?: 'logs' | 'map';
}

export function CacheDetailTabs({ logCount = 0, children, className, defaultTab = 'logs' }: CacheDetailTabsProps) {
  const detailTabs: MobileTabItem[] = [
    {
      value: 'logs',
      label: 'Logs',
      icon: MessageSquare,
      count: logCount
    },
    {
      value: 'map',
      label: 'Map',
      icon: MapPin
    },
  ];

  return (
    <MobileTabs
      items={detailTabs}
      defaultValue={defaultTab}
      className={className}
    >
      {children}
    </MobileTabs>
  );
}

// === MAP VIEW TABS (Specialized) ===

interface MapViewTabsProps {
  children: ReactNode;
  className?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  defaultValue?: string;
}

export function MapViewTabs({ children, className }: MapViewTabsProps) {
  return (
    <div className={cn("w-full h-full", className)}>
      {children}
    </div>
  );
}

// Export types for external use
export type { MobileTabItem, MobileButtonItem };