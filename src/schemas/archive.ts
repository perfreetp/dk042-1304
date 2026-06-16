import { z } from 'zod';

export const queryArchiveSchema = z.object({
  plateNumber: z.string().max(20).optional(),
  location: z.string().max(100).optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  minDisposalDays: z.number().int().min(0).optional(),
  maxDisposalDays: z.number().int().min(0).optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
});

export type QueryArchiveInput = z.infer<typeof queryArchiveSchema>;
