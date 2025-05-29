import { BrowserRouter, Route, Routes } from "react-router-dom";

import Home from "./pages/Home";
import Map from "./pages/Map";
import CreateCache from "./pages/CreateCache";
import CacheDetail from "./pages/CacheDetail";
import Settings from "./pages/Settings";
import SensorTest from "./pages/SensorTest";
import BasicSensorTest from "./pages/BasicSensorTest";
import ModernSensorTest from "./pages/ModernSensorTest";
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
        <Route path="/settings" element={<Settings />} />
        <Route path="/sensor-test" element={<SensorTest />} />
        <Route path="/basic-sensor-test" element={<BasicSensorTest />} />
        <Route path="/modern-sensor-test" element={<ModernSensorTest />} />
        {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
export default AppRouter;