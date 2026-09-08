import { GFS_Didot, Inter } from 'next/font/google';

// Inter — everything: body text, forms, tables, buttons, navigation.
export const inter = Inter({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-inter',
  display: 'swap',
});

// GFS Didot — reserved for a small number of editorial dashboard highlights.
export const gfsDidot = GFS_Didot({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-gfs-didot',
  display: 'swap',
});
