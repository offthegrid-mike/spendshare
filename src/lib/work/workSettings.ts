import type { WorkSettingsDoc } from '../../types/models';
import { DEFAULT_MINUTES } from './workTime';

export const DEFAULT_WORK_SETTINGS: WorkSettingsDoc = {
  workWeekdays: [1, 2, 3, 4, 5],
  defaultMinutes: DEFAULT_MINUTES,
  ratesCentsPerHour: {},
  trackingStartDate: null,
};

// Fills any missing field from the defaults. Always returns a new object with
// its own array and rates map, so callers can change it freely without
// touching DEFAULT_WORK_SETTINGS or the data they passed in.
export function withDefaults(
  data: Partial<WorkSettingsDoc> | undefined,
): WorkSettingsDoc {
  return {
    workWeekdays: [...(data?.workWeekdays ?? DEFAULT_WORK_SETTINGS.workWeekdays)],
    defaultMinutes: data?.defaultMinutes ?? DEFAULT_WORK_SETTINGS.defaultMinutes,
    ratesCentsPerHour: {
      ...(data?.ratesCentsPerHour ?? DEFAULT_WORK_SETTINGS.ratesCentsPerHour),
    },
    trackingStartDate:
      data?.trackingStartDate !== undefined
        ? data.trackingStartDate
        : DEFAULT_WORK_SETTINGS.trackingStartDate,
  };
}
