import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { Report } from './Report';
import { Case } from './Case';
import { Blacklist } from './Blacklist';

@Entity('vehicles')
export class Vehicle {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true, length: 20 })
  plateNumber: string;

  @Column({ length: 50, nullable: true })
  brand: string;

  @Column({ length: 30, nullable: true })
  model: string;

  @Column({ length: 20, nullable: true })
  color: string;

  @Column({ length: 17, nullable: true })
  vin: string;

  @Column({ length: 50, nullable: true })
  ownerName: string;

  @Column({ length: 20, nullable: true })
  ownerPhone: string;

  @Column({ type: 'text', nullable: true })
  remark: string;

  @OneToMany(() => Report, report => report.vehicle)
  reports: Report[];

  @OneToMany(() => Case, caseEntity => caseEntity.vehicle)
  cases: Case[];

  @OneToMany(() => Blacklist, blacklist => blacklist.vehicle)
  blacklistRecords: Blacklist[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
