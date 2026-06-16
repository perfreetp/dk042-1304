import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Vehicle } from './Vehicle';

@Entity('blacklist')
export class Blacklist {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 20 })
  plateNumber: string;

  @Column({ type: 'text', nullable: true })
  reason: string;

  @Column({ type: 'int', default: 0 })
  violationCount: number;

  @Column({ type: 'int', default: 0 })
  totalOvertimeDays: number;

  @Column({ type: 'datetime', nullable: true })
  lastViolationAt: Date;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'datetime', nullable: true })
  removedAt: Date;

  @Column({ type: 'text', nullable: true })
  removeReason: string;

  @ManyToOne(() => Vehicle, vehicle => vehicle.blacklistRecords, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'vehicleId' })
  vehicle: Vehicle;

  @Column()
  vehicleId: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
