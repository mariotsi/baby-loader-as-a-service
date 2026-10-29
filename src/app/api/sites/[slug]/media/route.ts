import { type NextRequest, NextResponse } from 'next/server';
import { requireOwnedSite } from '@/lib/ownerAccessNext';
import { routeError } from '@/lib/routeError';
import {
  getStorageProvider,
  InvalidMediaKeyError,
  MediaCachePurgeError,
  MediaOwnershipError,
  MediaTooLargeError,
  UnsupportedMediaTypeError,
} from '@/lib/storage';

type RouteContext = { params: Promise<{ slug: string }> };

function storageError(error: unknown): NextResponse {
  if (error instanceof UnsupportedMediaTypeError) {
    return routeError(415, { code: 'unsupportedMediaType' });
  }
  if (error instanceof MediaTooLargeError) {
    return routeError(413, { code: 'mediaTooLarge' });
  }
  if (error instanceof MediaOwnershipError) {
    return routeError(404, { code: 'notFound' });
  }
  if (error instanceof InvalidMediaKeyError) {
    return routeError(400, { code: 'invalidRequest' });
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
    const media = await getStorageProvider().upload({ site: access.owned, file });
    return NextResponse.json({ media }, { status: 201 });
  } catch (error) {
    return storageError(error);
  }
}

/** Accepts `{ key }` and deletes media only within the authenticated Owner's Site folder. */
export async function DELETE(req: NextRequest, { params }: RouteContext) {
  const { slug } = await params;
  const access = await requireOwnedSite(req, slug);
  if ('error' in access) {
    return access.error;
  }

  const body = (await req.json().catch(() => null)) as { key?: unknown } | null;
  if (typeof body?.key !== 'string' || !body.key) {
    return routeError(400, { code: 'invalidRequest' });
  }

  try {
    await getStorageProvider().delete(access.owned, body.key);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return storageError(error);
  }
}
