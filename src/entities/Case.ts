import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { CaseLevel, ReportStatus, ParkingType } from '../types/enums';
import { Vehicle } from './Vehicle';
import { Report } from './Report';
import { Assignment } from './Assignment';
import { Disposal } from './Disposal';
import { Archive } from './Archive';

@Entity('cases')
export class Case {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true, length: 30 })
  caseNumber: string;

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

  @Column({
    type: 'simple-enum',
    enum: CaseLevel,
    default: CaseLevel.LEVEL_1,
  })
  level: CaseLevel;

  @Column({
    type: 'simple-enum',
    enum: ReportStatus,
    default: ReportStatus.PENDING,
  })
  status: ReportStatus;

  @Column({ type: 'datetime' })
  firstSeenAt: Date;

  @Column({ type: 'int', default: 0 })
  totalOvertimeDays: number;

  @Column({ type: 'int', default: 0 })
  remindCount: number;

  @Column({ type: 'int', default: 0 })
  reportCount: number;

  @Column({ type: 'boolean', default: false })
  isBlacklisted: boolean;

  @Column({ type: 'text', nullable: true })
  photoUrls: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'datetime', nullable: true })
  lastRemindedAt: Date;

  @Column({ type: 'datetime', nullable: true })
  lastEscalatedAt: Date;

  @Column({ type: 'datetime', nullable: true })
  resolvedAt: Date;

  @Column({ nullable: true })
  currentAssigneeId?: number;

  @Column({ length: 100, nullable: true })
  currentDepartment?: string;

  @ManyToOne(() => Vehicle, vehicle => vehicle.cases, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'vehicleId' })
  vehicle: Vehicle;

  @Column()
  vehicleId: number;

  @OneToMany(() => Report, report => report.case)
  reports: Report[];

  @OneToMany(() => Assignment, assignment => assignment.case)
  assignments: Assignment[];

  @OneToMany(() => Disposal, disposal => disposal.case)
  disposals: Disposal[];

  @OneToMany(() => Archive, archive => archive.case)
  archives: Archive[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
