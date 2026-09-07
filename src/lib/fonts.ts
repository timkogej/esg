import { Inter, GFS_Didot } from 'next/font/google';

// Inter — everything: body text, forms, tables, buttons, navigation.
export const inter = Inter({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-inter',
  display: 'swap',
});

// GFS Didot — display only: h1, app name/logo, hero text, large emphasized numbers.
// GFS Didot ships a single weight (400); we render it bold via CSS where needed.
export const didot = GFS_Didot({
  subsets: ['greek'],
  weight: '400',
  variable: '--font-didot',
  display: 'swap',
});
