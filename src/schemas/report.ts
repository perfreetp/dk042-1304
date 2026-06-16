import { z } from 'zod';
import { ReportSource, ParkingType } from '../types/enums';

export const createReportSchema = z.object({
  source: z.nativeEnum(ReportSource),
  plateNumber: z.string().min(5).max(20),
  location: z.string().min(5).max(100),
  roadSection: z.string().max(50).optional(),
  parkingType: z.nativeEnum(ParkingType),
  firstSeenAt: z.coerce.date(),
  overtimeDays: z.number().int().min(1).default(1),
  description: z.string().optional(),
  photoUrls: z.string().optional(),
  reporterName: z.string().max(50).optional(),
  reporterPhone: z.string().max(20).optional(),
  reporterId: z.number().int().optional(),
});

export const updateReportSchema = z.object({
  status: z.enum(['pending', 'merged', 'processing', 'escalated', 'resolved', 'archived']).optional(),
  description: z.string().optional(),
  photoUrls: z.string().optional(),
});

export const queryReportSchema = z.object({
  source: z.nativeEnum(ReportSource).optional(),
  plateNumber: z.string().max(20).optional(),
  status: z.enum(['pending', 'merged', 'processing', 'escalated', 'resolved', 'archived']).optional(),
  roadSection: z.string().max(50).optional(),
  parkingType: z.nativeEnum(ParkingType).optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
});

export const mergeReportSchema = z.object({
  targetCaseId: z.number().int(),
  reportIds: z.array(z.number().int()).min(1),
  mergeRemark: z.string().optional(),
});

export type CreateReportInput = z.infer<typeof createReportSchema>;
export type UpdateReportInput = z.infer<typeof updateReportSchema>;
export type QueryReportInput = z.infer<typeof queryReportSchema>;
export type MergeReportInput = z.infer<typeof mergeReportSchema>;
