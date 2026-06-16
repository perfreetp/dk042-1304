import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Case } from './Case';
import { User } from './User';

@Entity('archives')
export class Archive {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 30 })
  caseNumber: string;

  @Column({ length: 20 })
  plateNumber: string;

  @Column({ length: 100 })
  location: string;

  @Column({ type: 'json' })
  caseData: any;

  @Column({ type: 'json' })
  reportsData: any;

  @Column({ type: 'json' })
  assignmentsData: any;

  @Column({ type: 'json' })
  disposalsData: any;

  @Column({ type: 'text', nullable: true })
  summary: string;

  @Column({ type: 'int', default: 0 })
  totalDisposalDays: number;

  @Column({ type: 'int', default: 0 })
  remindCount: number;

  @Column({ type: 'int', default: 0 })
  reportCount: number;

  @Column({ type: 'int', default: 0 })
  disposalCount: number;

  @Column({ type: 'datetime' })
  firstSeenAt: Date;

  @Column({ type: 'datetime' })
  resolvedAt: Date;

  @ManyToOne(() => Case, caseEntity => caseEntity.archives, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'caseId' })
  case: Case;

  @Column({ nullable: true })
  caseId: number;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'archivedBy' })
  archivedByUser: User;

  @Column({ nullable: true })
  archivedBy: number;

  @CreateDateColumn()
  createdAt: Date;
}
