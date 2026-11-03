import { items } from '@wix/data';
import type { AppSettings } from '../domain/types';
import { COLLECTIONS } from './collection-ids';

const SETTINGS = COLLECTIONS.appSettings;
export const DEFAULT_SETTINGS_KEY = 'default';

export async function loadDefaultAppSettings(): Promise<AppSettings | undefined> {
  const result = await items.query(SETTINGS)
    .eq('settingsKey', DEFAULT_SETTINGS_KEY)
    .limit(1)
    .find();

  return result.items?.[0] as AppSettings | undefined;
}

export async function saveDefaultAppSettings(patch: AppSettings): Promise<AppSettings> {
  const existing = await loadDefaultAppSettings();
  const payload: AppSettings = {
    ...(existing || {}),
    ...patch,
    settingsKey: DEFAULT_SETTINGS_KEY,
  };

  if (existing?._id) {
    return await items.update(SETTINGS, { ...payload, _id: existing._id }) as AppSettings;
  }

  try {
    return await items.insert(SETTINGS, payload) as AppSettings;
  } catch (error) {
    // A concurrent first save can win the unique settingsKey insert.
    // Re-read the singleton and update it instead of creating a duplicate.
    const concurrent = await loadDefaultAppSettings();
    if (!concurrent?._id) throw error;
    return await items.update(SETTINGS, {
      ...concurrent,
      ...patch,
      settingsKey: DEFAULT_SETTINGS_KEY,
      _id: concurrent._id,
    }) as AppSettings;
  }
}
