import type { User } from 'firebase/auth';
import { createGroup } from '../createGroup';
import { validateTripInput, type TripInput } from './trips';

export const TRAVEL_CATEGORIES = ['Accommodation', 'Transport', 'Food', 'Activities', 'Shopping', 'Fees', 'Other'] as const;

/**
 * Creates a trip: a group with kind 'trip', its dates, and travel categories.
 * `currency` is the trip's home currency, the one balances settle in.
 * Throws the validation message for invalid input, before writing anything.
 */
export async function createTrip(user: User, input: TripInput & { currency: string }): Promise<string> {
  const problem = validateTripInput(input);
  if (problem) throw new Error(problem);
  return createGroup(
    user,
    { name: input.name, currency: input.currency },
    { extra: { kind: 'trip', trip: { startDate: input.startDate, endDate: input.endDate } }, categories: TRAVEL_CATEGORIES },
  );
}
