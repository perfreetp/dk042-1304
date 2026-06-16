import { Repository, MoreThan, ILike, In } from 'typeorm';
import { Case, Report, Assignment, Disposal, User } from '../entities';
import { getRepository } from '../config/database';
import {
  CreateCaseInput,
  UpdateCaseInput,
  QueryCaseInput,
  AssignCaseInput,
  EscalateCaseInput,
  DisposalCaseInput,
} from '../schemas';
import { PaginationResult, PaginationParams } from '../types';
import {
  CaseLevel,
  ReportStatus,
  AssignmentStatus,
  DisposalAction,
  UserRole,
  WarningType,
} from '../types/enums';
import {
  generateCaseNumber,
  determineCaseLevel,
  determineTargetRole,
  determineNextRole,
  shouldEscalate,
  calculateDaysBetween,
} from '../utils/helpers';
import { vehicleService } from './VehicleService';
import { warningService } from './WarningService';
import { blacklistService } from './BlacklistService';

export class CaseService {
  private caseRepository: Repository<Case>;
  private reportRepository: Repository<Report>;
  private assignmentRepository: Repository<Assignment>;
  private disposalRepository: Repository<Disposal>;
  private userRepository: Repository<User>;

  constructor() {
    this.caseRepository = getRepository(Case);
    this.reportRepository = getRepository(Report);
    this.assignmentRepository = getRepository(Assignment);
    this.disposalRepository = getRepository(Disposal);
    this.userRepository = getRepository(User);
  }

  async createCase(input: CreateCaseInput, creatorId?: number): Promise<Case> {
    const normalizedPlate = input.plateNumber.toUpperCase();

    const vehicle = await vehicleService.findOrCreateByPlateNumber(normalizedPlate);

    const isBlacklisted = await vehicleService.isBlacklisted(vehicle.id);

    const caseNumber = generateCaseNumber();

    const level = determineCaseLevel(
      input.firstSeenAt ? calculateDaysBetween(input.firstSeenAt) : 1,
      input.parkingType,
      0
    );

    const caseEntity = this.caseRepository.create({
      ...input,
      plateNumber: normalizedPlate,
      vehicleId: vehicle.id,
      caseNumber,
      level,
      isBlacklisted,
      reportCount: 0,
      remindCount: 0,
      totalOvertimeDays: input.firstSeenAt ? calculateDaysBetween(input.firstSeenAt) : 1,
    });

    await this.caseRepository.save(caseEntity);

    if (isBlacklisted || level >= CaseLevel.LEVEL_3) {
      await warningService.createWarningIfNotDuplicate({
        type: isBlacklisted ? WarningType.BLACKLIST : WarningType.OVERTIME,
        title: `重点关注案件：${caseEntity.caseNumber}`,
        content: `车牌 ${normalizedPlate} 在 ${input.location} 超时停放，等级 ${level}`,
        plateNumber: normalizedPlate,
        location: input.location,
        roadSection: input.roadSection,
        level: level,
        relatedCaseId: caseEntity.id,
      });
    }

    return caseEntity;
  }

  async createCaseFromReport(report: Report): Promise<Case> {
    const existingCase = await this.caseRepository.findOne({
      where: {
        plateNumber: report.plateNumber,
        status: MoreThan(ReportStatus.PENDING),
      },
      order: { createdAt: 'DESC' },
    });

    if (existingCase && existingCase.status !== ReportStatus.RESOLVED && existingCase.status !== ReportStatus.ARCHIVED) {
      return existingCase;
    }

    const level = determineCaseLevel(
      report.overtimeDays,
      report.parkingType,
      1
    );

    const isBlacklisted = report.vehicleId ? await vehicleService.isBlacklisted(report.vehicleId) : false;

    const caseEntity = this.caseRepository.create({
      caseNumber: generateCaseNumber(),
      plateNumber: report.plateNumber,
      location: report.location,
      roadSection: report.roadSection,
      parkingType: report.parkingType,
      level,
      status: ReportStatus.PENDING,
      firstSeenAt: report.firstSeenAt,
      totalOvertimeDays: report.overtimeDays,
      vehicleId: report.vehicleId,
      description: report.description,
      photoUrls: report.photoUrls,
      isBlacklisted,
      reportCount: 1,
      remindCount: 0,
    });

    await this.caseRepository.save(caseEntity);

    if (isBlacklisted || level >= CaseLevel.LEVEL_3) {
      await warningService.createWarningIfNotDuplicate({
        type: isBlacklisted ? WarningType.BLACKLIST : WarningType.OVERTIME,
        title: `重点关注案件：${caseEntity.caseNumber}`,
        content: `车牌 ${report.plateNumber} 在 ${report.location} 超时停放 ${report.overtimeDays} 天`,
        plateNumber: report.plateNumber,
        location: report.location,
        roadSection: report.roadSection,
        level: level,
        relatedCaseId: caseEntity.id,
      });
    }

    return caseEntity;
  }

