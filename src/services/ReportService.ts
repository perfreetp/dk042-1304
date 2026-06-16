import { Repository, MoreThan, And, Equal, ILike } from 'typeorm';
import { Report, Case, Vehicle } from '../entities';
import { getRepository } from '../config/database';
import { CreateReportInput, UpdateReportInput, QueryReportInput, MergeReportInput } from '../schemas';
import { PaginationResult, PaginationParams } from '../types';
import { ReportStatus, ReportSource } from '../types/enums';
import { vehicleService } from './VehicleService';
import { caseService } from './CaseService';
import { isPlateDuplicate, calculateDaysBetween } from '../utils/helpers';

export class ReportService {
  private reportRepository: Repository<Report>;
  private caseRepository: Repository<Case>;
  private vehicleRepository: Repository<Vehicle>;

  constructor() {
    this.reportRepository = getRepository(Report);
    this.caseRepository = getRepository(Case);
    this.vehicleRepository = getRepository(Vehicle);
  }

  async createReport(input: CreateReportInput, reporterId?: number): Promise<{ report: Report; case: Case | null; isNewCase: boolean }> {
    const normalizedPlate = input.plateNumber.toUpperCase();

    const vehicle = await vehicleService.findOrCreateByPlateNumber(normalizedPlate);

    const report = this.reportRepository.create({
      ...input,
      plateNumber: normalizedPlate,
      vehicleId: vehicle.id,
      reporterId,
      source: input.source,
    });

    await this.reportRepository.save(report);

    const { existingCase, shouldMerge } = await this.checkForDuplicate(report);

    let createdCase: Case | null = null;
    let isNewCase = false;

    if (existingCase && shouldMerge) {
      const mergedReport = await this.mergeReportToCase(report.id, existingCase.id, '自动合并：同一车牌多次举报');
      report.isMerged = mergedReport.isMerged;
      report.status = mergedReport.status;
      report.mergeRemark = mergedReport.mergeRemark;
      createdCase = existingCase;
    } else {
      createdCase = await caseService.createCaseFromReport(report);
      isNewCase = true;
    }

    report.caseId = createdCase.id;
    await this.reportRepository.save(report);

    return { report, case: createdCase, isNewCase };
  }

  async checkForDuplicate(report: Report): Promise<{ existingCase: Case | null; shouldMerge: boolean }> {
    const timeWindowHours = 72;
    const timeThreshold = new Date(report.createdAt.getTime() - timeWindowHours * 60 * 60 * 1000);

    const existingReports = await this.reportRepository.find({
      where: {
        plateNumber: report.plateNumber,
        createdAt: MoreThan(timeThreshold),
      },
      relations: ['case'],
    });

    for (const existingReport of existingReports) {
      if (existingReport.id === report.id) continue;
      if (!existingReport.caseId) continue;

      const isSameLocation = this.isSameLocation(existingReport.location, report.location);
      const isSameRoadSection = !existingReport.roadSection || !report.roadSection ||
        existingReport.roadSection === report.roadSection;

      if (isSameLocation && isSameRoadSection) {
        const existingCase = existingReport.case;
        if (existingCase && existingCase.status !== ReportStatus.RESOLVED && existingCase.status !== ReportStatus.ARCHIVED) {
          return { existingCase, shouldMerge: true };
        }
      }
    }

    const existingCase = await this.caseRepository.findOne({
      where: {
        plateNumber: report.plateNumber,
        location: ILike(`%${report.location}%`),
      },
      order: { createdAt: 'DESC' },
    });

    if (existingCase) {
      const daysSinceLastUpdate = calculateDaysBetween(existingCase.updatedAt);
      if (daysSinceLastUpdate < 7 && existingCase.status !== ReportStatus.RESOLVED && existingCase.status !== ReportStatus.ARCHIVED) {
        return { existingCase, shouldMerge: true };
      }
    }

    return { existingCase: null, shouldMerge: false };
  }

