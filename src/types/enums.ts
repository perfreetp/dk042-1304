export enum UserRole {
  PROPERTY = 'property',
  CHENGGUAN = 'chengguan',
  TRAFFIC_POLICE = 'traffic_police',
  GRID_WORKER = 'grid_worker',
  ADMIN = 'admin',
}

export enum ReportSource {
  RESIDENT = 'resident',
  PROPERTY = 'property',
  PATROL = 'patrol',
  TOW_RESULT = 'tow_result',
}

export enum ReportStatus {
  PENDING = 'pending',
  MERGED = 'merged',
  PROCESSING = 'processing',
  ESCALATED = 'escalated',
  RESOLVED = 'resolved',
  ARCHIVED = 'archived',
}

export enum CaseLevel {
  LEVEL_1 = 1,
  LEVEL_2 = 2,
  LEVEL_3 = 3,
  LEVEL_4 = 4,
}

export enum ParkingType {
  ROADSIDE = 'roadside',
  COMMUNITY = 'community',
  PUBLIC = 'public',
  UNDERGROUND = 'underground',
  COMMERCIAL = 'commercial',
}

export enum DisposalAction {
  NOTICE = 'notice',
  REMIND = 'remind',
  WARNING = 'warning',
  TOW = 'tow',
  FINE = 'fine',
  OTHER = 'other',
}

export enum AssignmentStatus {
  ASSIGNED = 'assigned',
  ACCEPTED = 'accepted',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  REJECTED = 'rejected',
  ESCALATED = 'escalated',
}

export enum WarningType {
  OVERTIME = 'overtime',
  HOTSPOT = 'hotspot',
  BLACKLIST = 'blacklist',
  HOLIDAY = 'holiday',
}

export enum HolidayType {
  SPRING_FESTIVAL = 'spring_festival',
  NATIONAL_DAY = 'national_day',
  LABOR_DAY = 'labor_day',
  DRAGON_BOAT = 'dragon_boat',
  MID_AUTUMN = 'mid_autumn',
  OTHER = 'other',
}
