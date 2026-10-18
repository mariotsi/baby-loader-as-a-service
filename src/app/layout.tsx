import type { Metadata } from 'next';
import './globals.css';
import { EnvironmentRibbon } from '@/components/EnvironmentRibbon';

export const metadata: Metadata = {
  title: 'Waiting Pages',
  description: 'Create a customizable countdown & announcement page for your baby, in minutes.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <EnvironmentRibbon />
      </body>
    </html>
  );
}
