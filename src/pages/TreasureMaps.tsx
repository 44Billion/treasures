import React from 'react';
import { DesktopHeader } from '@/components/DesktopHeader';
import { TreasureMapsList } from '@/features/treasure-map/components/TreasureMapsList';

export default function TreasureMaps() {
  return (
    <div className="h-screen flex flex-col">
      <DesktopHeader />
      
      <main className="flex-1 overflow-y-auto">
        <div className="container mx-auto px-4 py-8 max-w-6xl">
          <TreasureMapsList />
        </div>
      </main>
    </div>
  );
}