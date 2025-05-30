import { BrowserRouter, Route, Routes } from "react-router-dom";

import Home from "./pages/Home";
import Map from "./pages/Map";
import CreateCache from "./pages/CreateCache";
import CacheDetail from "./pages/CacheDetail";
import MyCaches from "./pages/MyCaches";
import Settings from "./pages/Settings";
import Install from "./pages/Install";

import Debug from "./pages/Debug";
import { LocationTestPage } from "./pages/LocationTestPage";
import NotFound from "./pages/NotFound";
import { MobileNav } from "@/components/MobileNav";

export function AppRouter() {
  return (
    <BrowserRouter>
      {/* Show MobileNav on all pages */}
      <MobileNav />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/map" element={<Map />} />
        <Route path="/create" element={<CreateCache />} />
        <Route path="/cache/:dtag" element={<CacheDetail />} />
        <Route path="/saved" element={<MyCaches />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/install" element={<Install />} />

        <Route path="/debug" element={<Debug />} />
        <Route path="/location-test" element={<LocationTestPage />} />
        {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
export default AppRouter;