import { Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAppContext } from "@/hooks/useAppContext";
import { useTheme } from "@/hooks/useTheme";
import { RelayCombobox } from "@/components/RelayCombobox";

interface RelaySelectorProps {
  className?: string;
}

export function RelaySelector(props: RelaySelectorProps) {
  const { className } = props;
  const { t } = useTranslation();
  const { config, updateConfig, presetRelays = [] } = useAppContext();
  const { theme } = useTheme();
  const isAdventureTheme = theme === 'adventure';

  const selectedRelay = config.relayUrl;
  const setSelectedRelay = (relay: string) => {
    updateConfig((current) => ({ ...current, relayUrl: relay }));
  };

  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customUrl, setCustomUrl] = useState("");

  const selectedOption = presetRelays.find((option) => option.url === selectedRelay);
  const isCustomRelay = !selectedOption && selectedRelay;

  // Function to normalize relay URL by adding wss:// if no protocol is present
  const normalizeRelayUrl = (url: string): string => {
    const trimmed = url.trim();
    if (!trimmed) return trimmed;

    // Check if it already has a protocol
    if (trimmed.includes('://')) {
      return trimmed;
    }

    // Add wss:// prefix
    return `wss://${trimmed}`;
  };

  // Handle adding a custom relay
  const handleAddCustomRelay = () => {
    if (customUrl.trim()) {
      setSelectedRelay(normalizeRelayUrl(customUrl));
      setCustomUrl("");
      setShowCustomInput(false);
    }
  };

  // Handle preset relay selection
  const handlePresetSelection = (value: string) => {
    if (value === "custom") {
      setShowCustomInput(true);
    } else {
      setSelectedRelay(value);
      setShowCustomInput(false);
    }
  };

  // Check if input value looks like a valid relay URL
  const isValidRelayInput = (value: string): boolean => {
    const trimmed = value.trim();
    if (!trimmed) return false;

    // Basic validation - should contain at least a domain-like structure
    const normalized = normalizeRelayUrl(trimmed);
    try {
      new URL(normalized);
      return true;
    } catch {
      return false;
    }
  };

  return (
    <>
      {/* Desktop: Use combobox */}
      <div className={cn("hidden md:block", className)} data-testid="desktop-relay-selector">
        <RelayCombobox />
      </div>

      {/* Mobile: Use select dropdown */}
      <div className={cn("md:hidden space-y-2", className)} data-testid="mobile-relay-selector">
        <div className="flex items-center gap-2">
          <Select
            value={isCustomRelay ? "custom" : selectedRelay}
            onValueChange={handlePresetSelection}
          >
            <SelectTrigger
              className={cn(
                "flex-1 text-foreground",
                isAdventureTheme && "!bg-stone-700 !border-stone-600 !text-stone-200 hover:!bg-stone-600 hover:!text-stone-100"
              )}
            >
              <SelectValue placeholder={t('settings.relay.selectRelay')}>
                {selectedOption
                  ? selectedOption.name
                  : isCustomRelay
                    ? selectedRelay.replace(/^wss?:\/\//, '')
                    : t('settings.relay.selectRelay')
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {presetRelays.map((option) => (
                <SelectItem key={option.url} value={option.url}>
                  <div className="flex flex-col">
                    <span className="font-medium">{option.name}</span>
                    <span className="text-xs text-muted-foreground">{option.url}</span>
                  </div>
                </SelectItem>
              ))}
              <SelectItem value="custom">
                <div className="flex items-center">
                  <Plus className="mr-2 h-4 w-4" />
                  <span>{t('settings.relay.addCustomRelay')}</span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>

          {isCustomRelay && (
            <Button
              variant="outline"
              size="icon"
              onClick={() => {
                setSelectedRelay("");
                setShowCustomInput(false);
              }}
              className={cn(
                "shrink-0",
                isAdventureTheme && "!bg-stone-700 !border-stone-600 !text-stone-200 hover:!bg-stone-600 hover:!text-stone-100"
              )}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {showCustomInput && (
          <div className="flex items-center gap-2">
            <Input
              placeholder="wss://relay.example.com"
              value={customUrl}
              onChange={(e) => setCustomUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleAddCustomRelay();
                } else if (e.key === 'Escape') {
                  setShowCustomInput(false);
                  setCustomUrl("");
                }
              }}
              className={cn(
                "flex-1",
                isAdventureTheme && "!bg-stone-700 !border-stone-600 !text-stone-200 placeholder:!text-stone-400"
              )}
              autoFocus
            />
            <Button
              onClick={handleAddCustomRelay}
              disabled={!isValidRelayInput(customUrl)}
              size="sm"
              className={cn(
                isAdventureTheme && "!bg-stone-600 !text-stone-100 hover:!bg-stone-500"
              )}
            >
              {t('common.add')}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setShowCustomInput(false);
                setCustomUrl("");
              }}
              size="sm"
              className={cn(
                isAdventureTheme && "!bg-stone-700 !border-stone-600 !text-stone-200 hover:!bg-stone-600"
              )}
            >
              {t('common.cancel')}
            </Button>
          </div>
        )}
      </div>
    </>
  );
}