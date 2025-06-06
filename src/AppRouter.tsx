import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Suspense, lazy } from "react";
import { FullPageLoading } from "@/components/ui/loading";
import { MobileHeader, MobileBottomNav } from "@/components/MobileNav";

// Import core/frequently used pages directly for instant navigation (no lazy loading)
import Home from "./pages/Home";
import Map from "./pages/Map";
import MyCaches from "./pages/MyCaches";
import CreateCache from "./pages/CreateCache";
import Settings from "./pages/Settings";

// Lazy load less frequently used pages (Profile typically accessed once, Install rarely used)
const CacheDetail = lazy(() => import("./pages/CacheDetail"));
const Profile = lazy(() => import("./pages/Profile"));
const Install = lazy(() => import("./pages/Install"));
const Claim = lazy(() => import("./pages/Claim"));
const NotFound = lazy(() => import("./pages/NotFound"));

export function AppRouter() {
  return (
    <BrowserRouter>
      {/* Mobile Header */}
      <MobileHeader />
      
      {/* Main Content Area - with bottom padding for mobile nav */}
      <main className="flex-1 pb-16 md:pb-0">
        <Suspense fallback={
          <FullPageLoading 
            title="Loading..."
            description="The adventure awaits"
          />
        }>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/map" element={<Map />} />
            <Route path="/create" element={<CreateCache />} />
            <Route path="/saved" element={<MyCaches />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/profile/:pubkey" element={<Profile />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/install" element={<Install />} />
            <Route path="/claim" element={<Claim />} />

            {/* ADD ALL CUSTOM ROUTES ABOVE THE NADDR CATCH-ALL ROUTE */}
            <Route path="/:naddr" element={<CacheDetail />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </main>
      
      {/* Mobile Bottom Navigation - Fixed positioned */}
      <MobileBottomNav />
    </BrowserRouter>
  );
}
export default AppRouter;