  private isSameLocation(loc1: string, loc2: string): boolean {
    if (!loc1 || !loc2) return false;
    const normalize = (s: string) => s.toLowerCase().replace(/[\s,，。、]/g, '');
    const n1 = normalize(loc1);
    const n2 = normalize(loc2);
    return n1.includes(n2) || n2.includes(n1) || this.calculateSimilarity(n1, n2) > 0.7;
  }

  private calculateSimilarity(s1: string, s2: string): number {
    const longer = s1.length > s2.length ? s1 : s2;
    const shorter = s1.length > s2.length ? s2 : s1;
    if (longer.length === 0) return 1.0;

    const costs: number[] = [];
    for (let i = 0; i <= shorter.length; i++) {
      let lastValue = i;
      for (let j = 0; j <= longer.length; j++) {
        if (i === 0) {
          costs[j] = j;
        } else if (j > 0) {
          let newValue = costs[j - 1];
          if (shorter.charAt(i - 1) !== longer.charAt(j - 1)) {
            newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
          }
          costs[j - 1] = lastValue;
          lastValue = newValue;
        }
      }
      if (i > 0) costs[longer.length] = lastValue;
    }
    return (longer.length - costs[longer.length]) / longer.length;
  }

  async mergeReportToCase(reportId: number, caseId: number, mergeRemark?: string): Promise<Report> {
    const report = await this.reportRepository.findOne({ where: { id: reportId } });
    if (!report) {
      throw new Error('举报记录不存在');
    }

    const targetCase = await this.caseRepository.findOne({ where: { id: caseId } });
    if (!targetCase) {
      throw new Error('目标案件不存在');
    }

    report.caseId = caseId;
    report.isMerged = true;
    report.mergeRemark = mergeRemark || `合并至案件 ${targetCase.caseNumber}`;
    report.status = ReportStatus.MERGED;

    await this.reportRepository.save(report);

    const updatedCase = await caseService.updateCaseReportCount(caseId);

    const allReports = await this.reportRepository.find({ 
      where: { caseId }, 
      order: { firstSeenAt: 'ASC' } 
    });
    if (allReports.length > 0) {
      const earliestFirstSeen = allReports[0].firstSeenAt;
      if (earliestFirstSeen < updatedCase.firstSeenAt) {
        updatedCase.firstSeenAt = earliestFirstSeen;
        updatedCase.totalOvertimeDays = Math.max(...allReports.map(r => r.overtimeDays));
        await this.caseRepository.save(updatedCase);
      }
    }

    return report;
  }

  async mergeReports(input: MergeReportInput): Promise<{ success: boolean; mergedCount: number; case: Case }> {
    const targetCase = await this.caseRepository.findOne({ where: { id: input.targetCaseId } });
    if (!targetCase) {
      throw new Error('目标案件不存在');
    }

    let mergedCount = 0;

    for (const reportId of input.reportIds) {
      try {
        await this.mergeReportToCase(reportId, input.targetCaseId, input.mergeRemark);
        mergedCount++;
      } catch (e) {
        console.error(`合并举报 ${reportId} 失败:`, e);
      }
    }

    const updatedCase = await caseService.updateCaseReportCount(input.targetCaseId);

    return { success: true, mergedCount, case: updatedCase };
  }

  async getReportById(id: number): Promise<Report | null> {
    return this.reportRepository.findOne({
      where: { id },
      relations: ['vehicle', 'case', 'reporter'],
    });
  }

