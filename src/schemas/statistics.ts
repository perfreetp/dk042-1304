import { z } from 'zod';

export const monthlyReportSchema = z.object({
  year: z.coerce.number({ invalid_type_error: 'year 必须是数字' }).int('year 必须是整数').min(2020, 'year 不能早于 2020').max(2100, 'year 不能晚于 2100'),
  month: z.coerce.number({ invalid_type_error: 'month 必须是数字' }).int('month 必须是整数').min(1, 'month 取值 1-12').max(12, 'month 取值 1-12'),
});

export const efficiencyStatsSchema = z.object({
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  department: z.string().optional(),
});

export const hotspotQuerySchema = z.object({
  topN: z.coerce.number().int().min(1).max(50).default(10),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
});

export const dashboardSchema = z.object({
  dimension: z.enum(['month', 'road', 'department']).default('month'),
  year: z.coerce.number().int().min(2020).max(2100).optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
  roadSection: z.string().optional(),
  department: z.string().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
});

export type MonthlyReportInput = z.infer<typeof monthlyReportSchema>;
export type EfficiencyStatsInput = z.infer<typeof efficiencyStatsSchema>;
export type HotspotQueryInput = z.infer<typeof hotspotQuerySchema>;
export type DashboardInput = z.infer<typeof dashboardSchema>;
