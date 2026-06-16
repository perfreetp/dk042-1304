import { Repository, Between } from 'typeorm';
import { Case, Report, Assignment, Disposal, Vehicle } from '../entities';
import { getRepository } from '../config/database';
import { MonthlyReportInput, EfficiencyStatsInput, HotspotQueryInput, DashboardInput } from '../schemas';
import { calculateDaysBetween, formatDate, getRoleDisplayName } from '../utils/helpers';
import { ReportStatus, DisposalAction, ReportSource, CaseLevel, AssignmentStatus, UserRole } from '../types/enums';
import dayjs from 'dayjs';

export class StatisticsService {
  private caseRepository: Repository<Case>;
  private reportRepository: Repository<Report>;
  private assignmentRepository: Repository<Assignment>;
  private disposalRepository: Repository<Disposal>;
  private vehicleRepository: Repository<Vehicle>;

  constructor() {
    this.caseRepository = getRepository(Case);
    this.reportRepository = getRepository(Report);
    this.assignmentRepository = getRepository(Assignment);
    this.disposalRepository = getRepository(Disposal);
    this.vehicleRepository = getRepository(Vehicle);
  }

  async getOverallStats(): Promise<any> {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const totalCases = await this.caseRepository.count();
    const pendingCases = await this.caseRepository.count({ where: { status: ReportStatus.PENDING } });
    const processingCases = await this.caseRepository.count({ where: { status: ReportStatus.PROCESSING } });
    const resolvedCases = await this.caseRepository.count({ where: { status: ReportStatus.RESOLVED } });
    const escalatedCases = await this.caseRepository.count({ where: { status: ReportStatus.ESCALATED } });

    const totalReports = await this.reportRepository.count();
    const reportsLast30Days = await this.reportRepository.count({
      where: { createdAt: Between(thirtyDaysAgo, now) },
    });

    const totalVehicles = await this.vehicleRepository.count();

    const avgResolutionTime = await this.getAverageResolutionTime();
    const remindCountTotal = await this.caseRepository
      .createQueryBuilder('case')
      .select('SUM(case.remindCount)', 'sum')
      .getRawOne()
      .then(r => parseInt(r.sum) || 0);

    return {
      cases: {
        total: totalCases,
        pending: pendingCases,
        processing: processingCases,
        resolved: resolvedCases,
        escalated: escalatedCases,
        resolutionRate: totalCases > 0 ? Math.round((resolvedCases / totalCases) * 100) : 0,
      },
      reports: {
        total: totalReports,
        last30Days: reportsLast30Days,
      },
      vehicles: {
        total: totalVehicles,
      },
      efficiency: {
        avgResolutionDays: avgResolutionTime,
        totalRemindCount: remindCountTotal,
      },
    };
  }

  async getAverageResolutionTime(startDate?: Date, endDate?: Date): Promise<number> {
    const queryBuilder = this.caseRepository
      .createQueryBuilder('case')
      .where('case.status = :status', { status: ReportStatus.RESOLVED })
      .andWhere('case.resolvedAt IS NOT NULL');

    if (startDate) {
      queryBuilder.andWhere('case.createdAt >= :startDate', { startDate });
    }
    if (endDate) {
      queryBuilder.andWhere('case.createdAt <= :endDate', { endDate });
    }

    const cases = await queryBuilder.getMany();

    if (cases.length === 0) return 0;

    const totalDays = cases.reduce((sum, c) => {
      if (c.resolvedAt && c.createdAt) {
        return sum + calculateDaysBetween(c.createdAt, c.resolvedAt);
      }
      return sum;
    }, 0);

    return Math.round((totalDays / cases.length) * 10) / 10;
  }

