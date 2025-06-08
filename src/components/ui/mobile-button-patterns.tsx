import React, { ReactNode } from 'react';
import { LucideIcon, Shield, Trophy, MessageSquare, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

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
        "grid w-full h-auto",
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
      "grid gap-1 sm:gap-2",
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
  defaultMethod?: 'extension' | 'key' | 'bunker';
  children: ReactNode;
  className?: string;
}

export function LoginMethodTabs({ 
  defaultMethod = 'extension', 
  children, 
  className 
}: LoginMethodTabsProps) {
  const loginMethods: MobileTabItem[] = [
    { 
      value: 'extension', 
      label: 'Extension',
      icon: Shield
    },
    { value: 'key', label: 'Nsec' },
    { value: 'bunker', label: 'Bunker' },
  ];

  // Check if extension is available
  const hasExtension = typeof window !== 'undefined' && 'nostr' in window;
  const actualDefault = hasExtension ? defaultMethod : 'key';

  return (
    <MobileTabs
      items={loginMethods}
      defaultValue={actualDefault}
      className={className}
    >
      {children}
    </MobileTabs>
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

export function MapViewTabs({ children, className, value, onValueChange, defaultValue = "list" }: MapViewTabsProps) {
  const mapTabs: MobileTabItem[] = [
    { value: 'list', label: 'List' },
    { value: 'map', label: 'Map' },
  ];

  // If controlled (value prop provided), use controlled mode
  if (value !== undefined && onValueChange) {
    return (
      <Tabs
        value={value}
        onValueChange={onValueChange}
        className={cn("w-full", className)}
      >
        <TabsList className="grid w-full h-auto grid-cols-2 mb-0">
          {mapTabs.map((item) => {
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

  // Otherwise use uncontrolled mode (original behavior)
  return (
    <MobileTabs
      items={mapTabs}
      defaultValue={defaultValue}
      className={className}
    >
      {children}
    </MobileTabs>
  );
}

// Export types for external use
export type { MobileTabItem, MobileButtonItem };