import { format } from 'date-fns';
export function monthKey(d: Date): string { return format(d, 'yyyy-MM'); }