  async getMonthlyReport(input: MonthlyReportInput): Promise<any> {
    const { year, month } = input;
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const cases = await this.caseRepository.find({
      where: { createdAt: Between(startDate, endDate) },
      relations: ['disposals'],
    });

    const reports = await this.reportRepository.find({
      where: { createdAt: Between(startDate, endDate) },
    });

    const disposals = await this.disposalRepository.find({
      where: { createdAt: Between(startDate, endDate) },
    });

    const byLevel: Record<number, number> = {};
    const byStatus: Record<string, number> = {};
    const bySource: Record<string, number> = {};
    const byDisposalAction: Record<string, number> = {};

    cases.forEach(c => {
      byLevel[c.level] = (byLevel[c.level] || 0) + 1;
      byStatus[c.status] = (byStatus[c.status] || 0) + 1;
    });

    reports.forEach(r => {
      bySource[r.source] = (bySource[r.source] || 0) + 1;
    });

    disposals.forEach(d => {
      byDisposalAction[d.action] = (byDisposalAction[d.action] || 0) + 1;
    });

    const resolvedCases = cases.filter(c => c.status === ReportStatus.RESOLVED);
    const avgResolutionTime = resolvedCases.length > 0
      ? Math.round(resolvedCases.reduce((sum, c) => {
        if (c.resolvedAt) {
          return sum + calculateDaysBetween(c.createdAt, c.resolvedAt);
        }
        return sum;
      }, 0) / resolvedCases.length * 10) / 10
      : 0;

    const totalRemindCount = cases.reduce((sum, c) => sum + c.remindCount, 0);
    const totalTowCount = disposals.filter(d => d.action === DisposalAction.TOW).length;
    const totalFineCount = disposals.filter(d => d.action === DisposalAction.FINE).length;
    const totalFineAmount = disposals
      .filter(d => d.action === DisposalAction.FINE && d.fineAmount)
      .reduce((sum, d) => sum + (d.fineAmount || 0), 0);

    const hotspots = await this.getHotspots({ topN: 5, startDate, endDate });

    return {
      period: `${year}年${month}月`,
      summary: {
        totalCases: cases.length,
        resolvedCases: resolvedCases.length,
        resolutionRate: cases.length > 0 ? Math.round((resolvedCases.length / cases.length) * 100) : 0,
        totalReports: reports.length,
        avgResolutionTime,
        totalRemindCount,
        totalTowCount,
        totalFineCount,
        totalFineAmount,
      },
      breakdown: {
        byLevel,
        byStatus,
        bySource,
        byDisposalAction,
      },
      hotspots,
      keyHighlights: this.generateKeyHighlights(cases, reports, disposals),
      recommendations: this.generateRecommendations(cases, resolvedCases.length, avgResolutionTime),
    };
  }

  private generateKeyHighlights(cases: Case[], reports: Report[], disposals: Disposal[]): string[] {
    const highlights: string[] = [];

    const towCount = disposals.filter(d => d.action === DisposalAction.TOW).length;
    if (towCount > 0) {
      highlights.push(`本月共拖移僵尸车 ${towCount} 辆`);
    }

    const level4Cases = cases.filter(c => c.level === CaseLevel.LEVEL_4).length;
    if (level4Cases > 0) {
      highlights.push(`特别严重案件 ${level4Cases} 起，已全部升级至交警部门处理`);
    }

    const residentReports = reports.filter(r => r.source === ReportSource.RESIDENT).length;
    if (residentReports > 0) {
      highlights.push(`收到居民举报 ${residentReports} 起，占比 ${Math.round(residentReports / reports.length * 100)}%`);
    }

    return highlights;
  }

  private generateRecommendations(cases: Case[], resolvedCount: number, avgTime: number): string[] {
    const recommendations: string[] = [];

    if (avgTime > 7) {
      recommendations.push('平均处置时长超过7天，建议优化分派流程，提高处置效率');
    }

    const pendingCount = cases.filter(c => c.status === ReportStatus.PENDING).length;
    if (pendingCount > 5) {
      recommendations.push(`仍有 ${pendingCount} 件案件待分派，建议及时分派处理`);
    }

    const blacklistCount = cases.filter(c => c.isBlacklisted).length;
    if (blacklistCount > 0) {
      recommendations.push(`涉及黑名单车辆案件 ${blacklistCount} 起，建议重点关注跟踪`);
    }

    if (recommendations.length === 0) {
      recommendations.push('本月治理情况良好，请继续保持');
    }

    return recommendations;
  }

