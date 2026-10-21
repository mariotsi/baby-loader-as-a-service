import { NextResponse } from 'next/server';
import { ROOT_DOMAIN } from '@/lib/address';
import { appEnv } from '@/lib/appEnv';

/**
 * Which build this deployment runs and where: the E2E suite reads it to pick
 * its test database and to refuse production, and the E2E workflow polls it
 * until the commit under test is live, then tests on `rootDomain`, the host
 * the Dashboard builds Addresses on. Commit and branch are already public in
 * the repository.
 */
export function GET() {
  return NextResponse.json({
    env: appEnv(process.env),
    commit: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
    branch: process.env.VERCEL_GIT_COMMIT_REF ?? null,
    rootDomain: ROOT_DOMAIN,
  });
}
