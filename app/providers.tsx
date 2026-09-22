'use client';

import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { ThemeProvider } from '@/context/ThemeContext';
import ServiceWorkerRegister from '@/components/ServiceWorkerRegister';

/**
 * App-wide providers: React Query + Theme Provider (Light / Dark / Midnight) + PWA SW
 */
export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 3,
            retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
            staleTime: 60_000,
            gcTime: 5 * 60_000,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ServiceWorkerRegister />
        {children}
      </ThemeProvider>
    </QueryClientProvider>
  );
}
