import { BrowserRouter, Route, Routes } from "react-router-dom";
import { MobileHeader, MobileBottomNav } from "@/components/MobileNav";
import { ScrollToTop } from "@/components/ScrollToTop";

// Import only the most critical page for instant navigation
import Home from "./pages/Home";
import Map from "./pages/Map";
import CacheDetail from "./pages/CacheDetail";

// Lazy load all other pages for optimal code splitting - except for Map and Details
// Group by feature for better chunk organization
import MyCaches from "./pages/MyCaches";
import CreateCache from "./pages/CreateCache";
import CreateCacheLanding from "./pages/CreateCacheLanding";
import GenerateQR from "./pages/GenerateQR";
import Profile from "./pages/Profile";
import Settings from "./pages/Settings";
import Blog from "./pages/Blog";
import BlogPost from "./pages/BlogPost";
import Install from "./pages/Install";
import Claim from "./pages/Claim";
import About from "./pages/About";
import NotFound from "./pages/NotFound";
import TexasRenFest from "./pages/TexasRenFest";
import RemoteLoginSuccess from "./pages/RemoteLoginSuccess";

export function AppRouter() {
  return (
    <BrowserRouter>
      {/* Scroll to top on route changes */}
      <ScrollToTop />

      {/* Mobile Header */}
      <MobileHeader />

      {/* Main Content Area - with bottom padding for mobile nav */}
      <main className="flex-1 pb-16 md:pb-0 bg-background">
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
          <Route path="/texas-ren-fest" element={<TexasRenFest />} />
          <Route path="/remoteloginsuccess" element={<RemoteLoginSuccess />} />

          {/* ADD ALL CUSTOM ROUTES ABOVE THE NADDR CATCH-ALL ROUTE */}
          <Route path="/:naddr" element={<CacheDetail />} />
          <Route path="/404" element={<NotFound />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>

      {/* Mobile Bottom Navigation - Fixed positioned */}
      <MobileBottomNav />
    </BrowserRouter>
  );
}
export default AppRouter;