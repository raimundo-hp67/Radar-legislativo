import { Head, Html, Main, NextScript } from 'next/document';

import { geistMono, geistSans } from '~/lib/fonts';

export default function Document() {
  return (
    <Html lang="es" className={`${geistSans.variable} ${geistMono.variable}`}>
      <Head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="alternate icon" href="/favicon.ico" sizes="32x32" />
      </Head>
      <body className="antialiased">
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
