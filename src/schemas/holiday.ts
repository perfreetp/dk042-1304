import { z } from 'zod';
import { HolidayType, DisposalAction } from '../types/enums';

export const createHolidaySchema = z.object({
  type: z.nativeEnum(HolidayType).default(HolidayType.OTHER),
  name: z.string().min(2).max(50),
  startDate: z.string().min(8).max(10),
  endDate: z.string().min(8).max(10),
  year: z.number().int().min(2020).max(2100),
  cleanupPlan: z.string().optional(),
  cleanupAreas: z.string().optional(),
  targetCaseCount: z.number().int().min(0).default(0),
  isActive: z.boolean().default(false),
  assignedTeams: z.any().optional(),
});

export const updateHolidaySchema = z.object({
  type: z.nativeEnum(HolidayType).optional(),
  name: z.string().min(2).max(50).optional(),
  startDate: z.string().min(8).max(10).optional(),
  endDate: z.string().min(8).max(10).optional(),
  year: z.number().int().min(2020).max(2100).optional(),
  cleanupPlan: z.string().optional(),
  cleanupAreas: z.string().optional(),
  targetCaseCount: z.number().int().min(0).optional(),
  completedCaseCount: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
  assignedTeams: z.any().optional(),
});

export const holidayCleanupSchema = z.object({
  holidayId: z.number().int(),
  caseIds: z.array(z.number().int()).min(1),
  action: z.enum(['assign', 'dispose', 'complete']),
  disposalAction: z.nativeEnum(DisposalAction).optional(),
  remark: z.string().optional(),
});

export type CreateHolidayInput = z.infer<typeof createHolidaySchema>;
export type UpdateHolidayInput = z.infer<typeof updateHolidaySchema>;
export type HolidayCleanupInput = z.infer<typeof holidayCleanupSchema>;
