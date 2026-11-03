import { auth } from '@wix/essentials';

export async function requireActiveAppInstance() {
  const tokenInfo = await auth.getTokenInfo();

  if (!tokenInfo?.active || !tokenInfo.instanceId) {
    throw new Error('UNAUTHORIZED');
  }

  return tokenInfo;
}

export async function requireDashboardUser() {
  const tokenInfo = await requireActiveAppInstance();

  if (tokenInfo.subjectType !== 'USER') {
    throw new Error('FORBIDDEN');
  }

  return tokenInfo;
}
