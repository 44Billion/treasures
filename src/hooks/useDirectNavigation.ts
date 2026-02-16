import { useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Hook to detect if the current page load is a direct navigation
 * (i.e., user entered URL directly or refreshed, vs navigation within the app)
 */
export function useDirectNavigation(): boolean {
  const location = useLocation();
  const isDirectNavRef = useRef<boolean>(true); // Assume direct navigation initially
  
  useEffect(() => {
    // If we have navigation state, it means we navigated from within the app
    if (location.state) {
      isDirectNavRef.current = false;
    }
  }, [location.state]);
  
  return isDirectNavRef.current;
}