import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { UserRole } from '../types/enums';
import { Report } from './Report';
import { Assignment } from './Assignment';
import { Disposal } from './Disposal';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true, length: 50 })
  username: string;

  @Column({ length: 100 })
  password: string;

  @Column({ length: 50 })
  realName: string;

  @Column({
    type: 'simple-enum',
    enum: UserRole,
  })
  role: UserRole;

  @Column({ length: 100, nullable: true })
  department: string;

  @Column({ length: 20, nullable: true })
  phone: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'text', nullable: true })
  remark: string;

  @OneToMany(() => Report, report => report.reporter)
  reports: Report[];

  @OneToMany(() => Assignment, assignment => assignment.assignee)
  assignments: Assignment[];

  @OneToMany(() => Disposal, disposal => disposal.operator)
  disposals: Disposal[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
