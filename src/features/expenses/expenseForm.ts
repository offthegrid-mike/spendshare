import { z } from 'zod';

export const lineItemSchema = z.object({
  name: z.string().min(1, 'Item name required'),
  categoryId: z.string(),
  amount: z.string().min(1),
  shared: z.boolean(),
  remark: z.string().optional(),
});

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
