import { z } from 'zod';

export const monthlyReportSchema = z.object({
  year: z.number().int().min(2020).max(2100),
  month: z.number().int().min(1).max(12),
});

export const efficiencyStatsSchema = z.object({
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  department: z.string().optional(),
});

export const hotspotQuerySchema = z.object({
  topN: z.number().int().min(1).max(50).default(10),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
});

export type MonthlyReportInput = z.infer<typeof monthlyReportSchema>;
export type EfficiencyStatsInput = z.infer<typeof efficiencyStatsSchema>;
export type HotspotQueryInput = z.infer<typeof hotspotQuerySchema>;
