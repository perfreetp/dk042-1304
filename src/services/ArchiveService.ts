import { Repository, Between } from 'typeorm';
import { Archive, Case, Report, Assignment, Disposal } from '../entities';
import { getRepository } from '../config/database';
import { PaginationResult, PaginationParams } from '../types';
import { ReportStatus } from '../types/enums';
import { calculateDaysBetween } from '../utils/helpers';

export class ArchiveService {
  private archiveRepository: Repository<Archive>;
  private caseRepository: Repository<Case>;
  private reportRepository: Repository<Report>;
  private assignmentRepository: Repository<Assignment>;
  private disposalRepository: Repository<Disposal>;

  constructor() {
    this.archiveRepository = getRepository(Archive);
    this.caseRepository = getRepository(Case);
    this.reportRepository = getRepository(Report);
    this.assignmentRepository = getRepository(Assignment);
    this.disposalRepository = getRepository(Disposal);
  }

  async archiveCase(caseId: number, archivedBy?: number): Promise<Archive> {
    const caseEntity = await this.caseRepository.findOne({
      where: { id: caseId },
      relations: ['reports', 'assignments', 'disposals'],
    });

    if (!caseEntity) {
      throw new Error('案件不存在');
    }

    if (caseEntity.status !== ReportStatus.RESOLVED && caseEntity.status !== ReportStatus.ARCHIVED) {
      throw new Error('只有已解决的案件才能归档');
    }

    const existingArchive = await this.archiveRepository.findOne({ where: { caseId } });
    if (existingArchive) {
      return existingArchive;
    }

    const reports = caseEntity.reports || [];
    const assignments = caseEntity.assignments || [];
    const disposals = caseEntity.disposals || [];

    const totalDisposalDays = caseEntity.resolvedAt
      ? calculateDaysBetween(caseEntity.createdAt, caseEntity.resolvedAt)
      : 0;

    const summary = this.generateSummary(caseEntity, reports, assignments, disposals, totalDisposalDays);

    const archive = this.archiveRepository.create({
      caseNumber: caseEntity.caseNumber,
      plateNumber: caseEntity.plateNumber,
      location: caseEntity.location,
      caseData: { ...caseEntity, reports: undefined, assignments: undefined, disposals: undefined },
      reportsData: reports,
      assignmentsData: assignments,
      disposalsData: disposals,
      summary,
      totalDisposalDays,
      remindCount: caseEntity.remindCount,
      reportCount: reports.length,
      disposalCount: disposals.length,
      firstSeenAt: caseEntity.firstSeenAt,
      resolvedAt: caseEntity.resolvedAt || new Date(),
      caseId,
      archivedBy,
    });

    await this.archiveRepository.save(archive);

    caseEntity.status = ReportStatus.ARCHIVED;
    await this.caseRepository.save(caseEntity);

    return archive;
  }

  private generateSummary(
    caseEntity: Case,
    reports: Report[],
    assignments: Assignment[],
    disposals: Disposal[],
    totalDays: number
  ): string {
    const parts: string[] = [];

    parts.push(`车牌 ${caseEntity.plateNumber} 在 ${caseEntity.location} 超时停放`);
    parts.push(`累计 ${reports.length} 次举报，${caseEntity.remindCount} 次催挪`);
    parts.push(`共分派 ${assignments.length} 次，处置 ${disposals.length} 次`);
    parts.push(`从首次发现到解决共耗时 ${totalDays} 天`);

    if (caseEntity.isBlacklisted) {
      parts.push('该车辆已纳入黑名单');
    }

    const towCount = disposals.filter(d => d.action === 'tow').length;
    if (towCount > 0) {
      parts.push(`已拖移 ${towCount} 次`);
    }

    return parts.join('；');
  }

  async batchArchive(caseIds: number[], archivedBy?: number): Promise<{ success: number; failed: number; errors: string[] }> {
    const result = { success: 0, failed: 0, errors: [] as string[] };

    for (const caseId of caseIds) {
      try {
        await this.archiveCase(caseId, archivedBy);
        result.success++;
      } catch (e: any) {
        result.failed++;
        result.errors.push(`案件 ${caseId}: ${e.message}`);
      }
    }

    return result;
  }

  async archiveResolvedCases(daysOld: number = 30, archivedBy?: number): Promise<{ archived: number; totalResolved: number }> {
    const thresholdDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);

    const resolvedCases = await this.caseRepository.find({
      where: {
        status: ReportStatus.RESOLVED,
        resolvedAt: Between(new Date(0), thresholdDate),
      },
    });

    let archived = 0;
    for (const caseEntity of resolvedCases) {
      try {
        await this.archiveCase(caseEntity.id, archivedBy);
        archived++;
      } catch (e) {
        console.error(`归档案件 ${caseEntity.id} 失败:`, e);
      }
    }

