'use client';

import type { AppProps } from 'next/app';
import dynamic from 'next/dynamic';
import { useState } from 'react';

import '~/assets/globals.css';

const ReactQueryProvider = dynamic(
  () => import('@tanstack/react-query').then((mod) => {
    const { QueryClient, QueryClientProvider } = mod;

    function Provider({ children }: { children: React.ReactNode }) {
      const [queryClient] = useState(() => new QueryClient());
      return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
    }

    return Provider;
  }),
  { ssr: false },
);

export default function App({ Component, pageProps }: AppProps) {
  return (
    <ReactQueryProvider>
      <Component {...pageProps} />
    </ReactQueryProvider>
  );
}
