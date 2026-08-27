import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Waiting Pages',
  description: 'Create a customizable countdown & announcement page for your baby, in minutes.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
