import { Repository, Like } from 'typeorm';
import { Vehicle, Blacklist } from '../entities';
import { getRepository } from '../config/database';
import { PaginationResult, PaginationParams } from '../types';

export class VehicleService {
  private vehicleRepository: Repository<Vehicle>;
  private blacklistRepository: Repository<Blacklist>;

  constructor() {
    this.vehicleRepository = getRepository(Vehicle);
    this.blacklistRepository = getRepository(Blacklist);
  }

  async findOrCreateByPlateNumber(plateNumber: string, vehicleData?: Partial<Vehicle>): Promise<Vehicle> {
    let vehicle = await this.vehicleRepository.findOne({
      where: { plateNumber: plateNumber.toUpperCase() },
    });

    if (!vehicle) {
      vehicle = this.vehicleRepository.create({
        plateNumber: plateNumber.toUpperCase(),
        ...vehicleData,
      });
      await this.vehicleRepository.save(vehicle);
    } else if (vehicleData) {
      Object.assign(vehicle, vehicleData);
      await this.vehicleRepository.save(vehicle);
    }

    return vehicle;
  }

  async getVehicleById(id: number): Promise<Vehicle | null> {
    return this.vehicleRepository.findOne({
      where: { id },
      relations: ['reports', 'cases', 'blacklistRecords'],
    });
  }

  async getVehicleByPlateNumber(plateNumber: string): Promise<Vehicle | null> {
    return this.vehicleRepository.findOne({
      where: { plateNumber: plateNumber.toUpperCase() },
      relations: ['reports', 'cases', 'blacklistRecords'],
    });
  }

  async getVehicleList(params: PaginationParams & { plateNumber?: string; isBlacklisted?: boolean }): Promise<PaginationResult<Vehicle>> {
    const page = params.page || 1;
    const pageSize = params.pageSize || 20;
    const skip = (page - 1) * pageSize;

    const queryBuilder = this.vehicleRepository.createQueryBuilder('vehicle')
      .leftJoinAndSelect('vehicle.blacklistRecords', 'blacklist');

    if (params.plateNumber) {
      queryBuilder.andWhere('vehicle.plateNumber LIKE :plateNumber', {
        plateNumber: `%${params.plateNumber.toUpperCase()}%`,
      });
    }

    if (params.isBlacklisted !== undefined) {
      if (params.isBlacklisted) {
        queryBuilder.andWhere('blacklist.isActive = :isActive', { isActive: true });
      } else {
        queryBuilder.andWhere(qb => {
          const subQuery = qb.subQuery()
            .select('1')
            .from(Blacklist, 'bl')
            .where('bl.vehicleId = vehicle.id')
            .andWhere('bl.isActive = :isActive', { isActive: true })
            .getQuery();
          return `NOT EXISTS (${subQuery})`;
        });
      }
    }

    const [vehicles, total] = await queryBuilder
      .skip(skip)
      .take(pageSize)
      .orderBy('vehicle.updatedAt', 'DESC')
      .getManyAndCount();

    return {
      data: vehicles,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async updateVehicle(id: number, data: Partial<Vehicle>): Promise<Vehicle> {
    const vehicle = await this.vehicleRepository.findOne({ where: { id } });
    if (!vehicle) {
      throw new Error('车辆不存在');
    }
    Object.assign(vehicle, data);
    if (data.plateNumber) {
      vehicle.plateNumber = data.plateNumber.toUpperCase();
    }
    return this.vehicleRepository.save(vehicle);
  }

  async isBlacklisted(vehicleId: number): Promise<boolean> {
    const count = await this.blacklistRepository.count({
      where: { vehicleId, isActive: true },
    });
    return count > 0;
  }

  async getVehicleHistory(vehicleId: number): Promise<{
    vehicle: Vehicle;
    caseCount: number;
    reportCount: number;
    blacklistRecords: Blacklist[];
  }> {
    const vehicle = await this.vehicleRepository.findOne({
      where: { id: vehicleId },
      relations: ['reports', 'cases', 'blacklistRecords'],
    });

    if (!vehicle) {
      throw new Error('车辆不存在');
    }

    return {
      vehicle,
      caseCount: vehicle.cases?.length || 0,
      reportCount: vehicle.reports?.length || 0,
      blacklistRecords: vehicle.blacklistRecords || [],
    };
  }

  async searchVehicles(keyword: string, limit: number = 10): Promise<Vehicle[]> {
    return this.vehicleRepository.find({
      where: { plateNumber: Like(`%${keyword.toUpperCase()}%`) },
      take: limit,
      order: { updatedAt: 'DESC' },
    });
  }
}

export const vehicleService = new VehicleService();
