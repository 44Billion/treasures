import { useMemo } from "react";
import { Link } from "react-router-dom";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import L, { type LatLngExpression } from "leaflet";
import { MapPin, Sparkles } from "lucide-react";

import { useGeocaches } from "@/hooks/useGeocaches";
import { useGeocacheNavigation } from "@/hooks/useGeocacheNavigation";
import { calculateDistance } from "@/utils/geo";
import { getCachedCacheIcon, mapStyleToIconTheme } from "@/utils/cacheMapIcons";
import { MAP_STYLES } from "@/config/mapStyles";
import { Button } from "@/components/ui/button";
import type { Geocache } from "@/types/geocache";

/** Palmer Event Center (BOQM venue). Map centers here so the hunt's home
 *  base is always in frame, and we measure the "Austin area" radius from
 *  this point rather than an arbitrary downtown coord. */
const AUSTIN_CENTER: LatLngExpression = [30.260833, -97.7525];
const AUSTIN_LAT = 30.260833;
const AUSTIN_LNG = -97.7525;

/** Radius in km we consider "Austin area" for pre-event browsing.
 *  ~25 miles covers metro Austin including Round Rock / Cedar Park / Buda. */
const RADIUS_KM = 25 * 1.609344;

/** Suggested zoom level for the "Open the Austin map" deep link. Zoom 12
 *  shows the metro at a glance — tight enough to feel focused on Austin,
 *  wide enough to include the suburban caches in the 25-mile radius. */
const AUSTIN_MAP_ZOOM = 12;

/** Distinct pin for the BOQM venue so it stands out from cache markers.
 *  Classic teardrop pin shape filled with the BOQM pride rainbow palette,
 *  with a white "hole" in the middle. The diagonal gradient runs along
 *  the natural axis of the rotated pin so the rainbow reads cleanly. */
