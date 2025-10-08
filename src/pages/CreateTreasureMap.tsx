import React from 'react';
import { DesktopHeader } from '@/components/DesktopHeader';
import { CreateTreasureMap } from '@/features/treasure-map/components/CreateTreasureMap';

export default function CreateTreasureMap() {
  return (
    <div className="h-screen flex flex-col">
      <DesktopHeader />
      
      <main className="flex-1 overflow-y-auto">
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <CreateTreasureMap />
        </div>
      </main>
    </div>
  );
}