import type { AppSettings, DocumentTemplate } from '../domain/types';
import { parseRequiredFields } from './reservation-finance';

export const defaultPublicBookingSettings: AppSettings = {
  settingsKey: 'default',
  currency: 'CAD',
  defaultBufferBeforeHours: 0,
  defaultBufferAfterHours: 0,
  taxesEnabled: true,
  tax1Name: 'TPS',
  tax1Rate: 5,
  tax2Name: 'TVQ',
  tax2Rate: 9.975,
  tax2Compound: false,
  defaultDepositEnabled: false,
  defaultDepositType: 'PERCENT',
  defaultDepositValue: 25,
};

export function requiredFieldsForDefaults(
  settings: AppSettings,
  templates: DocumentTemplate[],
): string[] {
  const ids = [
    settings.defaultQuoteTemplateId,
    settings.defaultContractTemplateId,
    settings.defaultInvoiceTemplateId,
  ].filter(Boolean);

  const fields = ids.flatMap((id) => {
    const template = templates.find(
      (candidate) => candidate._id === id && candidate.active !== false,
    );
    return parseRequiredFields(template?.requiredFieldsCsv);
  });

  return [...new Set(fields)];
}

export function validateBookingPeriod(
  startValue?: string,
  endValue?: string,
  now = Date.now(),
): { start: Date; end: Date } {
  const start = startValue ? new Date(startValue) : new Date(0);
  const end = endValue ? new Date(endValue) : new Date(0);

  if (!start.getTime() || !end.getTime() || end <= start) {
    throw new Error('INVALID_PERIOD');
  }

  const maxDuration = 366 * 24 * 60 * 60 * 1000;
  if (end.getTime() - start.getTime() > maxDuration) {
    throw new Error('PERIOD_TOO_LONG');
  }

  if (end.getTime() < now) {
    throw new Error('PAST_PERIOD');
  }

  return { start, end };
}
