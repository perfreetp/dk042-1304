import { Repository } from 'typeorm';
import { Blacklist, Vehicle, Case } from '../entities';
import { getRepository } from '../config/database';
import { PaginationResult, PaginationParams } from '../types';
import { ReportStatus } from '../types/enums';

export class BlacklistService {
  private blacklistRepository: Repository<Blacklist>;
  private vehicleRepository: Repository<Vehicle>;
  private caseRepository: Repository<Case>;

  constructor() {
    this.blacklistRepository = getRepository(Blacklist);
    this.vehicleRepository = getRepository(Vehicle);
    this.caseRepository = getRepository(Case);
  }

  async addToBlacklist(vehicleId: number, reason: string, lastCaseId?: number): Promise<Blacklist> {
    const vehicle = await this.vehicleRepository.findOne({ where: { id: vehicleId } });
    if (!vehicle) {
      throw new Error('车辆不存在');
    }

    const existingBlacklist = await this.blacklistRepository.findOne({
      where: { vehicleId, isActive: true },
    });

    if (existingBlacklist) {
      existingBlacklist.violationCount++;
      existingBlacklist.lastViolationAt = new Date();
      existingBlacklist.reason = reason || existingBlacklist.reason;
      return this.blacklistRepository.save(existingBlacklist);
    }

    const caseCount = await this.caseRepository.count({ where: { vehicleId } });
    const totalOvertimeDays = await this.caseRepository
      .createQueryBuilder('case')
      .where('case.vehicleId = :vehicleId', { vehicleId })
      .select('SUM(case.totalOvertimeDays)', 'sum')
      .getRawOne()
      .then(r => parseInt(r.sum) || 0);

    const blacklist = this.blacklistRepository.create({
      vehicleId,
      plateNumber: vehicle.plateNumber,
      reason,
      violationCount: 1,
      totalOvertimeDays,
      lastViolationAt: new Date(),
      isActive: true,
    });

    await this.blacklistRepository.save(blacklist);

    await this.caseRepository
      .createQueryBuilder()
      .update(Case)
      .set({ isBlacklisted: true })
      .where('vehicleId = :vehicleId', { vehicleId })
      .execute();

    return blacklist;
  }

  async checkAndAddToBlacklist(vehicleId: number, caseId: number): Promise<Blacklist | null> {
    const caseCount = await this.caseRepository.count({
      where: { vehicleId, status: ReportStatus.RESOLVED },
    });

    const currentCase = await this.caseRepository.findOne({ where: { id: caseId } });
    if (!currentCase) return null;

    const totalOvertimeDays = await this.caseRepository
      .createQueryBuilder('case')
      .where('case.vehicleId = :vehicleId', { vehicleId })
      .andWhere('case.status = :status', { status: ReportStatus.RESOLVED })
      .select('SUM(case.totalOvertimeDays)', 'sum')
      .getRawOne()
      .then(r => parseInt(r.sum) || 0);

    if (caseCount >= 3 || totalOvertimeDays >= 90 || currentCase.totalOvertimeDays >= 60) {
      const reason = `累计${caseCount}次违规，累计超时${totalOvertimeDays}天，本次超时${currentCase.totalOvertimeDays}天`;
      return this.addToBlacklist(vehicleId, reason, caseId);
    }

    return null;
  }

  async removeFromBlacklist(id: number, removeReason: string): Promise<Blacklist> {
    const blacklist = await this.blacklistRepository.findOne({ where: { id } });
    if (!blacklist) {
      throw new Error('黑名单记录不存在');
    }

    blacklist.isActive = false;
    blacklist.removedAt = new Date();
    blacklist.removeReason = removeReason;

    await this.blacklistRepository.save(blacklist);

    await this.caseRepository
      .createQueryBuilder()
      .update(Case)
      .set({ isBlacklisted: false })
      .where('vehicleId = :vehicleId', { vehicleId: blacklist.vehicleId })
      .andWhere('status NOT IN (:...statuses)', { statuses: [ReportStatus.RESOLVED, ReportStatus.ARCHIVED] })
      .execute();

    return blacklist;
  }

  async getBlacklistById(id: number): Promise<Blacklist | null> {
    return this.blacklistRepository.findOne({
      where: { id },
      relations: ['vehicle'],
    });
  }

  async getBlacklist(params: PaginationParams & { plateNumber?: string; isActive?: boolean }): Promise<PaginationResult<Blacklist>> {
    const page = params.page || 1;
    const pageSize = params.pageSize || 20;
    const skip = (page - 1) * pageSize;

    const queryBuilder = this.blacklistRepository.createQueryBuilder('blacklist')
      .leftJoinAndSelect('blacklist.vehicle', 'vehicle');

    if (params.plateNumber) {
      queryBuilder.andWhere('blacklist.plateNumber LIKE :plateNumber', {
        plateNumber: `%${params.plateNumber.toUpperCase()}%`,
      });
    }
    if (params.isActive !== undefined) {
      queryBuilder.andWhere('blacklist.isActive = :isActive', { isActive: params.isActive });
    }

    const [blacklist, total] = await queryBuilder
      .skip(skip)
      .take(pageSize)
      .orderBy('blacklist.violationCount', 'DESC')
      .addOrderBy('blacklist.lastViolationAt', 'DESC')
      .getManyAndCount();

    return {
      data: blacklist,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async isBlacklisted(vehicleId: number): Promise<boolean> {
    const count = await this.blacklistRepository.count({
      where: { vehicleId, isActive: true },
    });
    return count > 0;
  }

  async getBlacklistStats(): Promise<{
    total: number;
    active: number;
    byViolationCount: { range: string; count: number }[];
  }> {
    const total = await this.blacklistRepository.count();
    const active = await this.blacklistRepository.count({ where: { isActive: true } });

    const ranges = [
      { min: 0, max: 2, label: '1-2次' },
      { min: 3, max: 5, label: '3-5次' },
      { min: 6, max: 10, label: '6-10次' },
      { min: 11, max: 999, label: '10次以上' },
    ];

    const byViolationCount = [];
    for (const range of ranges) {
      const count = await this.blacklistRepository
        .createQueryBuilder('blacklist')
        .where('blacklist.violationCount BETWEEN :min AND :max', { min: range.min, max: range.max })
        .getCount();
      byViolationCount.push({ range: range.label, count });
    }

    return { total, active, byViolationCount };
  }

  async getTopBlacklist(limit: number = 10): Promise<Blacklist[]> {
    return this.blacklistRepository.find({
      where: { isActive: true },
      order: { violationCount: 'DESC', totalOvertimeDays: 'DESC' },
      take: limit,
      relations: ['vehicle'],
    });
  }
}

export const blacklistService = new BlacklistService();
