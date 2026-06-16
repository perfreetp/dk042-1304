import { Repository } from 'typeorm';
import { Warning } from '../entities';
import { getRepository } from '../config/database';
import { CreateWarningInput, AcknowledgeWarningInput, QueryWarningInput } from '../schemas';
import { PaginationResult } from '../types';
import { WarningType } from '../types/enums';

export class WarningService {
  private warningRepository: Repository<Warning>;

  constructor() {
    this.warningRepository = getRepository(Warning);
  }

  async createWarning(input: CreateWarningInput): Promise<Warning> {
    const warning = this.warningRepository.create({
      ...input,
      plateNumber: input.plateNumber?.toUpperCase(),
    });

    return this.warningRepository.save(warning);
  }

  async getWarningById(id: number): Promise<Warning | null> {
    return this.warningRepository.findOne({ where: { id } });
  }

  async getWarningList(input: QueryWarningInput): Promise<PaginationResult<Warning>> {
    const page = input.page || 1;
    const pageSize = input.pageSize || 20;
    const skip = (page - 1) * pageSize;

    const queryBuilder = this.warningRepository.createQueryBuilder('warning');

    if (input.type) {
      queryBuilder.andWhere('warning.type = :type', { type: input.type });
    }
    if (input.isAcknowledged !== undefined) {
      queryBuilder.andWhere('warning.isAcknowledged = :isAcknowledged', { isAcknowledged: input.isAcknowledged });
    }
    if (input.level !== undefined) {
      queryBuilder.andWhere('warning.level >= :level', { level: input.level });
    }
    if (input.plateNumber) {
      queryBuilder.andWhere('warning.plateNumber LIKE :plateNumber', {
        plateNumber: `%${input.plateNumber.toUpperCase()}%`,
      });
    }
    if (input.startDate) {
      queryBuilder.andWhere('warning.createdAt >= :startDate', { startDate: input.startDate });
    }
    if (input.endDate) {
      queryBuilder.andWhere('warning.createdAt <= :endDate', { endDate: input.endDate });
    }

    const [warnings, total] = await queryBuilder
      .skip(skip)
      .take(pageSize)
      .orderBy('warning.level', 'DESC')
      .addOrderBy('warning.createdAt', 'DESC')
      .getManyAndCount();

    return {
      data: warnings,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async acknowledgeWarning(id: number, userId: number, input: AcknowledgeWarningInput): Promise<Warning> {
    const warning = await this.warningRepository.findOne({ where: { id } });
    if (!warning) {
      throw new Error('预警不存在');
    }

    warning.isAcknowledged = true;
    warning.acknowledgedBy = userId;
    warning.acknowledgedAt = new Date();
    warning.acknowledgeRemark = input.remark;

    return this.warningRepository.save(warning);
  }

  async getUnacknowledgedCount(): Promise<{ total: number; byType: Record<string, number>; byLevel: Record<number, number> }> {
    const queryBuilder = this.warningRepository.createQueryBuilder('warning')
      .where('warning.isAcknowledged = :isAcknowledged', { isAcknowledged: false });

    const total = await queryBuilder.getCount();

    const byTypeResult = await this.warningRepository
      .createQueryBuilder('warning')
      .select('warning.type, COUNT(*) as count')
      .where('warning.isAcknowledged = :isAcknowledged', { isAcknowledged: false })
      .groupBy('warning.type')
      .getRawMany();

    const byLevelResult = await this.warningRepository
      .createQueryBuilder('warning')
      .select('warning.level, COUNT(*) as count')
      .where('warning.isAcknowledged = :isAcknowledged', { isAcknowledged: false })
      .groupBy('warning.level')
      .getRawMany();

    const byType: Record<string, number> = {};
    const byLevel: Record<number, number> = {};

    byTypeResult.forEach(r => { byType[r.type] = parseInt(r.count); });
    byLevelResult.forEach(r => { byLevel[parseInt(r.level)] = parseInt(r.count); });

    return { total, byType, byLevel };
  }

  async batchAcknowledge(ids: number[], userId: number, remark?: string): Promise<number> {
    const result = await this.warningRepository
      .createQueryBuilder()
      .update(Warning)
      .set({
        isAcknowledged: true,
        acknowledgedBy: userId,
        acknowledgedAt: new Date(),
        acknowledgeRemark: remark,
      })
      .where('id IN (:...ids)', { ids })
      .andWhere('isAcknowledged = :isAcknowledged', { isAcknowledged: false })
      .execute();

    return result.affected || 0;
  }

  async generateOvertimeWarnings(): Promise<number> {
    const rawQuery = `
      INSERT INTO warnings (type, title, content, plateNumber, location, roadSection, level, relatedCaseId, createdAt, updatedAt)
      SELECT 
        'overtime' as type,
        '超时停放预警' as title,
        '车辆超时停放超过30天，需要立即处置' as content,
        c.plateNumber,
        c.location,
        c.roadSection,
        c.level,
        c.id as relatedCaseId,
        datetime('now') as createdAt,
        datetime('now') as updatedAt
      FROM cases c
      WHERE c.status NOT IN ('resolved', 'archived')
        AND c.totalOvertimeDays >= 30
        AND c.id NOT IN (
          SELECT relatedCaseId FROM warnings 
          WHERE type = 'overtime' AND createdAt >= datetime('now', '-1 day')
        )
    `;

    const result = await this.warningRepository.query(rawQuery);
    return result.changes || 0;
  }

  async generateHotspotWarnings(): Promise<number> {
    const rawQuery = `
      INSERT INTO warnings (type, title, content, location, roadSection, level, metadata, createdAt, updatedAt)
      SELECT 
        'hotspot' as type,
        '重点点位预警' as title,
        '该区域近7天举报超过5起，需要重点关注' as content,
        location,
        roadSection,
        3 as level,
        json_object('reportCount', COUNT(*)) as metadata,
        datetime('now') as createdAt,
        datetime('now') as updatedAt
      FROM reports
      WHERE createdAt >= datetime('now', '-7 days')
      GROUP BY location
      HAVING COUNT(*) >= 5
        AND location NOT IN (
          SELECT location FROM warnings 
          WHERE type = 'hotspot' AND createdAt >= datetime('now', '-1 day')
        )
    `;

    const result = await this.warningRepository.query(rawQuery);
    return result.changes || 0;
  }

  async deleteWarning(id: number): Promise<boolean> {
    const result = await this.warningRepository.delete(id);
    return (result.affected || 0) > 0;
  }

  async getWarningsByCaseId(caseId: number): Promise<Warning[]> {
    return this.warningRepository.find({
      where: { relatedCaseId: caseId },
      order: { createdAt: 'DESC' },
    });
  }
}

export const warningService = new WarningService();
