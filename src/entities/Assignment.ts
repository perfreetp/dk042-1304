import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { AssignmentStatus, UserRole } from '../types/enums';
import { Case } from './Case';
import { User } from './User';

@Entity('assignments')
export class Assignment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    type: 'simple-enum',
    enum: AssignmentStatus,
    default: AssignmentStatus.ASSIGNED,
  })
  status: AssignmentStatus;

  @Column({
    type: 'simple-enum',
    enum: UserRole,
  })
  targetRole: UserRole;

  @Column({ length: 100, nullable: true })
  targetDepartment?: string;

  @Column({ type: 'text', nullable: true })
  assignRemark?: string;

  @Column({ type: 'text', nullable: true })
  acceptRemark?: string;

  @Column({ type: 'text', nullable: true })
  rejectReason?: string;

  @Column({ type: 'text', nullable: true })
  completeRemark?: string;

  @Column({ type: 'datetime', nullable: true })
  deadline: Date;

  @Column({ type: 'int', default: 0 })
  urgencyLevel: number;

  @Column({ type: 'boolean', default: false })
  isEscalation: boolean;

  @Column({ type: 'int', nullable: true })
  fromAssignmentId: number;

  @ManyToOne(() => Case, caseEntity => caseEntity.assignments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'caseId' })
  case: Case;

  @Column()
  caseId: number;

  @ManyToOne(() => User, user => user.assignments, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'assigneeId' })
  assignee: User;

  @Column({ nullable: true })
  assigneeId: number;

  @Column({ nullable: true })
  assignerId: number;

  @Column({ type: 'datetime', nullable: true })
  acceptedAt: Date;

  @Column({ type: 'datetime', nullable: true })
  rejectedAt: Date;

  @Column({ type: 'datetime', nullable: true })
  completedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
