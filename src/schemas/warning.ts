import { z } from 'zod';
import { WarningType } from '../types/enums';

export const createWarningSchema = z.object({
  type: z.nativeEnum(WarningType),
  title: z.string().min(2).max(200),
  content: z.string().optional(),
  plateNumber: z.string().max(20).optional(),
  location: z.string().max(100).optional(),
  roadSection: z.string().max(50).optional(),
  level: z.number().int().min(1).max(5).default(1),
  relatedCaseId: z.number().int().optional(),
  metadata: z.any().optional(),
});

export const acknowledgeWarningSchema = z.object({
  remark: z.string().optional(),
});

export const queryWarningSchema = z.object({
  type: z.nativeEnum(WarningType).optional(),
  isAcknowledged: z.coerce.boolean().optional(),
  level: z.coerce.number().int().optional(),
  plateNumber: z.string().max(20).optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateWarningInput = z.infer<typeof createWarningSchema>;
export type AcknowledgeWarningInput = z.infer<typeof acknowledgeWarningSchema>;
export type QueryWarningInput = z.infer<typeof queryWarningSchema>;
