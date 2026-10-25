import { NextResponse } from 'next/server';
import { addressEnv, deploymentEnv } from '@/lib/env';

/**
 * Which build this deployment runs and where: the E2E suite reads it to pick
 * its test database and to refuse production, and the E2E workflow polls it
 * until the commit under test is live, then tests on `rootDomain`, the host
 * the Dashboard builds Addresses on. Commit and branch are already public in
 * the repository.
 */
export function GET() {
  const { appEnv, commit, branch } = deploymentEnv();
  return NextResponse.json({ env: appEnv, commit, branch, rootDomain: addressEnv().rootDomain });
}
