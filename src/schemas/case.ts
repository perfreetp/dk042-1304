import { z } from 'zod';
import { CaseLevel, ParkingType, ReportStatus, DisposalAction, UserRole } from '../types/enums';

export const createCaseSchema = z.object({
  plateNumber: z.string().min(5).max(20),
  location: z.string().min(5).max(100),
  roadSection: z.string().max(50).optional(),
  parkingType: z.nativeEnum(ParkingType),
  level: z.nativeEnum(CaseLevel).default(CaseLevel.LEVEL_1),
  firstSeenAt: z.coerce.date(),
  description: z.string().optional(),
  photoUrls: z.string().optional(),
  vehicleId: z.number().int().optional(),
});

export const updateCaseSchema = z.object({
  level: z.nativeEnum(CaseLevel).optional(),
  status: z.nativeEnum(ReportStatus).optional(),
  description: z.string().optional(),
  photoUrls: z.string().optional(),
  currentAssigneeId: z.number().int().optional(),
  currentDepartment: z.string().max(100).optional(),
});

export const queryCaseSchema = z.object({
  plateNumber: z.string().max(20).optional(),
  status: z.nativeEnum(ReportStatus).optional(),
  level: z.nativeEnum(CaseLevel).optional(),
  roadSection: z.string().max(50).optional(),
  parkingType: z.nativeEnum(ParkingType).optional(),
  isBlacklisted: z.coerce.boolean().optional(),
  minOvertimeDays: z.coerce.number().int().optional(),
  maxOvertimeDays: z.coerce.number().int().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const assignCaseSchema = z.object({
  targetRole: z.nativeEnum(UserRole),
  targetDepartment: z.string().max(100).optional(),
  assigneeId: z.number().int().optional(),
  assignRemark: z.string().optional(),
  deadline: z.coerce.date().optional(),
  urgencyLevel: z.number().int().min(1).max(5).default(1),
});

export const escalateCaseSchema = z.object({
  targetRole: z.nativeEnum(UserRole),
  targetDepartment: z.string().max(100).optional(),
  assigneeId: z.number().int().optional(),
  reason: z.string(),
  deadline: z.coerce.date().optional(),
  urgencyLevel: z.number().int().min(1).max(5).default(3),
});

export const disposalCaseSchema = z.object({
  action: z.nativeEnum(DisposalAction),
  actionDetail: z.string().optional(),
  result: z.string().optional(),
  photoUrls: z.string().optional(),
  location: z.string().max(100).optional(),
  fineAmount: z.number().min(0).optional(),
  towCompany: z.string().max(50).optional(),
  towDestination: z.string().max(100).optional(),
  towedAt: z.coerce.date().optional(),
  ownerContacted: z.boolean().default(false),
  ownerResponse: z.string().optional(),
});

export type CreateCaseInput = z.infer<typeof createCaseSchema>;
export type UpdateCaseInput = z.infer<typeof updateCaseSchema>;
export type QueryCaseInput = z.infer<typeof queryCaseSchema>;
export type AssignCaseInput = z.infer<typeof assignCaseSchema>;
export type EscalateCaseInput = z.infer<typeof escalateCaseSchema>;
export type DisposalCaseInput = z.infer<typeof disposalCaseSchema>;
