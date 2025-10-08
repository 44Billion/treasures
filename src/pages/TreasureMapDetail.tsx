import React from 'react';
import { DesktopHeader } from '@/components/DesktopHeader';
import { TreasureMapView } from '@/features/treasure-map/components/TreasureMapView';

export default function TreasureMapDetail() {
  return (
    <div className="h-screen flex flex-col">
      <DesktopHeader />
      
      <main className="flex-1 overflow-y-auto">
        <div className="container mx-auto px-4 py-8 max-w-7xl">
          <TreasureMapView />
        </div>
      </main>
    </div>
  );
}