  async updateCaseReportCount(caseId: number): Promise<Case> {
    const caseEntity = await this.caseRepository.findOne({ where: { id: caseId } });
    if (!caseEntity) {
      throw new Error('案件不存在');
    }

    const reports = await this.reportRepository.find({ where: { caseId } });
    const reportCount = reports.length;
    caseEntity.reportCount = reportCount;

    if (reports.length > 0) {
      const maxOvertime = Math.max(...reports.map(r => r.overtimeDays));
      caseEntity.totalOvertimeDays = maxOvertime;

      const newLevel = determineCaseLevel(maxOvertime, caseEntity.parkingType, reportCount);
      if (newLevel !== caseEntity.level) {
        caseEntity.level = newLevel;

        if (newLevel >= CaseLevel.LEVEL_3) {
          await warningService.createWarningIfNotDuplicate({
            type: WarningType.OVERTIME,
            title: `案件等级变更：${caseEntity.caseNumber}`,
            content: `因举报次数(${reportCount})或超时天数(${maxOvertime})变化，等级升级至 ${newLevel}`,
            plateNumber: caseEntity.plateNumber,
            location: caseEntity.location,
            roadSection: caseEntity.roadSection,
            level: newLevel,
            relatedCaseId: caseEntity.id,
          });
        }
      }

      const allPhotos = reports.filter(r => r.photoUrls).map(r => r.photoUrls);
      if (allPhotos.length > 0 && !caseEntity.photoUrls) {
        caseEntity.photoUrls = allPhotos[0];
      }

      const mergedCount = reports.filter(r => r.isMerged).length;
      const sourceBreakdown: Record<string, number> = {};
      reports.forEach(r => {
        sourceBreakdown[r.source] = (sourceBreakdown[r.source] || 0) + 1;
      });

      (caseEntity as any)._reportMeta = {
        totalReports: reportCount,
        mergedReports: mergedCount,
        sourceBreakdown,
      };
    }

    return this.caseRepository.save(caseEntity);
  }

  async getCaseDetail(id: number): Promise<any> {
    const caseEntity = await this.caseRepository.findOne({
      where: { id },
      relations: ['vehicle', 'reports', 'reports.reporter', 'assignments', 'assignments.assignee', 'disposals', 'disposals.operator'],
    });
    if (!caseEntity) {
      return null;
    }

    const reports = caseEntity.reports || [];
    const sourceBreakdown: Record<string, number> = {};
    reports.forEach(r => {
      sourceBreakdown[r.source] = (sourceBreakdown[r.source] || 0) + 1;
    });

    const result: any = { ...caseEntity };
    result.reportSummary = {
      total: reports.length,
      merged: reports.filter(r => r.isMerged).length,
      pending: reports.filter(r => r.status === ReportStatus.PENDING).length,
      mergedDetail: reports.filter(r => r.isMerged).map(r => ({
        reportId: r.id,
        source: r.source,
        mergeRemark: r.mergeRemark,
        reporterName: r.reporterName,
        reporterPhone: r.reporterPhone,
      })),
      sourceBreakdown,
    };
    return result;
  }

  async getCaseById(id: number): Promise<Case | null> {
    return this.caseRepository.findOne({
      where: { id },
      relations: ['vehicle', 'reports', 'assignments', 'disposals'],
    });
  }

  async getCaseByNumber(caseNumber: string): Promise<Case | null> {
    return this.caseRepository.findOne({
      where: { caseNumber },
      relations: ['vehicle', 'reports', 'assignments', 'disposals'],
    });
  }

