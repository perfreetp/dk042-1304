import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, ManyToMany, JoinTable } from 'typeorm';
import { ReportSource, ReportStatus, ParkingType } from '../types/enums';
import { Vehicle } from './Vehicle';
import { User } from './User';
import { Case } from './Case';

@Entity('reports')
export class Report {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    type: 'simple-enum',
    enum: ReportSource,
  })
  source: ReportSource;

  @Column({
    type: 'simple-enum',
    enum: ReportStatus,
    default: ReportStatus.PENDING,
  })
  status: ReportStatus;

  @Column({ length: 20 })
  plateNumber: string;

  @Column({ length: 100 })
  location: string;

  @Column({ length: 50, nullable: true })
  roadSection: string;

  @Column({
    type: 'simple-enum',
    enum: ParkingType,
  })
  parkingType: ParkingType;

  @Column({ type: 'datetime' })
  firstSeenAt: Date;

  @Column({ type: 'int', default: 1 })
  overtimeDays: number;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'text', nullable: true })
  photoUrls: string;

  @Column({ length: 50, nullable: true })
  reporterName: string;

  @Column({ length: 20, nullable: true })
  reporterPhone: string;

  @ManyToOne(() => Vehicle, vehicle => vehicle.reports, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'vehicleId' })
  vehicle: Vehicle;

  @Column({ nullable: true })
  vehicleId: number;

  @ManyToOne(() => User, user => user.reports, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'reporterId' })
  reporter: User;

  @Column({ nullable: true })
  reporterId: number;

  @ManyToOne(() => Case, caseEntity => caseEntity.reports, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'caseId' })
  case: Case;

  @Column({ nullable: true })
  caseId: number;

  @Column({ type: 'boolean', default: false })
  isMerged: boolean;

  @Column({ type: 'text', nullable: true })
  mergeRemark: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
