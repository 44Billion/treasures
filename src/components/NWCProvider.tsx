import { useNWCInternal } from '@/hooks/useNWC';
import { NWCContext } from '@/hooks/useNWCContext';
import { ReactNode } from 'react';

interface NWCProviderProps {
  children: ReactNode;
}

export function NWCProvider({ children }: NWCProviderProps) {
  const nwcValue = useNWCInternal();

  return (
    <NWCContext.Provider value={nwcValue}>
      {children}
    </NWCContext.Provider>
  );
}