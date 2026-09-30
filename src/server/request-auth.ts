import { auth } from '@wix/essentials';

export type RentalFlowTokenInfo = {
  active?: boolean;
  instanceId?: string;
  subjectType?: string;
  [key: string]: unknown;
};

export async function requireActiveAppInstance(): Promise<RentalFlowTokenInfo> {
  const tokenInfo = await auth.getTokenInfo();

  if (!tokenInfo?.active || !tokenInfo.instanceId) {
    throw new Error('UNAUTHORIZED');
  }

  return tokenInfo as RentalFlowTokenInfo;
}

export async function requireDashboardUser(): Promise<RentalFlowTokenInfo> {
  const tokenInfo = await requireActiveAppInstance();

  if (tokenInfo.subjectType !== 'USER') {
    throw new Error('FORBIDDEN');
  }

  return tokenInfo;
}
