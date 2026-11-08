import { type NextRequest, NextResponse } from 'next/server';
import { requireOwnedSite } from '@/lib/ownerAccessNext';
import { routeError } from '@/lib/routeError';
import {
  MediaCachePurgeError,
  MediaNotFoundError,
  MediaTooLargeError,
  UnsupportedMediaTypeError,
} from '@/lib/siteMedia';
import { deploymentSiteMedia } from '@/lib/siteMediaNext';

type RouteContext = { params: Promise<{ slug: string }> };

function mediaError(error: unknown): NextResponse {
  if (error instanceof UnsupportedMediaTypeError) {
    return routeError(415, { code: 'unsupportedMediaType' });
  }
  if (error instanceof MediaTooLargeError) {
    return routeError(413, { code: 'mediaTooLarge' });
  }
  if (error instanceof MediaNotFoundError) {
    return routeError(404, { code: 'notFound' });
  }
  if (error instanceof MediaCachePurgeError) {
    return routeError(502, { code: 'mediaCachePurgeFailed' });
  }
  return routeError(502, { code: 'mediaStorageUnavailable' });
}

/** Accepts a multipart `file` for the authenticated Owner's Site. */
export async function POST(req: NextRequest, { params }: RouteContext) {
  const { slug } = await params;
  const access = await requireOwnedSite(req, slug);
  if ('error' in access) {
    return access.error;
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof Blob)) {
    return routeError(400, { code: 'invalidRequest' });
  }

  try {
    const media = await deploymentSiteMedia().upload(access.owned, file);
    return NextResponse.json({ media }, { status: 201 });
  } catch (error) {
    return mediaError(error);
  }
}

/** Accepts `{ key }` and deletes an upload of the authenticated Owner's Site that its settings do not use. */
export async function DELETE(req: NextRequest, { params }: RouteContext) {
  const { slug } = await params;
  const access = await requireOwnedSite(req, slug);
  if ('error' in access) {
    return access.error;
  }

  const body = (await req.json().catch(() => null)) as { key?: unknown } | null;
  try {
    await deploymentSiteMedia().remove(access.owned, body?.key);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return mediaError(error);
  }
}
