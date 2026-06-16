import * as bcrypt from 'bcryptjs';
import dayjs from 'dayjs';
import { CaseLevel, UserRole, ParkingType } from '../types/enums';

export const hashPassword = async (password: string): Promise<string> => {
  return bcrypt.hash(password, 10);
};

export const comparePassword = async (password: string, hash: string): Promise<boolean> => {
  return bcrypt.compare(password, hash);
};

export const generateCaseNumber = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `ZC-${year}${month}${day}-${random}`;
};

export const calculateDaysBetween = (start: Date, end: Date = new Date()): number => {
  const startTime = new Date(start).getTime();
  const endTime = new Date(end).getTime();
  return Math.ceil((endTime - startTime) / (1000 * 60 * 60 * 24));
};

export const determineCaseLevel = (
  overtimeDays: number,
  parkingType: ParkingType,
  reportCount: number
): CaseLevel => {
  let score = 0;

  if (overtimeDays >= 30) score += 3;
  else if (overtimeDays >= 15) score += 2;
  else if (overtimeDays >= 7) score += 1;

  if (parkingType === ParkingType.ROADSIDE) score += 2;
  else if (parkingType === ParkingType.PUBLIC) score += 1;

  if (reportCount >= 5) score += 2;
  else if (reportCount >= 3) score += 1;

  if (score >= 5) return CaseLevel.LEVEL_4;
  if (score >= 3) return CaseLevel.LEVEL_3;
  if (score >= 1) return CaseLevel.LEVEL_2;
  return CaseLevel.LEVEL_1;
};

export const determineTargetRole = (level: CaseLevel, parkingType: ParkingType): UserRole => {
  if (level === CaseLevel.LEVEL_4) {
    return UserRole.TRAFFIC_POLICE;
  }
  if (level === CaseLevel.LEVEL_3) {
    return UserRole.CHENGGUAN;
  }
  if (level === CaseLevel.LEVEL_2) {
    if (parkingType === ParkingType.COMMUNITY || parkingType === ParkingType.UNDERGROUND) {
      return UserRole.PROPERTY;
    }
    return UserRole.GRID_WORKER;
  }
  if (parkingType === ParkingType.COMMUNITY || parkingType === ParkingType.UNDERGROUND) {
    return UserRole.PROPERTY;
  }
  return UserRole.GRID_WORKER;
};

export const determineNextRole = (currentRole: UserRole): UserRole => {
  const escalationOrder: UserRole[] = [
    UserRole.PROPERTY,
    UserRole.GRID_WORKER,
    UserRole.CHENGGUAN,
    UserRole.TRAFFIC_POLICE,
  ];
  const currentIndex = escalationOrder.indexOf(currentRole);
  if (currentIndex < escalationOrder.length - 1) {
    return escalationOrder[currentIndex + 1];
  }
  return UserRole.TRAFFIC_POLICE;
};

export const shouldEscalate = (
  remindCount: number,
  pendingDays: number,
  level: CaseLevel
): boolean => {
  if (remindCount >= 3) return true;
  if (pendingDays >= 7 && level >= CaseLevel.LEVEL_2) return true;
  if (pendingDays >= 15) return true;
  return false;
};

export const getRoleDisplayName = (role: UserRole): string => {
  const roleNames: Record<UserRole, string> = {
    [UserRole.PROPERTY]: '物业',
    [UserRole.CHENGGUAN]: '城管',
    [UserRole.TRAFFIC_POLICE]: '交警',
    [UserRole.GRID_WORKER]: '社区网格员',
    [UserRole.ADMIN]: '管理员',
  };
  return roleNames[role] || role;
};

export const getLevelDisplayName = (level: CaseLevel): string => {
  const levelNames: Record<CaseLevel, string> = {
    [CaseLevel.LEVEL_1]: '一级（轻微）',
    [CaseLevel.LEVEL_2]: '二级（一般）',
    [CaseLevel.LEVEL_3]: '三级（严重）',
    [CaseLevel.LEVEL_4]: '四级（特别严重）',
  };
  return levelNames[level] || `Level ${level}`;
};

export const formatDate = (date: Date | string, format: string = 'YYYY-MM-DD HH:mm:ss'): string => {
  return dayjs(date).format(format);
};

export const normalizePlateNumber = (plate: string): string => {
  return plate.toUpperCase().replace(/\s/g, '');
};

export const isPlateDuplicate = (plate1: string, plate2: string): boolean => {
  return normalizePlateNumber(plate1) === normalizePlateNumber(plate2);
};
