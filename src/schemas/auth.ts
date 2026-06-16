import { z } from 'zod';
import { UserRole } from '../types/enums';

export const loginSchema = z.object({
  username: z.string().min(3).max(50),
  password: z.string().min(6).max(50),
});

export const registerSchema = z.object({
  username: z.string().min(3).max(50),
  password: z.string().min(6).max(50),
  realName: z.string().min(2).max(50),
  role: z.nativeEnum(UserRole),
  department: z.string().max(100).optional(),
  phone: z.string().max(20).optional(),
  remark: z.string().optional(),
});

export const updateUserSchema = z.object({
  realName: z.string().min(2).max(50).optional(),
  role: z.nativeEnum(UserRole).optional(),
  department: z.string().max(100).optional(),
  phone: z.string().max(20).optional(),
  isActive: z.boolean().optional(),
  remark: z.string().optional(),
});

export const changePasswordSchema = z.object({
  oldPassword: z.string().min(6).max(50),
  newPassword: z.string().min(6).max(50),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
