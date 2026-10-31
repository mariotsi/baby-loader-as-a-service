import { type NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/ownerAccessNext';
import { getSiteBySlug } from '@/lib/site';

/** Whether a Slug is free right now. Creating the Site still decides: someone can take it in between. */
export async function GET(req: NextRequest) {
  const access = requireUser(req);
  if ('error' in access) {
    return access.error;
  }
  const slug = req.nextUrl.searchParams.get('slug')?.trim().toLowerCase() ?? '';
  return NextResponse.json({ available: !(await getSiteBySlug(slug)) });
}
