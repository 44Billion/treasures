import { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, User, Loader2, UserCheck } from 'lucide-react';
import { nip19 } from 'nostr-tools';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useSearchProfiles } from '@/hooks/useSearchProfiles';
import { cn } from '@/lib/utils';

interface ProfileSearchProps {
  /** Called when a profile is selected, with the hex pubkey */
  onSelect: (pubkey: string) => void;
  /** Placeholder text for the input */
  placeholder?: string;
  /** Current value (npub or hex) to show as selected */
  value?: string;
  /** Whether the input is disabled */
  disabled?: boolean;
  /** Additional class names */
  className?: string;
}

export function ProfileSearch({
  onSelect,
  placeholder,
  disabled = false,
  className,
}: ProfileSearchProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [dropUp, setDropUp] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: results, isLoading, followedPubkeys } = useSearchProfiles(query);

  // Check if dropdown should flip upward
  const updateDropDirection = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    setDropUp(spaceBelow < 280);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Show results when data arrives
  useEffect(() => {
    if (results && results.length > 0 && query.trim()) {
      updateDropDirection();
      setShowResults(true);
    }
  }, [results, query, updateDropDirection]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);

    if (!val.trim()) {
      setShowResults(false);
      return;
    }

    // If it looks like a valid npub, select directly
    if (val.startsWith('npub1')) {
      try {
        const decoded = nip19.decode(val);
        if (decoded.type === 'npub') {
          onSelect(decoded.data);
          setQuery('');
          setShowResults(false);
          return;
        }
      } catch {
        // Not valid yet, continue typing
      }
    }

    // If it looks like a hex pubkey (64 hex chars)
    if (/^[0-9a-f]{64}$/i.test(val)) {
      onSelect(val.toLowerCase());
      setQuery('');
      setShowResults(false);
      return;
    }
  };

  const handleSelect = (pubkey: string) => {
    onSelect(pubkey);
    setQuery('');
    setShowResults(false);
  };

  const displayNpub = (pubkey: string) => {
    try {
      const npub = nip19.npubEncode(pubkey);
      return `${npub.slice(0, 16)}...`;
    } catch {
      return `${pubkey.slice(0, 12)}...`;
    }
  };

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={placeholder || t('profileSearch.placeholder', 'Search by name or paste npub...')}
          value={query}
          onChange={handleInputChange}
          onFocus={() => { if (results && results.length > 0 && query.trim()) setShowResults(true); }}
          disabled={disabled}
          className="pl-9 pr-8"
        />
        {isLoading && query.trim() && (
          <div className="absolute right-2.5 top-0 bottom-0 flex items-center">
            <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />
          </div>
        )}
      </div>

      {showResults && results && results.length > 0 && (
        <div className={cn(
          "absolute z-50 w-full bg-popover border rounded-lg shadow-lg overflow-hidden max-h-64 overflow-y-auto",
          dropUp ? "bottom-full mb-1" : "top-full mt-1"
        )}>
          {results.map((profile) => (
            <button
              key={profile.pubkey}
              onClick={() => handleSelect(profile.pubkey)}
              className="flex items-center gap-3 w-full px-3 py-2 text-left hover:bg-accent transition-colors"
            >
              <div className="relative shrink-0">
                <Avatar className="w-8 h-8">
                  <AvatarImage src={profile.metadata.picture} alt={profile.metadata.name} />
                  <AvatarFallback>
                    <User className="w-3 h-3" />
                  </AvatarFallback>
                </Avatar>
                {followedPubkeys.has(profile.pubkey) && (
                  <span
                    className="absolute -bottom-0.5 -right-0.5 size-4 rounded-full bg-primary flex items-center justify-center ring-2 ring-popover"
                    title="Following"
                  >
                    <UserCheck className="size-2.5 text-primary-foreground" strokeWidth={3} />
                  </span>
                )}
              </div>
              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-sm font-medium truncate">
                  {profile.metadata.name || profile.metadata.display_name || displayNpub(profile.pubkey)}
                </span>
                {profile.metadata.nip05 ? (
                  <span className="text-xs text-muted-foreground truncate">
                    {profile.metadata.nip05}
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground truncate">
                    {displayNpub(profile.pubkey)}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
