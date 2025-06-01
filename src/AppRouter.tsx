import { BrowserRouter, Route, Routes } from "react-router-dom";

import Home from "./pages/Home";
import Map from "./pages/Map";
import CreateCache from "./pages/CreateCache";
import CacheDetail from "./pages/CacheDetail";
import MyCaches from "./pages/MyCaches";
import Profile from "./pages/Profile";
import Settings from "./pages/Settings";
import Install from "./pages/Install";

import NotFound from "./pages/NotFound";
import { MobileHeader, MobileBottomNav } from "@/components/MobileNav";

export function AppRouter() {
  return (
    <BrowserRouter>
      {/* Mobile Header */}
      <MobileHeader />
      
      {/* Main Content Area - with bottom padding for mobile nav */}
      <main className="flex-1 pb-16 md:pb-0">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/map" element={<Map />} />
          <Route path="/create" element={<CreateCache />} />
          <Route path="/saved" element={<MyCaches />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/profile/:pubkey" element={<Profile />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/install" element={<Install />} />

          {/* ADD ALL CUSTOM ROUTES ABOVE THE NADDR CATCH-ALL ROUTE */}
          <Route path="/:naddr" element={<CacheDetail />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      
      {/* Mobile Bottom Navigation - Fixed positioned */}
      <MobileBottomNav />
    </BrowserRouter>
  );
}
export default AppRouter;