import { useState } from 'react';
import { MoreVertical, Share2, MapPin } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { ShareDialog } from '@/components/ShareDialog';
import type { Geocache } from '@/types/geocache';

interface CacheMenuProps {
  geocache: Geocache;
  variant?: 'default' | 'compact';
  className?: string;
}

export function CacheMenu({ geocache, variant = 'default', className }: CacheMenuProps) {
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const navigate = useNavigate();

  const handleViewOnMap = () => {
    const mapUrl = `/map?lat=${geocache.location.lat}&lng=${geocache.location.lng}&zoom=16&highlight=${geocache.dTag}&tab=map`;
    navigate(mapUrl);
    setDropdownOpen(false); // Close dropdown after action
  };

  const handleShare = () => {
    setShareDialogOpen(true);
    setDropdownOpen(false); // Close dropdown after action
  };

  const buttonSize = variant === 'compact' ? 'sm' : 'icon';
  const iconSize = variant === 'compact' ? 'h-3 w-3' : 'h-4 w-4';

  return (
    <>
      <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen} modal={false}>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="ghost" 
            size={buttonSize}
            className={className}
            onClick={(e) => {
              e.stopPropagation(); // Prevent triggering parent click handlers
            }}
          >
            <MoreVertical className={iconSize} />
            <span className="sr-only">More options</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent 
          align="end" 
          className="w-48"
          onCloseAutoFocus={(e) => {
            // Prevent focus trap issues on mobile
            e.preventDefault();
          }}
        >
          <DropdownMenuItem 
            onClick={(e) => {
              e.stopPropagation();
              handleViewOnMap();
            }}
            onSelect={(e) => {
              // Prevent default select behavior that might interfere with scroll
              e.preventDefault();
              handleViewOnMap();
            }}
          >
            <MapPin className="h-4 w-4 mr-2" />
            View on Map
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem 
            onClick={(e) => {
              e.stopPropagation();
              handleShare();
            }}
            onSelect={(e) => {
              // Prevent default select behavior that might interfere with scroll
              e.preventDefault();
              handleShare();
            }}
          >
            <Share2 className="h-4 w-4 mr-2" />
            Share
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ShareDialog
        open={shareDialogOpen}
        onOpenChange={setShareDialogOpen}
        geocache={geocache}
      />
    </>
  );
}