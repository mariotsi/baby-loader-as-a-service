import type { Metadata } from 'next';
import { platformLang } from '@/lib/i18nNext';
import { platformShareMeta } from '@/lib/platformShare';

/** The Dashboard's pages share as the Dashboard, with its own image. */
export async function generateMetadata(): Promise<Metadata> {
  return platformShareMeta('dashboard', await platformLang());
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return children;
}
