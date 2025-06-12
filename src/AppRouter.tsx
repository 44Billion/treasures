import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Suspense, lazy } from "react";
import { FullPageLoading } from "@/components/ui/loading";
import { MobileHeader, MobileBottomNav } from "@/components/MobileNav";
import { ScrollToTop } from "@/components/ScrollToTop";

// Import only the most critical page for instant navigation
import Home from "./pages/Home";
import Map from "./pages/Map";
import CacheDetail from "./pages/CacheDetail";

// Lazy load all other pages for optimal code splitting - except for Map and Details
// Group by feature for better chunk organization
const MyCaches = lazy(() => import("./pages/MyCaches"));
const CreateCache = lazy(() => import("./pages/CreateCache"));

const Profile = lazy(() => import("./pages/Profile"));
const Settings = lazy(() => import("./pages/Settings"));

const Install = lazy(() => import("./pages/Install"));
const Claim = lazy(() => import("./pages/Claim"));
const About = lazy(() => import("./pages/About"));
const NotFound = lazy(() => import("./pages/NotFound"));

export function AppRouter() {
  return (
    <BrowserRouter>
      {/* Scroll to top on route changes */}
      <ScrollToTop />
      
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
            <Route path="/about" element={<About />} />

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