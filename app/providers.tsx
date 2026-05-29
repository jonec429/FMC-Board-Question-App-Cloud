'use client';

import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * App-wide React Query provider. Replaces the hand-rolled fetch/timeout/retry
 * logic that previously lived in useAdminData with battle-tested infrastructure:
 * automatic retries with backoff, caching, stale-while-revalidate, and request
 * deduplication.
 */
export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Retry transient failures (e.g. Supabase free-tier cold starts)
            // with exponential backoff before surfacing an error to the user.
            retry: 3,
            retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
            // Treat data as fresh for 60s — avoids refetch storms when navigating
            // between admin tabs. Background revalidation kicks in after that.
            staleTime: 60_000,
            // Keep unused data cached for 5 min so re-entry is instant.
            gcTime: 5 * 60_000,
          },
        },
      })
  );

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
