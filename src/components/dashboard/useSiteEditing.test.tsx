import { act, renderHook } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import { siteIdSchema, userIdSchema } from '@/db/ids';
import { slugSchema } from '@/lib/address';
import type { Site } from '@/lib/site';
import type { SiteEditing } from '@/lib/siteEditing';
import { memorySiteEditingPort } from '@/lib/siteEditingPort';
import { defaultSiteSettings } from '@/lib/siteSettings';
import { useSiteEditing } from './useSiteEditing';

const refresh = vi.fn();

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));

beforeEach(() => refresh.mockClear());

const emma: Site = {
  ...defaultSiteSettings,
  id: siteIdSchema.parse('7a2e3d4c-5b6f-4071-9283-94a516b7c8d9'),
  ownerId: userIdSchema.parse('6f1d2c3b-4a5e-4f60-8172-839405a6b7c8'),
  slug: slugSchema.parse('emma'),
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
  customDomain: null,
  customDomainVerified: false,
  babyName: 'Emma',
};

/** Saves, and lets React render what the save changed. */
function saved(editing: SiteEditing): Promise<void> {
  return act(async () => {
    await editing.getState().save();
  });
}

test('an editor keeps one Site editing for as long as it is mounted, whatever Site it is rendered with later', () => {
  const port = memorySiteEditingPort(emma);
  const { result, rerender } = renderHook(({ site }) => useSiteEditing(site, port), { initialProps: { site: emma } });
  const editing = result.current;
  act(() => editing.getState().change({ babyName: 'Sofia' }));
  rerender({ site: { ...emma, babyName: 'Anna' } });
  expect(result.current).toBe(editing);
  expect(result.current.getState().draft.babyName).toBe('Sofia');
  expect(refresh).not.toHaveBeenCalled();
});

test('each save that goes through refreshes the route once; one that does not leaves it', async () => {
  const port = memorySiteEditingPort(emma);
  const { result } = renderHook(() => useSiteEditing(emma, port));
  act(() => result.current.getState().change({ babyName: 'Sofia' }));
  await saved(result.current);
  expect(port.site().babyName).toBe('Sofia');
  expect(refresh).toHaveBeenCalledTimes(1);
  port.changeElsewhere();
  act(() => result.current.getState().change({ babyName: 'Emma' }));
  await saved(result.current);
  expect(result.current.getState().stale).toBe(true);
  expect(refresh).toHaveBeenCalledTimes(1);
});

test('without a port of its own, the editor saves through the Site’s routes', async () => {
  const asked: string[] = [];
  vi.stubGlobal('fetch', (url: string, init?: RequestInit) => {
    asked.push(`${init?.method} ${url}`);
    return Promise.resolve(Response.json({ site: { ...emma, updatedAt: '2026-10-02T00:00:00.000Z' } }));
  });
  const { result } = renderHook(() => useSiteEditing(emma));
  await saved(result.current);
  expect(asked).toStrictEqual(['PUT /api/sites/emma']);
  expect(refresh).toHaveBeenCalledTimes(1);
  vi.unstubAllGlobals();
});
