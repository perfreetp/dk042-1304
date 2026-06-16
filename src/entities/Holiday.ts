import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { HolidayType } from '../types/enums';

@Entity('holidays')
export class Holiday {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    type: 'simple-enum',
    enum: HolidayType,
    default: HolidayType.OTHER,
  })
  type: HolidayType;

  @Column({ length: 50 })
  name: string;

  @Column({ type: 'date' })
  startDate: string;

  @Column({ type: 'date' })
  endDate: string;

  @Column({ type: 'int', default: 0 })
  year: number;

  @Column({ type: 'text', nullable: true })
  cleanupPlan: string;

  @Column({ type: 'text', nullable: true })
  cleanupAreas: string;

  @Column({ type: 'int', default: 0 })
  targetCaseCount: number;

  @Column({ type: 'int', default: 0 })
  completedCaseCount: number;

  @Column({ type: 'boolean', default: false })
  isActive: boolean;

  @Column({ type: 'json', nullable: true })
  assignedTeams: any;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
