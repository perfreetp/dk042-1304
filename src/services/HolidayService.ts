import { Repository, Between } from 'typeorm';
import { Holiday, Case } from '../entities';
import { getRepository } from '../config/database';
import { CreateHolidayInput, UpdateHolidayInput, HolidayCleanupInput } from '../schemas';
import { PaginationResult, PaginationParams } from '../types';
import { ReportStatus, HolidayType, WarningType } from '../types/enums';
import { caseService } from './CaseService';
import { warningService } from './WarningService';

export class HolidayService {
  private holidayRepository: Repository<Holiday>;
  private caseRepository: Repository<Case>;

  constructor() {
    this.holidayRepository = getRepository(Holiday);
    this.caseRepository = getRepository(Case);
  }

  async createHoliday(input: CreateHolidayInput): Promise<Holiday> {
    const holiday = this.holidayRepository.create({
      ...input,
      isActive: input.isActive || false,
    });

    if (input.isActive) {
      await this.deactivateOtherHolidays();
    }

    return this.holidayRepository.save(holiday);
  }

  async updateHoliday(id: number, input: UpdateHolidayInput): Promise<Holiday> {
    const holiday = await this.holidayRepository.findOne({ where: { id } });
    if (!holiday) {
      throw new Error('节假日不存在');
    }

    Object.assign(holiday, input);

    if (input.isActive) {
      await this.deactivateOtherHolidays(id);
    }

    return this.holidayRepository.save(holiday);
  }

  private async deactivateOtherHolidays(excludeId?: number): Promise<void> {
    const queryBuilder = this.holidayRepository
      .createQueryBuilder()
      .update(Holiday)
      .set({ isActive: false });

    if (excludeId) {
      queryBuilder.where('id != :excludeId', { excludeId });
    }

    await queryBuilder.execute();
  }

  async getHolidayById(id: number): Promise<Holiday | null> {
    return this.holidayRepository.findOne({ where: { id } });
  }

  async getActiveHoliday(): Promise<Holiday | null> {
    return this.holidayRepository.findOne({ where: { isActive: true } });
  }

