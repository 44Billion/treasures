import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { MobileHeader, MobileBottomNav } from "@/components/MobileNav";
import { ScrollToTop } from "@/components/ScrollToTop";
import { RadarOverlayProvider } from "@/hooks/useRadarOverlay";
import { GlobalRadarCompass } from "@/components/GlobalRadarCompass";
import { CompassSpinner } from "@/components/ui/loading";

// Import only the most critical page eagerly for instant navigation
import Home from "./pages/Home";

// Lazy load all other pages for optimal code splitting
// Map and map-heavy pages are lazy loaded to keep leaflet out of the main bundle
const Map = lazy(() => import("./pages/Map"));
const CacheDetail = lazy(() => import("./pages/CacheDetail"));
const MyCaches = lazy(() => import("./pages/MyCaches"));
const CreateCache = lazy(() => import("./pages/CreateCache"));
const CreateCacheLanding = lazy(() => import("./pages/CreateCacheLanding"));
const GenerateQR = lazy(() => import("./pages/GenerateQR"));
const Profile = lazy(() => import("./pages/Profile"));
const Settings = lazy(() => import("./pages/Settings"));
const Blog = lazy(() => import("./pages/Blog"));
const BlogPost = lazy(() => import("./pages/BlogPost"));
const Install = lazy(() => import("./pages/Install"));
const Claim = lazy(() => import("./pages/Claim"));
const About = lazy(() => import("./pages/About"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Adventures = lazy(() => import("./pages/Adventures"));
const AdventureDetail = lazy(() => import("./pages/AdventureDetail"));
const CreateAdventure = lazy(() => import("./pages/CreateAdventure"));
const CompactRedirect = lazy(() => import("./pages/CompactRedirect"));
const RemoteLoginSuccess = lazy(() => import("./pages/RemoteLoginSuccess"));

// Loading fallback for lazy-loaded routes — matches the initial-loading spinner from index.html
function PageFallback() {
  return (
    <div className="flex items-center justify-center min-h-screen overflow-hidden">
      <CompassSpinner size={64} variant="page" />
    </div>
  );
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <RadarOverlayProvider>
      {/* Scroll to top on route changes */}
      <ScrollToTop />

      {/* Mobile Header */}
      <MobileHeader />

      {/* Main Content Area - with bottom padding for mobile nav */}
      <main className="flex-1 pb-12 md:pb-0 bg-background overflow-x-hidden">
        <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/map" element={<Map />} />
            <Route path="/create" element={<CreateCacheLanding />} />
            <Route path="/create-cache" element={<CreateCache />} />
            <Route path="/generate-qr" element={<GenerateQR />} />
            <Route path="/saved" element={<MyCaches />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/profile/:pubkey" element={<Profile />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/blog" element={<Blog />} />
            <Route path="/blog/:pubkey/:dTag" element={<BlogPost />} />
            <Route path="/install" element={<Install />} />
            <Route path="/claim" element={<Claim />} />
            <Route path="/about" element={<About />} />
            <Route path="/texas-ren-fest" element={<Navigate to="/adventure/naddr1qvzqqqyj35pzppscgyy746fhmrt0nq955z6xmf80pkvrat0yq0hpknqtd00z8z68qq0xzerkv4h8gatjv5knzdehxcuryve4xuerjv3h94nrsmn2w3msduh0ez" replace />} />
            <Route path="/adventures" element={<Adventures />} />
            <Route path="/adventure/:naddr" element={<AdventureDetail />} />
            <Route path="/create-adventure" element={<CreateAdventure />} />
            <Route path="/edit-adventure/:naddr" element={<CreateAdventure />} />
            <Route path="/c/:payload" element={<CompactRedirect />} />
            <Route path="/remoteloginsuccess" element={<RemoteLoginSuccess />} />

            {/* ADD ALL CUSTOM ROUTES ABOVE THE NADDR CATCH-ALL ROUTE */}
            <Route path="/:naddr" element={<CacheDetail />} />
            <Route path="/404" element={<NotFound />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </main>

      {/* Mobile Bottom Navigation - Fixed positioned */}
      <MobileBottomNav />

      {/* Global Radar Compass overlay — accessible from anywhere */}
      <GlobalRadarCompass />
      </RadarOverlayProvider>
    </BrowserRouter>
  );
}
export default AppRouter;