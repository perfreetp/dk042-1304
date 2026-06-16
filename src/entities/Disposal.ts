import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { DisposalAction } from '../types/enums';
import { Case } from './Case';
import { User } from './User';

@Entity('disposals')
export class Disposal {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    type: 'simple-enum',
    enum: DisposalAction,
  })
  action: DisposalAction;

  @Column({ type: 'text', nullable: true })
  actionDetail: string;

  @Column({ type: 'text', nullable: true })
  result: string;

  @Column({ type: 'text', nullable: true })
  photoUrls: string;

  @Column({ length: 100, nullable: true })
  location: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  fineAmount: number;

  @Column({ length: 50, nullable: true })
  towCompany: string;

  @Column({ length: 100, nullable: true })
  towDestination: string;

  @Column({ type: 'datetime', nullable: true })
  towedAt: Date;

  @Column({ type: 'boolean', default: false })
  ownerContacted: boolean;

  @Column({ type: 'text', nullable: true })
  ownerResponse: string;

  @ManyToOne(() => Case, caseEntity => caseEntity.disposals, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'caseId' })
  case: Case;

  @Column()
  caseId: number;

  @ManyToOne(() => User, user => user.disposals, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'operatorId' })
  operator: User;

  @Column({ nullable: true })
  operatorId: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
