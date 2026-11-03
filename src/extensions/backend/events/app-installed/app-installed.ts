import { appInstances } from '@wix/app-management';

/**
 * App lifecycle signals for Wix backend logs.
 * Do not log webhook payloads or mutate tenant state; Wix may retry or
 * deliver duplicate / out-of-order events.
 */
export default appInstances.onAppInstanceInstalled(() => {
  console.info('RentalFlow app lifecycle: installed');
});
