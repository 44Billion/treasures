import { useState } from "react";
import { Check, ChevronsUpDown, Plus, X, Wifi } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { useAppContext } from "@/shared/hooks/useAppContext";
import { useTheme } from "next-themes";

interface RelayComboboxProps {
  className?: string;
}

export function RelayCombobox(props: RelayComboboxProps) {
  const { className } = props;
  const { config, updateConfig, presetRelays = [] } = useAppContext();
  const { theme } = useTheme();
  const isAdventureTheme = theme === 'adventure';
  
  const [open, setOpen] = useState(false);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customUrl, setCustomUrl] = useState("");

  const selectedRelay = config.relayUrl;
  const setSelectedRelay = (relay: string) => {
    updateConfig((current) => ({ ...current, relayUrl: relay }));
  };

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

  // Handle adding a custom relay
  const handleAddCustomRelay = () => {
    if (customUrl.trim() && isValidRelayInput(customUrl)) {
      const normalizedUrl = normalizeRelayUrl(customUrl);
      setSelectedRelay(normalizedUrl);
      setCustomUrl("");
      setShowCustomInput(false);
      setOpen(false);
    }
  };

  // Handle preset relay selection
  const handlePresetSelection = (value: string) => {
    if (value === "custom") {
      setShowCustomInput(true);
    } else {
      setSelectedRelay(value);
      setOpen(false);
      setShowCustomInput(false);
    }
  };

  // Get display value for the trigger button
  const getDisplayValue = () => {
    if (selectedOption) {
      return selectedOption.name;
    }
    if (isCustomRelay) {
      return selectedRelay.replace(/^wss?:\/\//, '');
    }
    return "Select relay...";
  };

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center gap-2 justify-center">
        <Wifi className="h-4 w-4 text-muted-foreground shrink-0" />
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className={cn(
                "w-48 justify-between",
                isAdventureTheme && "!bg-stone-700 !border-stone-600 !text-stone-200 hover:!bg-stone-600 hover:!text-stone-100"
              )}
            >
              <span className="truncate">{getDisplayValue()}</span>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[300px] p-0" align="start">
            <Command>
              <CommandInput placeholder="Search relays..." />
              <CommandList>
                <CommandEmpty>No relay found.</CommandEmpty>
                <CommandGroup>
                  {presetRelays.map((relay) => (
                    <CommandItem
                      key={relay.url}
                      value={relay.url}
                      onSelect={() => handlePresetSelection(relay.url)}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          selectedRelay === relay.url ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <div className="flex flex-col">
                        <span className="font-medium">{relay.name}</span>
                        <span className="text-xs text-muted-foreground">{relay.url}</span>
                      </div>
                    </CommandItem>
                  ))}
                  <CommandItem
                    value="custom"
                    onSelect={() => handlePresetSelection("custom")}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    <span>Add custom relay...</span>
                  </CommandItem>
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        
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
            Add
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
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
}