import type { Metadata } from 'next';
import { getLocale, getMessages } from 'next-intl/server';
import { inter, didot } from '@/lib/fonts';
import { AmbientGlow } from '@/components/ambient-glow';
import { Providers } from '@/components/providers';
import { APP_NAME } from '@/lib/config';
import './globals.css';

export const metadata: Metadata = {
  title: APP_NAME,
  description: 'ESG compliance customer portal',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale} suppressHydrationWarning className={`${inter.variable} ${didot.variable}`}>
      <body className="min-h-dvh font-sans antialiased">
        <Providers locale={locale} messages={messages}>
          <AmbientGlow />
          {children}
        </Providers>
      </body>
    </html>
  );
}
