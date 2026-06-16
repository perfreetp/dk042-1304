import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { WarningType } from '../types/enums';

@Entity('warnings')
export class Warning {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    type: 'simple-enum',
    enum: WarningType,
  })
  type: WarningType;

  @Column({ length: 200 })
  title: string;

  @Column({ type: 'text', nullable: true })
  content?: string;

  @Column({ length: 20, nullable: true })
  plateNumber?: string;

  @Column({ length: 100, nullable: true })
  location?: string;

  @Column({ length: 50, nullable: true })
  roadSection?: string;

  @Column({ type: 'int', default: 1 })
  level: number;

  @Column({ type: 'boolean', default: false })
  isAcknowledged: boolean;

  @Column({ nullable: true })
  acknowledgedBy?: number;

  @Column({ type: 'datetime', nullable: true })
  acknowledgedAt?: Date;

  @Column({ type: 'text', nullable: true })
  acknowledgeRemark?: string;

  @Column({ type: 'int', nullable: true })
  relatedCaseId?: number;

  @Column({ type: 'json', nullable: true })
  metadata?: any;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
