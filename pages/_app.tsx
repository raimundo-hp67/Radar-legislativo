'use client';

import type { AppProps } from 'next/app';
import Head from 'next/head';
import dynamic from 'next/dynamic';
import { useState } from 'react';

import '@fontsource-variable/plus-jakarta-sans';
import '~/styles/globals.css';

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
    <>
      <Head>
        <title>Radar Legislativo</title>
        <meta name="description" content="Seguimiento de proyectos de ley y audiencias de lobby en Chile" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <ReactQueryProvider>
        <Component {...pageProps} />
      </ReactQueryProvider>
    </>
  );
}