const venuePin = L.divIcon({
  className: "boqm-venue-pin",
  html: `<div style="
    position: relative;
    width: 28px; height: 28px;
    border-radius: 50% 50% 50% 0;
    transform: rotate(-45deg);
    background: linear-gradient(225deg,
      #ff595e 0%,
      #ff924c 18%,
      #ffca3a 36%,
      #8ac926 54%,
      #1982c4 75%,
      #6a4c93 100%);
    border: 2px solid white;
    box-shadow: 0 2px 8px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.4) inset;
  ">
    <div style="
      position: absolute;
      top: 50%; left: 50%;
      width: 10px; height: 10px;
      margin: -5px 0 0 -5px;
      border-radius: 50%;
      background: white;
      box-shadow: 0 0 0 1px rgba(0,0,0,0.15) inset;
    "></div>
  </div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 28],
  popupAnchor: [0, -26],
});

/** Cap how many markers we render so the inline map stays snappy on the
 *  marketing page. The full hunt experience lives at /map. */
const MAX_MARKERS = 50;

/**
 * Inline map of existing treasures around Austin, shown on the BOQM page
 * to logged-in users in place of the "Start your Quest" CTA. Lets them
 * warm up by hunting nearby caches before the BOQM event itself.
 */
export function AustinTreasuresMap() {
  const tile = MAP_STYLES.original;
  const iconTheme = mapStyleToIconTheme("original");
  const { navigateToGeocache } = useGeocacheNavigation();
  const { data: geocaches, isLoading } = useGeocaches();

  // Filter to caches within ~25 miles of the Palmer Event Center, dropping
  // archived / maintenance entries the same way the main Map page does.
  // De-dupe on dTag because the store can occasionally hold two revisions
  // of the same parameterized replaceable event in transit.
  const austinCaches = useMemo<Geocache[]>(() => {
    if (!geocaches) return [];
    const seen = new Set<string>();
    const result: Geocache[] = [];
    for (const g of geocaches) {
      if (!g.location?.lat || !g.location?.lng) continue;
      if (g.status === "archived" || g.status === "maintenance") continue;
      if (g.dTag && seen.has(g.dTag)) continue;
      const km = calculateDistance(
        AUSTIN_LAT,
        AUSTIN_LNG,
        g.location.lat,
        g.location.lng,
      );
      if (km > RADIUS_KM) continue;
      if (g.dTag) seen.add(g.dTag);
      result.push(g);
      if (result.length >= MAX_MARKERS) break;
    }
    return result;
  }, [geocaches]);

  return (
    <div className="mt-3">
      <div className="flex items-center justify-center gap-2 mb-3 text-xs uppercase tracking-[0.18em] text-muted-foreground">
        <MapPin className="h-3.5 w-3.5" />
        Treasures around Austin
      </div>
      <p className="text-center text-[11px] text-muted-foreground/80 max-w-xl mx-auto mb-5">
        <span className="font-medium text-foreground">Ready to adventure now?</span>{" "}
        No purchase necessary.
        <br />
        Treasures is free, open to everyone, and available to play anytime,
        anywhere.
      </p>

      {/* Primary CTA sits directly under the header so it's the first thing
          users see when scrolling to this section. The inline map below
          gives a preview; this button takes them to the real hunt. */}
      <div className="flex flex-wrap justify-center gap-2 mb-6">
        <Button asChild size="sm">
          {/* Deep-link straight into the full hunt map, pre-centered on
              the BOQM venue at metro-Austin zoom. Map.tsx reads lat/lng/zoom
              from the query string on mount. */}
          <Link
            to={`/map?lat=${AUSTIN_LAT}&lng=${AUSTIN_LNG}&zoom=${AUSTIN_MAP_ZOOM}`}
          >
            <Sparkles className="h-4 w-4 mr-2" />
            Hunt treasures around Austin
          </Link>
        </Button>
      </div>

      <div className="relative h-64 md:h-80 rounded-lg overflow-hidden border bg-muted">
        <MapContainer
          center={AUSTIN_CENTER}
          zoom={13}
          scrollWheelZoom={false}
          className="w-full h-full"
          style={{ minHeight: "100%" }}
        >
          <TileLayer attribution={tile.attribution} url={tile.url} />

          {/* BOQM venue marker — anchor point of the hunt, distinct from
              cache markers so it stays recognizable when caches cluster
              nearby. Rendered before cache markers so popups for nearby
              caches sit on top in the z-order. */}
          <Marker position={AUSTIN_CENTER} icon={venuePin}>
            <Popup>
              <div className="text-sm space-y-0.5 min-w-[180px]">
                <div className="font-medium leading-snug">
                  BOQM Austin · Palmer Event Center
                </div>
                <div className="text-xs text-muted-foreground">
                  June 6–7, 2026
                </div>
              </div>
            </Popup>
          </Marker>

          {austinCaches.map((cache) => {
            // Normalize longitude to [-180, 180] to match the main map's
            // antimeridian handling. Caches authored offline can drift
            // outside that range and Leaflet places them off-screen.
            const lng =
              ((cache.location.lng + 180) % 360 + 360) % 360 - 180;
            return (
              <Marker
                key={cache.dTag || cache.id}
                position={[cache.location.lat, lng]}
                icon={getCachedCacheIcon(cache.type, iconTheme)}
                title={cache.name}
              >
                <Popup>
                  <div className="text-sm space-y-1 min-w-[160px]">
                    <div className="font-medium leading-snug">
                      {cache.name}
                    </div>
                    <div className="text-xs text-muted-foreground capitalize">
                      {cache.type} · D{cache.difficulty}/T{cache.terrain}
                    </div>
                    <button
                      type="button"
                      onClick={() => navigateToGeocache(cache)}
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      View details →
                    </button>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>

        {/* Empty / loading state overlay — purely informational, doesn't
            block interaction with the underlying map. */}
        {!isLoading && austinCaches.length === 0 && (
          <div className="absolute inset-x-0 bottom-0 p-3 bg-background/85 backdrop-blur-sm text-center text-xs text-muted-foreground">
            No treasures spotted near Austin yet — be the first to plant one.
          </div>
        )}
      </div>

      <p className="text-[11px] text-muted-foreground text-center mt-3">
        {isLoading
          ? "Loading nearby treasures…"
          : `${austinCaches.length} treasure${austinCaches.length === 1 ? "" : "s"} within ~25 miles of the venue`}
      </p>
    </div>
  );
}
