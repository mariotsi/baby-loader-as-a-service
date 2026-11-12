import { type NextRequest, NextResponse } from 'next/server';
import { type ActivityEvent, logActivity } from '@/lib/activityLog';
import type { OwnedSite } from '@/lib/ownerAccess';
import { requireOwnedSite } from '@/lib/ownerAccessNext';
import { type RouteErrorCode, routeError } from '@/lib/routeError';
import {
  MediaCachePurgeError,
  MediaNotFoundError,
  MediaTooLargeError,
  UnsupportedMediaTypeError,
} from '@/lib/siteMedia';
import { deploymentSiteMedia } from '@/lib/siteMediaNext';

type RouteContext = { params: Promise<{ slug: string }> };

function mediaErrorOf(error: unknown): [status: number, code: RouteErrorCode] {
  if (error instanceof UnsupportedMediaTypeError) {
    return [415, 'unsupportedMediaType'];
  }
  if (error instanceof MediaTooLargeError) {
    return [413, 'mediaTooLarge'];
  }
  if (error instanceof MediaNotFoundError) {
    return [404, 'notFound'];
  }
  if (error instanceof MediaCachePurgeError) {
    return [502, 'mediaCachePurgeFailed'];
  }
  return [502, 'mediaStorageUnavailable'];
}

/** Answers a failed upload or removal, and writes it to the Activity log. */
function mediaError(event: ActivityEvent, owned: OwnedSite, error: unknown): NextResponse {
  const [status, code] = mediaErrorOf(error);
  logActivity(event, { ...siteAndOwner(owned), ok: false, reason: code });
  return routeError(status, { code });
}

function siteAndOwner(owned: OwnedSite) {
  return { slug: owned.site.slug, userId: owned.owner.id };
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
    logActivity('media.upload', { ...siteAndOwner(access.owned), ok: false, reason: 'invalidRequest' });
    return routeError(400, { code: 'invalidRequest' });
  }

  try {
    const media = await deploymentSiteMedia().upload(access.owned, file);
    logActivity('media.upload', {
      ...siteAndOwner(access.owned),
      ok: true,
      key: media.key,
      type: file.type,
      bytes: file.size,
    });
    return NextResponse.json({ media }, { status: 201 });
  } catch (error) {
    return mediaError('media.upload', access.owned, error);
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
    logActivity('media.remove', { ...siteAndOwner(access.owned), ok: true, key: String(body?.key) });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return mediaError('media.remove', access.owned, error);
  }
}