  async getEfficiencyStats(input: EfficiencyStatsInput): Promise<any> {
    const { startDate, endDate, department } = input;

    let queryBuilder = this.assignmentRepository
      .createQueryBuilder('assignment')
      .leftJoinAndSelect('assignment.case', 'case')
      .leftJoinAndSelect('assignment.assignee', 'assignee');

    if (startDate) {
      queryBuilder.andWhere('assignment.createdAt >= :startDate', { startDate });
    }
    if (endDate) {
      queryBuilder.andWhere('assignment.createdAt <= :endDate', { endDate });
    }
    if (department) {
      queryBuilder.andWhere('assignment.targetDepartment = :department', { department });
    }

    const assignments = await queryBuilder.getMany();

    const byRole: Record<string, any> = {};

    for (const assignment of assignments) {
      const role = assignment.targetRole;
      if (!byRole[role]) {
        byRole[role] = {
          total: 0,
          completed: 0,
          pending: 0,
          escalated: 0,
          avgTime: 0,
          totalTime: 0,
        };
      }

      byRole[role].total++;

      if (assignment.status === 'completed') {
        byRole[role].completed++;
        if (assignment.completedAt) {
          const days = calculateDaysBetween(assignment.createdAt, assignment.completedAt);
          byRole[role].totalTime += days;
        }
      } else if (assignment.status === 'in_progress' || assignment.status === 'assigned' || assignment.status === 'accepted') {
        byRole[role].pending++;
      } else if (assignment.status === 'escalated') {
        byRole[role].escalated++;
      }
    }

    for (const role of Object.keys(byRole)) {
      const data = byRole[role];
      data.avgTime = data.completed > 0 ? Math.round(data.totalTime / data.completed * 10) / 10 : 0;
      data.completionRate = data.total > 0 ? Math.round(data.completed / data.total * 100) : 0;
      data.roleName = getRoleDisplayName(role as any);
      delete data.totalTime;
    }

    return {
      overall: {
        total: assignments.length,
        completed: assignments.filter(a => a.status === 'completed').length,
        pending: assignments.filter(a => ['assigned', 'accepted', 'in_progress'].includes(a.status)).length,
        escalated: assignments.filter(a => a.status === 'escalated').length,
      },
      byRole,
    };
  }

  async getHotspots(input: HotspotQueryInput): Promise<any[]> {
    const { topN, startDate, endDate } = input;

    const queryBuilder = this.reportRepository
      .createQueryBuilder('report')
      .select('report.location, report.roadSection, COUNT(*) as reportCount, COUNT(DISTINCT report.plateNumber) as vehicleCount')
      .groupBy('report.location, report.roadSection')
      .orderBy('reportCount', 'DESC')
      .limit(topN);

    if (startDate) {
      queryBuilder.andWhere('report.createdAt >= :startDate', { startDate });
    }
    if (endDate) {
      queryBuilder.andWhere('report.createdAt <= :endDate', { endDate });
    }

    const results = await queryBuilder.getRawMany();

    return results.map((r, index) => ({
      rank: index + 1,
      location: r.location,
      roadSection: r.roadSection,
      reportCount: parseInt(r.reportCount),
      vehicleCount: parseInt(r.vehicleCount),
    }));
  }