  async getReportList(input: QueryReportInput): Promise<PaginationResult<Report>> {
    const page = input.page || 1;
    const pageSize = input.pageSize || 20;
    const skip = (page - 1) * pageSize;

    const queryBuilder = this.reportRepository.createQueryBuilder('report')
      .leftJoinAndSelect('report.vehicle', 'vehicle')
      .leftJoinAndSelect('report.case', 'case')
      .leftJoinAndSelect('report.reporter', 'reporter');

    if (input.source) {
      queryBuilder.andWhere('report.source = :source', { source: input.source });
    }
    if (input.plateNumber) {
      queryBuilder.andWhere('report.plateNumber LIKE :plateNumber', {
        plateNumber: `%${input.plateNumber.toUpperCase()}%`,
      });
    }
    if (input.status) {
      queryBuilder.andWhere('report.status = :status', { status: input.status });
    }
    if (input.roadSection) {
      queryBuilder.andWhere('report.roadSection LIKE :roadSection', { roadSection: `%${input.roadSection}%` });
    }
    if (input.parkingType) {
      queryBuilder.andWhere('report.parkingType = :parkingType', { parkingType: input.parkingType });
    }
    if (input.startDate) {
      queryBuilder.andWhere('report.createdAt >= :startDate', { startDate: input.startDate });
    }
    if (input.endDate) {
      queryBuilder.andWhere('report.createdAt <= :endDate', { endDate: input.endDate });
    }

    const [reports, total] = await queryBuilder
      .skip(skip)
      .take(pageSize)
      .orderBy('report.createdAt', 'DESC')
      .getManyAndCount();

    return {
      data: reports,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async updateReport(id: number, input: UpdateReportInput): Promise<Report> {
    const report = await this.reportRepository.findOne({ where: { id } });
    if (!report) {
      throw new Error('举报记录不存在');
    }
    Object.assign(report, input);
    return this.reportRepository.save(report);
  }

  async deleteReport(id: number): Promise<boolean> {
    const result = await this.reportRepository.delete(id);
    return (result.affected || 0) > 0;
  }

  async getReportsByCaseId(caseId: number): Promise<Report[]> {
    return this.reportRepository.find({
      where: { caseId },
      order: { createdAt: 'DESC' },
      relations: ['reporter'],
    });
  }

  async getPendingReports(params: PaginationParams): Promise<PaginationResult<Report>> {
    return this.getReportList({
      ...params,
      status: ReportStatus.PENDING,
    } as QueryReportInput);
  }

  async getReportsBySource(source: ReportSource, params: PaginationParams): Promise<PaginationResult<Report>> {
    return this.getReportList({
      ...params,
      source,
    } as QueryReportInput);
  }

  async findPotentialDuplicates(plateNumber: string, location: string, timeWindowHours: number = 72): Promise<Report[]> {
    const timeThreshold = new Date(Date.now() - timeWindowHours * 60 * 60 * 1000);

    const queryBuilder = this.reportRepository.createQueryBuilder('report')
      .where('report.plateNumber = :plateNumber', { plateNumber: plateNumber.toUpperCase() })
      .andWhere('report.createdAt > :timeThreshold', { timeThreshold })
      .andWhere('report.status != :status', { status: ReportStatus.RESOLVED })
      .leftJoinAndSelect('report.case', 'case');

    const reports = await queryBuilder.getMany();

    return reports.filter(r => {
      if (!r.location) return false;
      return this.isSameLocation(r.location, location);
    });
  }

  async getReportStats(startDate?: Date, endDate?: Date): Promise<{
    total: number;
    bySource: Record<string, number>;
    byStatus: Record<string, number>;
  }> {
    const queryBuilder = this.reportRepository.createQueryBuilder('report');

    if (startDate) {
      queryBuilder.andWhere('report.createdAt >= :startDate', { startDate });
    }
    if (endDate) {
      queryBuilder.andWhere('report.createdAt <= :endDate', { endDate });
    }

    const total = await queryBuilder.getCount();

    const bySourceResult = await this.reportRepository
      .createQueryBuilder('report')
      .select('report.source, COUNT(*) as count')
      .groupBy('report.source')
      .getRawMany();

    const byStatusResult = await this.reportRepository
      .createQueryBuilder('report')
      .select('report.status, COUNT(*) as count')
      .groupBy('report.status')
      .getRawMany();

    const bySource: Record<string, number> = {};
    const byStatus: Record<string, number> = {};

    bySourceResult.forEach(r => { bySource[r.source] = parseInt(r.count); });
    byStatusResult.forEach(r => { byStatus[r.status] = parseInt(r.count); });

    return { total, bySource, byStatus };
  }
}

export const reportService = new ReportService();
