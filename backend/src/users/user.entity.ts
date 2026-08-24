import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export type UserRole = 'victim' | 'rescuer' | 'commander';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, length: 15 })
  phone: string;

  @Column({ length: 100 })
  name: string;

  @Column({ name: 'password_hash' })
  passwordHash: string;

  @Column({ type: 'enum', enum: ['victim', 'rescuer', 'commander'], default: 'victim' })
  role: UserRole;

  @Column({ name: 'district_code', type: 'varchar', nullable: true })
  districtCode: string | null;

  @Column({ name: 'ward_code', type: 'varchar', nullable: true })
  wardCode: string | null;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}