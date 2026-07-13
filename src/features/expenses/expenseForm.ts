import { z } from 'zod';

export const lineItemSchema = z.object({
  name: z.string().min(1, 'Item name required'),
  categoryId: z.string(),
  amount: z.string().min(1), // per-item (unit) price as a decimal string
  quantity: z.string().optional(), // count; blank/invalid treated as 1
  shared: z.boolean(),
  remark: z.string().optional(),
});

/** Parse a quantity string into a positive integer (blank/invalid → 1). */
export function parseQty(q: string | undefined): number {
  const n = Math.floor(Number(q));
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

export const schema = z.object({
  date: z.string().min(1, 'Date required'),
  shopName: z.string().min(1, 'Shop name is required'),
  payerUid: z.string().min(1),
  giftCardAmount: z
    .string()
    .optional()
    .refine((v) => !v || !isNaN(parseFloat(v)), { message: 'Enter a valid amount' }),
  items: z.array(lineItemSchema).min(1, 'Add at least one item'),
});

export type FormValues = z.infer<typeof schema>;
