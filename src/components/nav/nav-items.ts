import { Home, FileText, Database, Download, LucideIcon } from 'lucide-react';

// The four primary destinations shared by the desktop sidebar and the mobile
// bottom bar (the 5th mobile slot is "More"). `labelKey` resolves against the
// `nav` i18n namespace.
export interface NavItem {
  href: string;
  labelKey: 'home' | 'documents' | 'data' | 'downloads';
  icon: LucideIcon;
}

export const PRIMARY_NAV: NavItem[] = [
  { href: '/', labelKey: 'home', icon: Home },
  { href: '/documents', labelKey: 'documents', icon: FileText },
  { href: '/data', labelKey: 'data', icon: Database },
  { href: '/downloads', labelKey: 'downloads', icon: Download },
];
