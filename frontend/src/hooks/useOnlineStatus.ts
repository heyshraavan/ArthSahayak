import { useEffect, useState } from 'react';

/**
 * Standalone subscription function to listen to network connectivity transitions.
 * Directly listens to window 'online' and 'offline' events and reads navigator.onLine.
 *
 * Strict Privacy & Architecture Invariants:
 * 1. Uses navigator.onLine only for connectivity state.
 * 2. Never uses financial calculation dataSource ('local'/'backend') as connectivity state.
 * 3. Immediately fires callback on online / offline window events.
 */
export function subscribeToOnlineStatus(callback: (isOnline: boolean) => void): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const handleOnline = () => callback(true);
  const handleOffline = () => callback(false);

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
}

/**
 * React hook tracking browser online/offline status.
 *
 * Expected behavior:
 * ONLINE -> isOnline is true (no offline banner)
 * OFFLINE -> isOnline is false (show offline status)
 * OFFLINE -> ONLINE -> immediately updates isOnline to true
 */
export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  });

  useEffect(() => {
    return subscribeToOnlineStatus(setIsOnline);
  }, []);

  return isOnline;
}
