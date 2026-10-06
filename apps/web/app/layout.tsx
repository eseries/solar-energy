import './globals.css';
import type { Metadata } from 'next';
import { AuthProvider } from '../src/components/auth-provider';

export const metadata: Metadata = { title: 'Neighbourhood Solar Energy Management System' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><AuthProvider>{children}</AuthProvider></body></html>;
}