    return { archived, totalResolved: resolvedCases.length };
  }

  async getArchiveById(id: number): Promise<Archive | null> {
    return this.archiveRepository.findOne({
      where: { id },
    });
  }

  async getArchiveByCaseId(caseId: number): Promise<Archive | null> {
    return this.archiveRepository.findOne({
      where: { caseId },
    });
  }

  async getArchiveList(params: PaginationParams & {
    plateNumber?: string;
    location?: string;
    startDate?: Date;
    endDate?: Date;
    minDisposalDays?: number;
    maxDisposalDays?: number;
  }): Promise<PaginationResult<Archive>> {
    const page = params.page || 1;
    const pageSize = params.pageSize || 20;
    const skip = (page - 1) * pageSize;

    const queryBuilder = this.archiveRepository.createQueryBuilder('archive');

    if (params.plateNumber) {
      queryBuilder.andWhere('archive.plateNumber LIKE :plateNumber', {
        plateNumber: `%${params.plateNumber.toUpperCase()}%`,
      });
    }
    if (params.location) {
      queryBuilder.andWhere('archive.location LIKE :location', { location: `%${params.location}%` });
    }
    if (params.startDate) {
      queryBuilder.andWhere('archive.createdAt >= :startDate', { startDate: params.startDate });
    }
    if (params.endDate) {
      queryBuilder.andWhere('archive.createdAt <= :endDate', { endDate: params.endDate });
    }
    if (params.minDisposalDays !== undefined) {
      queryBuilder.andWhere('archive.totalDisposalDays >= :minDays', { minDays: params.minDisposalDays });
    }
    if (params.maxDisposalDays !== undefined) {
      queryBuilder.andWhere('archive.totalDisposalDays <= :maxDays', { maxDays: params.maxDisposalDays });
    }

    const [archives, total] = await queryBuilder
      .skip(skip)
      .take(pageSize)
      .orderBy('archive.createdAt', 'DESC')
      .getManyAndCount();

    return {
      data: archives,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async getArchiveStats(startDate?: Date, endDate?: Date): Promise<any> {
    let queryBuilder = this.archiveRepository.createQueryBuilder('archive');

    if (startDate) {
      queryBuilder.andWhere('archive.createdAt >= :startDate', { startDate });
    }
    if (endDate) {
      queryBuilder.andWhere('archive.createdAt <= :endDate', { endDate });
    }

    const total = await queryBuilder.getCount();

    const avgDisposalDays = await this.archiveRepository
      .createQueryBuilder('archive')
      .select('AVG(archive.totalDisposalDays)', 'avg')
      .getRawOne()
      .then(r => parseFloat(r.avg) || 0);

    const avgRemindCount = await this.archiveRepository
      .createQueryBuilder('archive')
      .select('AVG(archive.remindCount)', 'avg')
      .getRawOne()
      .then(r => parseFloat(r.avg) || 0);

    const avgReportCount = await this.archiveRepository
      .createQueryBuilder('archive')
      .select('AVG(archive.reportCount)', 'avg')
      .getRawOne()
      .then(r => parseFloat(r.avg) || 0);

    const byDisposalDaysResult = await this.archiveRepository
      .createQueryBuilder('archive')
      .select('CASE ' +
        'WHEN totalDisposalDays <= 7 THEN "1周内" ' +
        'WHEN totalDisposalDays <= 15 THEN "2周内" ' +
        'WHEN totalDisposalDays <= 30 THEN "1个月内" ' +
        'ELSE "1个月以上" END as duration, ' +
        'COUNT(*) as count')
      .groupBy('duration')
      .getRawMany();

    const byDisposalDays: Record<string, number> = {};
    byDisposalDaysResult.forEach(r => { byDisposalDays[r.duration] = parseInt(r.count); });

    return {
      total,
      avgDisposalDays: Math.round(avgDisposalDays * 10) / 10,
      avgRemindCount: Math.round(avgRemindCount * 10) / 10,
      avgReportCount: Math.round(avgReportCount * 10) / 10,
      byDisposalDays,
    };
  }

  async restoreArchive(archiveId: number): Promise<boolean> {
    const archive = await this.archiveRepository.findOne({ where: { id: archiveId } });
    if (!archive) {
      throw new Error('归档记录不存在');
    }

    const caseEntity = await this.caseRepository.findOne({ where: { id: archive.caseId } });
    if (caseEntity) {
      caseEntity.status = ReportStatus.RESOLVED;
      await this.caseRepository.save(caseEntity);
    }

    await this.archiveRepository.delete(archiveId);
    return true;
  }

  async deleteArchive(id: number): Promise<boolean> {
    const result = await this.archiveRepository.delete(id);
    return (result.affected || 0) > 0;
  }
}

export const archiveService = new ArchiveService();