  async getTrendData(days: number = 30): Promise<any[]> {
    const data = [];
    const now = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = formatDate(date, 'YYYY-MM-DD');
      const nextDate = new Date(date.getTime() + 24 * 60 * 60 * 1000);

      const newCases = await this.caseRepository.count({
        where: { createdAt: Between(date, nextDate) },
      });

      const resolvedCases = await this.caseRepository.count({
        where: { resolvedAt: Between(date, nextDate) },
      });

      const newReports = await this.reportRepository.count({
        where: { createdAt: Between(date, nextDate) },
      });

      data.push({
        date: dateStr,
        newCases,
        resolvedCases,
        newReports,
      });
    }

    return data;
  }

  async getRemindStats(): Promise<any> {
    const result = await this.caseRepository
      .createQueryBuilder('case')
      .select('CASE ' +
        'WHEN remindCount = 0 THEN "0次" ' +
        'WHEN remindCount = 1 THEN "1次" ' +
        'WHEN remindCount = 2 THEN "2次" ' +
        'WHEN remindCount = 3 THEN "3次" ' +
        'ELSE "4次以上" END as remindLevel, ' +
        'COUNT(*) as count')
      .groupBy('remindLevel')
      .orderBy('remindCount', 'ASC')
      .getRawMany();

    const totalReminded = await this.caseRepository
      .createQueryBuilder('case')
      .where('case.remindCount > 0')
      .getCount();

    return {
      breakdown: result.map(r => ({
        level: r.remindLevel,
        count: parseInt(r.count),
      })),
      summary: {
        totalCases: await this.caseRepository.count(),
        totalReminded,
        remindRate: Math.round(totalReminded / await this.caseRepository.count() * 100),
      },
    };
  }

  async getDisposalStats(startDate?: Date, endDate?: Date): Promise<any> {
    let queryBuilder = this.disposalRepository.createQueryBuilder('disposal');

    if (startDate) {
      queryBuilder.andWhere('disposal.createdAt >= :startDate', { startDate });
    }
    if (endDate) {
      queryBuilder.andWhere('disposal.createdAt <= :endDate', { endDate });
    }

    const disposals = await queryBuilder.getMany();

    const byAction: Record<string, number> = {};
    let totalFineAmount = 0;

    disposals.forEach(d => {
      byAction[d.action] = (byAction[d.action] || 0) + 1;
      if (d.action === DisposalAction.FINE && d.fineAmount) {
        totalFineAmount += d.fineAmount;
      }
    });

    return {
      total: disposals.length,
      byAction,
      totalFineAmount,
    };
  }

  async getDashboard(input: DashboardInput): Promise<any> {
    const { dimension, year, month, roadSection, department, startDate, endDate } = input;

    let start: Date;
    let end: Date;

    if (startDate && endDate) {
      start = new Date(startDate);
      end = new Date(endDate);
    } else if (year) {
      const m = month || 1;
      start = new Date(year, m - 1, 1);
      end = month
        ? new Date(year, month, 0, 23, 59, 59)
        : new Date(year, 11, 31, 23, 59, 59);
    } else {
      const now = new Date();
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = now;
    }

    if (dimension === 'month') {
      return this.getDashboardByMonth(start, end, year);
    } else if (dimension === 'road') {
      return this.getDashboardByRoad(start, end, roadSection);
    } else if (dimension === 'department') {
      return this.getDashboardByDepartment(start, end, department);
    }

    return this.getDashboardByMonth(start, end, year);
  }

  private async getDashboardByMonth(start: Date, end: Date, year?: number): Promise<any> {
    const targetYear = year || start.getFullYear();
    const months: any[] = [];

    for (let m = 0; m < 12; m++) {
      const monthStart = new Date(targetYear, m, 1);
      const monthEnd = new Date(targetYear, m + 1, 0, 23, 59, 59);

      const newCases = await this.caseRepository.count({
        where: { createdAt: Between(monthStart, monthEnd) },
      });

      const assignedCases = await this.assignmentRepository
        .createQueryBuilder('assignment')
        .where('assignment.createdAt >= :start', { start: monthStart })
        .andWhere('assignment.createdAt <= :end', { end: monthEnd })
        .andWhere('assignment.isEscalation = :isEsc', { isEsc: false })
        .getCount();

      const escalatedCases = await this.assignmentRepository
        .createQueryBuilder('assignment')
        .where('assignment.createdAt >= :start', { start: monthStart })
        .andWhere('assignment.createdAt <= :end', { end: monthEnd })
        .andWhere('assignment.isEscalation = :isEsc', { isEsc: true })
        .getCount();

      const towedCases = await this.disposalRepository
        .createQueryBuilder('disposal')
        .where('disposal.createdAt >= :start', { start: monthStart })
        .andWhere('disposal.createdAt <= :end', { end: monthEnd })
        .andWhere('disposal.action = :action', { action: DisposalAction.TOW })
        .getCount();

      const archivedCases = await this.caseRepository.count({
        where: {
          status: ReportStatus.ARCHIVED,
          updatedAt: Between(monthStart, monthEnd),
        },
      });

      months.push({
        period: `${targetYear}-${String(m + 1).padStart(2, '0')}`,
        newCases,
        assignedCases,
        escalatedCases,
        towedCases,
        archivedCases,
      });
    }

    const totalNewCases = months.reduce((s, m) => s + m.newCases, 0);
    const totalAssigned = months.reduce((s, m) => s + m.assignedCases, 0);
    const totalEscalated = months.reduce((s, m) => s + m.escalatedCases, 0);
    const totalTowed = months.reduce((s, m) => s + m.towedCases, 0);
    const totalArchived = months.reduce((s, m) => s + m.archivedCases, 0);

    return {
      dimension: 'month',
      year: targetYear,
      summary: {
        totalNewCases,
        totalAssigned,
        totalEscalated,
        totalTowed,
        totalArchived,
      },
      trend: months,
    };
  }

  private async getDashboardByRoad(start: Date, end: Date, roadSection?: string): Promise<any> {
    const newCasesQb = this.caseRepository
      .createQueryBuilder('case')
      .select('case.roadSection', 'roadSection')
      .addSelect('COUNT(*)', 'newCases')
      .where('case.createdAt >= :start', { start })
      .andWhere('case.createdAt <= :end', { end })
      .groupBy('case.roadSection');

    if (roadSection) {
      newCasesQb.andWhere('case.roadSection LIKE :road', { road: `%${roadSection}%` });
    }
    const newCasesData = await newCasesQb.getRawMany();

    const assignedQb = this.assignmentRepository
      .createQueryBuilder('assignment')
      .leftJoinAndSelect('assignment.case', 'case')
      .select('case.roadSection', 'roadSection')
      .addSelect('COUNT(*)', 'assignedCases')
      .where('assignment.createdAt >= :start', { start })
      .andWhere('assignment.createdAt <= :end', { end })
      .andWhere('assignment.isEscalation = :isEsc', { isEsc: false })
      .groupBy('case.roadSection');

    if (roadSection) {
      assignedQb.andWhere('case.roadSection LIKE :road', { road: `%${roadSection}%` });
    }
    const assignedData = await assignedQb.getRawMany();

    const escalatedQb = this.assignmentRepository
      .createQueryBuilder('assignment')
      .leftJoinAndSelect('assignment.case', 'case')
      .select('case.roadSection', 'roadSection')
      .addSelect('COUNT(*)', 'escalatedCases')
      .where('assignment.createdAt >= :start', { start })
      .andWhere('assignment.createdAt <= :end', { end })
      .andWhere('assignment.isEscalation = :isEsc', { isEsc: true })
      .groupBy('case.roadSection');

    if (roadSection) {
      escalatedQb.andWhere('case.roadSection LIKE :road', { road: `%${roadSection}%` });
    }
    const escalatedData = await escalatedQb.getRawMany();

    const towedQb = this.disposalRepository
      .createQueryBuilder('disposal')
      .leftJoinAndSelect('disposal.case', 'case')
      .select('case.roadSection', 'roadSection')
      .addSelect('COUNT(*)', 'towedCases')
      .where('disposal.createdAt >= :start', { start })
      .andWhere('disposal.createdAt <= :end', { end })
      .andWhere('disposal.action = :action', { action: DisposalAction.TOW })
      .groupBy('case.roadSection');

    if (roadSection) {
      towedQb.andWhere('case.roadSection LIKE :road', { road: `%${roadSection}%` });
    }
    const towedData = await towedQb.getRawMany();

    const archivedQb = this.caseRepository
      .createQueryBuilder('case')
      .select('case.roadSection', 'roadSection')
      .addSelect('COUNT(*)', 'archivedCases')
      .where('case.status = :status', { status: ReportStatus.ARCHIVED })
      .andWhere('case.updatedAt >= :start', { start })
      .andWhere('case.updatedAt <= :end', { end })
      .groupBy('case.roadSection');

    if (roadSection) {
      archivedQb.andWhere('case.roadSection LIKE :road', { road: `%${roadSection}%` });
    }
    const archivedData = await archivedQb.getRawMany();

    const roadSet = new Set<string>();
    [
      ...newCasesData.map(r => r.roadSection),
      ...assignedData.map(r => r.roadSection),
      ...escalatedData.map(r => r.roadSection),
      ...towedData.map(r => r.roadSection),
      ...archivedData.map(r => r.roadSection),
    ].forEach(r => { if (r) roadSet.add(r); });

    const newCasesMap: Record<string, number> = {};
    newCasesData.forEach(r => { newCasesMap[r.roadSection || '未指定'] = parseInt(r.newCases) || 0; });

    const assignedMap: Record<string, number> = {};
    assignedData.forEach(r => { assignedMap[r.roadSection || '未指定'] = parseInt(r.assignedCases) || 0; });

    const escalatedMap: Record<string, number> = {};
    escalatedData.forEach(r => { escalatedMap[r.roadSection || '未指定'] = parseInt(r.escalatedCases) || 0; });

    const towedMap: Record<string, number> = {};
    towedData.forEach(r => { towedMap[r.roadSection || '未指定'] = parseInt(r.towedCases) || 0; });

    const archivedMap: Record<string, number> = {};
    archivedData.forEach(r => { archivedMap[r.roadSection || '未指定'] = parseInt(r.archivedCases) || 0; });

    const breakdown = Array.from(roadSet).map(road => ({
      roadSection: road || '未指定',
      newCases: newCasesMap[road] || 0,
      assignedCases: assignedMap[road] || 0,
      escalatedCases: escalatedMap[road] || 0,
      towedCases: towedMap[road] || 0,
      archivedCases: archivedMap[road] || 0,
    })).sort((a, b) => (b.newCases + b.assignedCases + b.escalatedCases + b.towedCases + b.archivedCases) -
                       (a.newCases + a.assignedCases + a.escalatedCases + a.towedCases + a.archivedCases));

    return {
      dimension: 'road',
      period: { start: start.toISOString(), end: end.toISOString() },
      summary: {
        totalNewCases: breakdown.reduce((s, r) => s + r.newCases, 0),
        totalAssigned: breakdown.reduce((s, r) => s + r.assignedCases, 0),
        totalEscalated: breakdown.reduce((s, r) => s + r.escalatedCases, 0),
        totalTowed: breakdown.reduce((s, r) => s + r.towedCases, 0),
        totalArchived: breakdown.reduce((s, r) => s + r.archivedCases, 0),
      },
      breakdown,
    };
  }

  private async getDashboardByDepartment(start: Date, end: Date, department?: string): Promise<any> {
    const roleMap: Record<string, string> = {
      [UserRole.PROPERTY]: '物业',
      [UserRole.CHENGGUAN]: '城管',
      [UserRole.TRAFFIC_POLICE]: '交警',
      [UserRole.GRID_WORKER]: '社区网格员',
    };

    const roles = Object.keys(roleMap) as UserRole[];
    const deptData: any[] = [];

    for (const role of roles) {
      const newCases = await this.caseRepository
        .createQueryBuilder('case')
        .leftJoin('case.assignments', 'assignment')
        .where('assignment.targetRole = :role', { role })
        .andWhere('case.createdAt >= :start', { start })
        .andWhere('case.createdAt <= :end', { end })
        .getCount();

      const assignedCases = await this.assignmentRepository
        .createQueryBuilder('assignment')
        .where('assignment.targetRole = :role', { role })
        .andWhere('assignment.createdAt >= :start', { start })
        .andWhere('assignment.createdAt <= :end', { end })
        .andWhere('assignment.isEscalation = :isEsc', { isEsc: false })
        .getCount();

      const escalatedCases = await this.assignmentRepository
        .createQueryBuilder('assignment')
        .where('assignment.targetRole = :role', { role })
        .andWhere('assignment.createdAt >= :start', { start })
        .andWhere('assignment.createdAt <= :end', { end })
        .andWhere('assignment.isEscalation = :isEsc', { isEsc: true })
        .getCount();

      let towedCases = 0;
      const deptAssignments = await this.assignmentRepository
        .createQueryBuilder('assignment')
        .where('assignment.targetRole = :role', { role })
        .andWhere('assignment.createdAt >= :start', { start })
        .andWhere('assignment.createdAt <= :end', { end })
        .getMany();

      if (deptAssignments.length > 0) {
        const caseIds = [...new Set(deptAssignments.map(a => a.caseId))];
        towedCases = await this.disposalRepository
          .createQueryBuilder('disposal')
          .where('disposal.caseId IN (:...caseIds)', { caseIds })
          .andWhere('disposal.createdAt >= :start', { start })
          .andWhere('disposal.createdAt <= :end', { end })
          .andWhere('disposal.action = :action', { action: DisposalAction.TOW })
          .getCount();
      }

      const archivedCases = await this.caseRepository
        .createQueryBuilder('case')
        .leftJoin('case.assignments', 'assignment')
        .where('assignment.targetRole = :role', { role })
        .andWhere('case.status = :status', { status: ReportStatus.ARCHIVED })
        .andWhere('case.updatedAt >= :start', { start })
        .andWhere('case.updatedAt <= :end', { end })
        .getCount();

      deptData.push({
        role,
        roleName: roleMap[role],
        newCases,
        assignedCases,
        escalatedCases,
        towedCases,
        archivedCases,
      });
    }

    if (department) {
      const filtered = deptData.filter(d =>
        d.roleName.includes(department) || d.role.includes(department)
      );
      if (filtered.length > 0) {
        return {
          dimension: 'department',
          period: { start: start.toISOString(), end: end.toISOString() },
          summary: {
            totalNewCases: filtered.reduce((s, d) => s + d.newCases, 0),
            totalAssigned: filtered.reduce((s, d) => s + d.assignedCases, 0),
            totalEscalated: filtered.reduce((s, d) => s + d.escalatedCases, 0),
            totalTowed: filtered.reduce((s, d) => s + d.towedCases, 0),
            totalArchived: filtered.reduce((s, d) => s + d.archivedCases, 0),
          },
          breakdown: filtered,
        };
      }
    }

    return {
      dimension: 'department',
      period: { start: start.toISOString(), end: end.toISOString() },
      summary: {
        totalNewCases: deptData.reduce((s, d) => s + d.newCases, 0),
        totalAssigned: deptData.reduce((s, d) => s + d.assignedCases, 0),
        totalEscalated: deptData.reduce((s, d) => s + d.escalatedCases, 0),
        totalTowed: deptData.reduce((s, d) => s + d.towedCases, 0),
        totalArchived: deptData.reduce((s, d) => s + d.archivedCases, 0),
      },
      breakdown: deptData,
    };
  }
}

export const statisticsService = new StatisticsService();
