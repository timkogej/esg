'use client';

import { usePathname } from 'next/navigation';
import { Sidebar } from '@/components/nav/sidebar';
import { BottomBar } from '@/components/nav/bottom-bar';

// Authenticated chrome: desktop sidebar + mobile bottom bar wrapping page content.
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-dvh">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Bottom padding on mobile leaves room for the fixed bottom bar. */}
        <main className="mx-auto w-full max-w-[1200px] flex-1 px-5 pb-[calc(7.5rem+env(safe-area-inset-bottom))] pt-6 md:px-10 md:pb-12 md:pt-9">
          <div
            key={pathname}
            className="animate-in fade-in slide-in-from-bottom-1 duration-200 ease-out motion-reduce:animate-none"
          >
            {children}
          </div>
        </main>
      </div>
      <BottomBar />
    </div>
  );
}
