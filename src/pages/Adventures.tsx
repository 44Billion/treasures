import { Link } from "react-router-dom";
import { Compass, Plus, MapPin } from "lucide-react";
import { DesktopHeader } from "@/components/DesktopHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAdventures } from "@/hooks/useAdventures";
import { useAuthor } from "@/hooks/useAuthor";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import type { Adventure } from "@/types/adventure";

function AdventureCard({ adventure }: { adventure: Adventure }) {
  const author = useAuthor(adventure.pubkey);
  const authorName = author.data?.metadata?.name || adventure.pubkey.slice(0, 8);
  const authorPicture = author.data?.metadata?.picture;

  return (
    <Link to={`/adventure/${adventure.naddr}`}>
      <Card className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer h-full">
        {/* Banner image */}
        {adventure.image ? (
          <div className="aspect-[2/1] bg-muted overflow-hidden">
            <img
              src={adventure.image}
              alt={adventure.title}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          </div>
        ) : (
          <div className="aspect-[2/1] bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
            <Compass className="h-10 w-10 text-primary/40" />
          </div>
        )}

        <CardContent className="p-4">
          <h3 className="font-semibold text-base mb-1 line-clamp-1">{adventure.title}</h3>

          {/* Summary */}
          {(adventure.summary || adventure.description) && (
            <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
              {adventure.summary || adventure.description}
            </p>
          )}

          {/* Meta info */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              {authorPicture && (
                <img
                  src={authorPicture}
                  alt=""
                  className="w-5 h-5 rounded-full object-cover flex-shrink-0"
                  loading="lazy"
                />
              )}
              <span className="text-xs text-muted-foreground truncate">{authorName}</span>
            </div>
            <Badge variant="secondary" className="text-xs flex-shrink-0">
              {adventure.geocacheRefs.length} {adventure.geocacheRefs.length === 1 ? 'cache' : 'caches'}
            </Badge>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function AdventureCardSkeleton() {
  return (
    <Card className="overflow-hidden h-full">
      <Skeleton className="aspect-[2/1] w-full" />
      <CardContent className="p-4 space-y-3">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
      </CardContent>
    </Card>
  );
}

export default function Adventures() {
  const { data: adventures, isLoading, isError } = useAdventures();
  const { user } = useCurrentUser();

  return (
    <div className="min-h-screen bg-background">
      <DesktopHeader />

      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Page header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-1">Adventures</h1>
            <p className="text-muted-foreground">
              Curated treasure hunts created by the community
            </p>
          </div>
          {user && (
            <Button asChild>
              <Link to="/create-adventure">
                <Plus className="h-4 w-4 mr-2" />
                Create Adventure
              </Link>
            </Button>
          )}
        </div>

        {/* Loading state */}
        {isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <AdventureCardSkeleton key={i} />
            ))}
          </div>
        )}

        {/* Error state */}
        {isError && (
          <div className="text-center py-16">
            <Compass className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-2">Failed to load adventures</h2>
            <p className="text-muted-foreground">Please check your connection and try again.</p>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !isError && adventures?.length === 0 && (
          <div className="text-center py-16">
            <Compass className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-2">No adventures yet</h2>
            <p className="text-muted-foreground mb-6">
              Be the first to create a treasure hunt for the community!
            </p>
            {user && (
              <Button asChild>
                <Link to="/create-adventure">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Adventure
                </Link>
              </Button>
            )}
          </div>
        )}

        {/* Adventures grid */}
        {!isLoading && adventures && adventures.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {adventures.map((adventure) => (
              <AdventureCard key={adventure.id} adventure={adventure} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