  async getHolidayList(params: PaginationParams & { year?: number; type?: HolidayType; isActive?: boolean }): Promise<PaginationResult<Holiday>> {
    const page = params.page || 1;
    const pageSize = params.pageSize || 20;
    const skip = (page - 1) * pageSize;

    const queryBuilder = this.holidayRepository.createQueryBuilder('holiday');

    if (params.year) {
      queryBuilder.andWhere('holiday.year = :year', { year: params.year });
    }
    if (params.type) {
      queryBuilder.andWhere('holiday.type = :type', { type: params.type });
    }
    if (params.isActive !== undefined) {
      queryBuilder.andWhere('holiday.isActive = :isActive', { isActive: params.isActive });
    }

    const [holidays, total] = await queryBuilder
      .skip(skip)
      .take(pageSize)
      .orderBy('holiday.year', 'DESC')
      .addOrderBy('holiday.startDate', 'ASC')
      .getManyAndCount();

    return {
      data: holidays,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async deleteHoliday(id: number): Promise<boolean> {
    const result = await this.holidayRepository.delete(id);
    return (result.affected || 0) > 0;
  }

  async activateHoliday(id: number): Promise<Holiday> {
    const holiday = await this.holidayRepository.findOne({ where: { id } });
    if (!holiday) {
      throw new Error('节假日不存在');
    }

    await this.deactivateOtherHolidays(id);

    holiday.isActive = true;
    await this.holidayRepository.save(holiday);

    await warningService.createWarning({
      type: WarningType.HOLIDAY,
      title: `节假日专项清理启动：${holiday.name}`,
      content: `清理区域：${holiday.cleanupAreas || '全辖区'}，目标清理：${holiday.targetCaseCount}件`,
      level: 2,
    });

    return holiday;
  }

  async deactivateHoliday(id: number): Promise<Holiday> {
    const holiday = await this.holidayRepository.findOne({ where: { id } });
    if (!holiday) {
      throw new Error('节假日不存在');
    }

    holiday.isActive = false;
    return this.holidayRepository.save(holiday);
  }

  async getHolidayCases(holidayId: number, params: PaginationParams & { status?: ReportStatus }): Promise<PaginationResult<Case>> {
    const holiday = await this.holidayRepository.findOne({ where: { id: holidayId } });
    if (!holiday) {
      throw new Error('节假日不存在');
    }

    const page = params.page || 1;
    const pageSize = params.pageSize || 20;
    const skip = (page - 1) * pageSize;

    const startDate = new Date(holiday.startDate);
    const endDate = new Date(holiday.endDate + ' 23:59:59');

    const queryBuilder = this.caseRepository
      .createQueryBuilder('case')
      .leftJoinAndSelect('case.vehicle', 'vehicle')
      .where('case.createdAt BETWEEN :startDate AND :endDate', { startDate, endDate });

    if (params.status) {
      queryBuilder.andWhere('case.status = :status', { status: params.status });
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

  async executeCleanup(input: HolidayCleanupInput, operatorId?: number): Promise<{ success: number; failed: number }> {
    const holiday = await this.holidayRepository.findOne({ where: { id: input.holidayId } });
    if (!holiday) {
      throw new Error('节假日不存在');
    }

    const result = { success: 0, failed: 0 };

    for (const caseId of input.caseIds) {
      try {
        if (input.action === 'assign') {
          await caseService.autoAssignCase(caseId, operatorId);
        } else if (input.action === 'complete') {
          await caseService.resolveCase(caseId, input.remark);
        }
        result.success++;
      } catch (e) {
        console.error(`处理案件 ${caseId} 失败:`, e);
        result.failed++;
      }
    }

    holiday.completedCaseCount += result.success;
    await this.holidayRepository.save(holiday);

    return result;
  }

  async getHolidayStats(holidayId: number): Promise<any> {
    const holiday = await this.holidayRepository.findOne({ where: { id: holidayId } });
    if (!holiday) {
      throw new Error('节假日不存在');
    }

    const startDate = new Date(holiday.startDate);
    const endDate = new Date(holiday.endDate + ' 23:59:59');

    const totalCases = await this.caseRepository.count({
      where: { createdAt: Between(startDate, endDate) },
    });

    const resolvedCases = await this.caseRepository.count({
      where: {
        createdAt: Between(startDate, endDate),
        status: ReportStatus.RESOLVED,
      },
    });

    const pendingCases = await this.caseRepository.count({
      where: {
        createdAt: Between(startDate, endDate),
        status: ReportStatus.PENDING,
      },
    });

    const processingCases = await this.caseRepository.count({
      where: {
        createdAt: Between(startDate, endDate),
        status: ReportStatus.PROCESSING,
      },
    });

    const escalatedCases = await this.caseRepository.count({
      where: {
        createdAt: Between(startDate, endDate),
        status: ReportStatus.ESCALATED,
      },
    });

    return {
      holiday,
      cases: {
        total: totalCases,
        resolved: resolvedCases,
        pending: pendingCases,
        processing: processingCases,
        escalated: escalatedCases,
        resolutionRate: totalCases > 0 ? Math.round((resolvedCases / totalCases) * 100) : 0,
      },
      progress: {
        target: holiday.targetCaseCount,
        completed: holiday.completedCaseCount,
        percentage: holiday.targetCaseCount > 0
          ? Math.round((holiday.completedCaseCount / holiday.targetCaseCount) * 100)
          : 0,
      },
    };
  }

  async getUpcomingHolidays(days: number = 30): Promise<Holiday[]> {
    const now = new Date();
    const future = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    const nowStr = now.toISOString().split('T')[0];
    const futureStr = future.toISOString().split('T')[0];

    return this.holidayRepository
      .createQueryBuilder('holiday')
      .where('holiday.startDate >= :nowStr', { nowStr })
      .andWhere('holiday.startDate <= :futureStr', { futureStr })
      .orderBy('holiday.startDate', 'ASC')
      .getMany();
  }

  async updateCompletedCount(holidayId: number): Promise<Holiday> {
    const holiday = await this.holidayRepository.findOne({ where: { id: holidayId } });
    if (!holiday) {
      throw new Error('节假日不存在');
    }

    const startDate = new Date(holiday.startDate);
    const endDate = new Date(holiday.endDate + ' 23:59:59');

    const completedCount = await this.caseRepository.count({
      where: {
        createdAt: Between(startDate, endDate),
        status: ReportStatus.RESOLVED,
      },
    });

    holiday.completedCaseCount = completedCount;
    return this.holidayRepository.save(holiday);
  }
}

export const holidayService = new HolidayService();