  async getCaseList(input: QueryCaseInput): Promise<PaginationResult<Case>> {
    const page = input.page || 1;
    const pageSize = input.pageSize || 20;
    const skip = (page - 1) * pageSize;

    const queryBuilder = this.caseRepository.createQueryBuilder('case')
      .leftJoinAndSelect('case.vehicle', 'vehicle');

    if (input.plateNumber) {
      queryBuilder.andWhere('case.plateNumber LIKE :plateNumber', {
        plateNumber: `%${input.plateNumber.toUpperCase()}%`,
      });
    }
    if (input.status) {
      queryBuilder.andWhere('case.status = :status', { status: input.status });
    }
    if (input.level) {
      queryBuilder.andWhere('case.level = :level', { level: input.level });
    }
    if (input.roadSection) {
      queryBuilder.andWhere('case.roadSection LIKE :roadSection', { roadSection: `%${input.roadSection}%` });
    }
    if (input.parkingType) {
      queryBuilder.andWhere('case.parkingType = :parkingType', { parkingType: input.parkingType });
    }
    if (input.isBlacklisted !== undefined) {
      queryBuilder.andWhere('case.isBlacklisted = :isBlacklisted', { isBlacklisted: input.isBlacklisted });
    }
    if (input.minOvertimeDays !== undefined) {
      queryBuilder.andWhere('case.totalOvertimeDays >= :minDays', { minDays: input.minOvertimeDays });
    }
    if (input.maxOvertimeDays !== undefined) {
      queryBuilder.andWhere('case.totalOvertimeDays <= :maxDays', { maxDays: input.maxOvertimeDays });
    }
    if (input.startDate) {
      queryBuilder.andWhere('case.createdAt >= :startDate', { startDate: input.startDate });
    }
    if (input.endDate) {
      queryBuilder.andWhere('case.createdAt <= :endDate', { endDate: input.endDate });
    }

    const [cases, total] = await queryBuilder
      .skip(skip)
      .take(pageSize)
      .orderBy('case.level', 'DESC')
      .addOrderBy('case.createdAt', 'DESC')
      .getManyAndCount();

    return {
      data: cases,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async updateCase(id: number, input: UpdateCaseInput): Promise<Case> {
    const caseEntity = await this.caseRepository.findOne({ where: { id } });
    if (!caseEntity) {
      throw new Error('案件不存在');
    }
    Object.assign(caseEntity, input);
    return this.caseRepository.save(caseEntity);
  }

  async assignCase(caseId: number, input: AssignCaseInput, assignerId?: number): Promise<Assignment> {
    const caseEntity = await this.caseRepository.findOne({ where: { id: caseId } });
    if (!caseEntity) {
      throw new Error('案件不存在');
    }
    if (caseEntity.status === ReportStatus.RESOLVED || caseEntity.status === ReportStatus.ARCHIVED) {
      throw new Error('案件已完成或已归档，无法分派');
    }

    let assignee: User | null = null;
    if (input.assigneeId) {
      assignee = await this.userRepository.findOne({ where: { id: input.assigneeId } });
      if (!assignee) {
        throw new Error('指定的处理人不存在');
      }
    }

    const assignment = this.assignmentRepository.create({
      caseId,
      targetRole: input.targetRole,
      targetDepartment: input.targetDepartment,
      assigneeId: input.assigneeId,
      assignerId,
      assignRemark: input.assignRemark,
      deadline: input.deadline,
      urgencyLevel: input.urgencyLevel,
      status: AssignmentStatus.ASSIGNED,
      isEscalation: false,
    });

    await this.assignmentRepository.save(assignment);

    caseEntity.status = ReportStatus.PROCESSING;
    caseEntity.currentAssigneeId = input.assigneeId;
    caseEntity.currentDepartment = input.targetDepartment;
    await this.caseRepository.save(caseEntity);

    return assignment;
  }

  async autoAssignCase(caseId: number, assignerId?: number): Promise<Assignment> {
    const caseEntity = await this.caseRepository.findOne({ where: { id: caseId } });
    if (!caseEntity) {
      throw new Error('案件不存在');
    }

    const targetRole = determineTargetRole(caseEntity.level, caseEntity.parkingType);

    const users = await this.userRepository.find({
      where: { role: targetRole, isActive: true },
      take: 1,
    });

    const assigneeId = users.length > 0 ? users[0].id : undefined;

    return this.assignCase(caseId, {
      targetRole,
      assigneeId,
      urgencyLevel: caseEntity.level,
      assignRemark: '系统自动分派',
    }, assignerId);
  }

  async escalateCase(caseId: number, input: EscalateCaseInput, currentUserId?: number): Promise<Assignment> {
    const caseEntity = await this.caseRepository.findOne({ where: { id: caseId } });
    if (!caseEntity) {
      throw new Error('案件不存在');
    }

    const currentAssignment = await this.assignmentRepository.findOne({
      where: { caseId, status: AssignmentStatus.IN_PROGRESS },
      order: { createdAt: 'DESC' },
    });

    const nextLevel = Math.min(caseEntity.level + 1, CaseLevel.LEVEL_4);
    caseEntity.level = nextLevel as CaseLevel;
    caseEntity.status = ReportStatus.ESCALATED;
    caseEntity.lastEscalatedAt = new Date();

    const newAssignment = this.assignmentRepository.create({
      caseId,
      targetRole: input.targetRole,
      targetDepartment: input.targetDepartment,
      assigneeId: input.assigneeId,
      assignerId: currentUserId,
      assignRemark: input.reason,
      deadline: input.deadline,
      urgencyLevel: input.urgencyLevel,
      status: AssignmentStatus.ASSIGNED,
      isEscalation: true,
      fromAssignmentId: currentAssignment?.id,
    });

    await this.assignmentRepository.save(newAssignment);
    await this.caseRepository.save(caseEntity);

    if (currentAssignment) {
      currentAssignment.status = AssignmentStatus.ESCALATED;
      await this.assignmentRepository.save(currentAssignment);
    }

    await warningService.createWarningIfNotDuplicate({
      type: WarningType.OVERTIME,
      title: `案件升级：${caseEntity.caseNumber}`,
      content: `升级原因：${input.reason}，新等级 ${nextLevel}`,
      plateNumber: caseEntity.plateNumber,
      location: caseEntity.location,
      roadSection: caseEntity.roadSection,
      level: nextLevel,
      relatedCaseId: caseEntity.id,
    });

    return newAssignment;
  }

  async autoEscalateCase(caseId: number, currentUserId?: number): Promise<Assignment | null> {
    const caseEntity = await this.caseRepository.findOne({ where: { id: caseId } });
    if (!caseEntity) {
      throw new Error('案件不存在');
    }

    const currentAssignment = await this.assignmentRepository.findOne({
      where: { caseId },
      order: { createdAt: 'DESC' },
    });

    if (!currentAssignment) {
      return null;
    }

    const pendingDays = calculateDaysBetween(currentAssignment.createdAt);

    if (!shouldEscalate(caseEntity.remindCount, pendingDays, caseEntity.level)) {
      return null;
    }

    const nextRole = determineNextRole(currentAssignment.targetRole);

    return this.escalateCase(caseId, {
      targetRole: nextRole,
      reason: `自动升级：催挪${caseEntity.remindCount}次，待处理${pendingDays}天`,
      urgencyLevel: Math.min(caseEntity.level + 1, 5),
    }, currentUserId);
  }

  async addDisposal(caseId: number, input: DisposalCaseInput, operatorId?: number): Promise<Disposal> {
    const caseEntity = await this.caseRepository.findOne({ where: { id: caseId } });
    if (!caseEntity) {
      throw new Error('案件不存在');
    }

    const disposal = this.disposalRepository.create({
      ...input,
      caseId,
      operatorId,
    });

    await this.disposalRepository.save(disposal);

    if (input.action === DisposalAction.REMIND || input.action === DisposalAction.NOTICE) {
      caseEntity.remindCount++;
      caseEntity.lastRemindedAt = new Date();

      if (caseEntity.remindCount >= 3) {
        await warningService.createWarningIfNotDuplicate({
          type: WarningType.OVERTIME,
          title: `催挪次数预警：${caseEntity.caseNumber}`,
          content: `车牌 ${caseEntity.plateNumber} 已催挪 ${caseEntity.remindCount} 次仍未移走，建议升级处理`,
          plateNumber: caseEntity.plateNumber,
          location: caseEntity.location,
          roadSection: caseEntity.roadSection,
          level: caseEntity.level,
          relatedCaseId: caseEntity.id,
        });
      }
    }

    if (input.action === DisposalAction.TOW) {
      caseEntity.status = ReportStatus.RESOLVED;
      caseEntity.resolvedAt = new Date();

      await blacklistService.checkAndAddToBlacklist(caseEntity.vehicleId, caseId);
    }

    await this.caseRepository.save(caseEntity);

    return disposal;
  }

  async resolveCase(caseId: number, remark?: string): Promise<Case> {
    const caseEntity = await this.caseRepository.findOne({ where: { id: caseId } });
    if (!caseEntity) {
      throw new Error('案件不存在');
    }

    caseEntity.status = ReportStatus.RESOLVED;
    caseEntity.resolvedAt = new Date();

    const activeAssignments = await this.assignmentRepository.find({
      where: {
        caseId,
        status: In([AssignmentStatus.ASSIGNED, AssignmentStatus.ACCEPTED, AssignmentStatus.IN_PROGRESS]),
      },
    });

    for (const assignment of activeAssignments) {
      assignment.status = AssignmentStatus.COMPLETED;
      assignment.completedAt = new Date();
      assignment.completeRemark = remark || '案件已解决';
      await this.assignmentRepository.save(assignment);
    }

    await blacklistService.checkAndAddToBlacklist(caseEntity.vehicleId, caseId);

    return this.caseRepository.save(caseEntity);
  }

  async checkAndEscalateAll(): Promise<{ escalatedCount: number; checkedCount: number }> {
    const activeCases = await this.caseRepository.find({
      where: {
        status: In([ReportStatus.PENDING, ReportStatus.PROCESSING, ReportStatus.ESCALATED]),
      },
    });

    let escalatedCount = 0;
    const checkedCount = activeCases.length;

    for (const caseEntity of activeCases) {
      try {
        const result = await this.autoEscalateCase(caseEntity.id);
        if (result) escalatedCount++;
      } catch (e) {
        console.error(`自动升级案件 ${caseEntity.id} 失败:`, e);
      }
    }

    return { escalatedCount, checkedCount };
  }

  async getCasesByAssignee(assigneeId: number, params: PaginationParams & { status?: AssignmentStatus }): Promise<PaginationResult<Case>> {
    const page = params.page || 1;
    const pageSize = params.pageSize || 20;
    const skip = (page - 1) * pageSize;

    const assignmentQueryBuilder = this.assignmentRepository.createQueryBuilder('assignment')
      .select('DISTINCT assignment.caseId')
      .where('assignment.assigneeId = :assigneeId', { assigneeId });

    if (params.status) {
      assignmentQueryBuilder.andWhere('assignment.status = :status', { status: params.status });
    }

    const caseIds = await assignmentQueryBuilder.getRawMany().then(r => r.map(x => x.assignment_caseId));

    if (caseIds.length === 0) {
      return { data: [], total: 0, page, pageSize, totalPages: 0 };
    }

    const queryBuilder = this.caseRepository.createQueryBuilder('case')
      .where('case.id IN (:...caseIds)', { caseIds })
      .leftJoinAndSelect('case.vehicle', 'vehicle');

    const [cases, total] = await queryBuilder
      .skip(skip)
      .take(pageSize)
      .orderBy('case.level', 'DESC')
      .addOrderBy('case.createdAt', 'DESC')
      .getManyAndCount();

    return {
      data: cases,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async getCaseTimeline(caseId: number): Promise<any[]> {
    const caseEntity = await this.getCaseById(caseId);
    if (!caseEntity) {
      throw new Error('案件不存在');
    }

    const timeline: any[] = [];

    timeline.push({
      type: 'case_created',
      timestamp: caseEntity.createdAt,
      data: { caseNumber: caseEntity.caseNumber, level: caseEntity.level },
    });

    for (const report of caseEntity.reports || []) {
      const reportData: any = {
        source: report.source,
        reporter: report.reporterName,
        reporterPhone: report.reporterPhone,
        overtimeDays: report.overtimeDays,
      };
      if (report.isMerged) {
        reportData.isMerged = true;
        reportData.mergeRemark = report.mergeRemark;
      }
      timeline.push({
        type: 'report',
        timestamp: report.createdAt,
        data: reportData,
      });
    }

    const mergedReports = (caseEntity.reports || []).filter(r => r.isMerged);
    for (const merged of mergedReports) {
      timeline.push({
        type: 'report_merged',
        timestamp: merged.createdAt,
        data: {
          reportId: merged.id,
          source: merged.source,
          mergeRemark: merged.mergeRemark,
        },
      });
    }

    for (const assignment of caseEntity.assignments || []) {
      const assignmentData: any = {
        role: assignment.targetRole,
        status: assignment.status,
        isEscalation: assignment.isEscalation,
        department: assignment.targetDepartment,
        deadline: assignment.deadline,
      };
      if (assignment.assignRemark) {
        assignmentData.remark = assignment.assignRemark;
      }
      timeline.push({
        type: assignment.isEscalation ? 'escalation' : 'assignment',
        timestamp: assignment.createdAt,
        data: assignmentData,
      });
    }

    for (const disposal of caseEntity.disposals || []) {
      timeline.push({
        type: 'disposal',
        timestamp: disposal.createdAt,
        data: { 
          action: disposal.action, 
          result: disposal.result,
          actionDetail: disposal.actionDetail,
          fineAmount: disposal.fineAmount,
        },
      });
    }

    if (caseEntity.lastEscalatedAt) {
      timeline.push({
        type: 'case_escalated',
        timestamp: caseEntity.lastEscalatedAt,
        data: { newLevel: caseEntity.level },
      });
    }

    if (caseEntity.resolvedAt) {
      timeline.push({
        type: 'resolved',
        timestamp: caseEntity.resolvedAt,
        data: {},
      });
    }

    return timeline.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }
}

export const caseService = new CaseService();
