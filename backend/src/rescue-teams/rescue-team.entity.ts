import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export const RESCUE_TEAM_STATUSES = ['available', 'busy', 'offline'] as const;
export type RescueTeamStatus = (typeof RESCUE_TEAM_STATUSES)[number];

export interface GeoPoint {
  type: 'Point';
  coordinates: [number, number]; // [longitude, latitude]
}

@Entity('rescue_teams')
export class RescueTeam {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ length: 100 }) name: string;
  @Column({ name: 'leader_id' }) leaderId: string;
  @Column({ name: 'ward_code' }) wardCode: string;
  @Column('text', { array: true, default: '{}' }) specialties: string[];

  @Index({ spatial: true })
  @Column({
    type: 'geometry',
    spatialFeatureType: 'Point',
    srid: 4326,
    nullable: true,
  })
  currentLocation: GeoPoint | null;

  @Column({ default: 'offline' }) status: RescueTeamStatus;

  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
