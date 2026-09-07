import { AuthGuard } from '@/components/auth-guard';
import { AppShell } from '@/components/nav/app-shell';
import { LocaleSync } from '@/components/locale-sync';

// Layout for the entire authenticated area. AuthGuard blocks unauthenticated
// access; AppShell provides the sidebar / bottom-bar chrome.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <LocaleSync />
      <AppShell>{children}</AppShell>
    </AuthGuard>
  );
}
