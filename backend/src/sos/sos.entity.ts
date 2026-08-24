import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export const SOS_TYPES = [
  'flood',
  'landslide',
  'accident',
  'medical',
  'fire',
  'lost',
  'drowning',
  'agricultural',
  'adventure',
  'other',
] as const;
export type SosType = (typeof SOS_TYPES)[number];

export const SOS_STATUSES = [
  'pending',
  'assigned',
  'in_progress',
  'arrived',
  'resolved',
  'cancelled',
  'false_alarm',
] as const;
export type SosStatus = (typeof SOS_STATUSES)[number];

export interface GeoPoint {
  type: 'Point';
  coordinates: [number, number]; // [longitude, latitude]
}

@Entity('sos_requests')
export class SosRequest {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'victim_id' }) victimId: string;

  @Index({ spatial: true })
  @Column({ type: 'geometry', spatialFeatureType: 'Point', srid: 4326 })
  location: GeoPoint;

  @Column() type: SosType;
  @Column({ default: 'pending' }) status: SosStatus;
  @Column({ nullable: true }) description: string;
  @Column({ name: 'image_url', nullable: true }) imageUrl: string;
  @Column({ name: 'assigned_team_id', nullable: true }) assignedTeamId: string;
  @Column({ name: 'district_code', nullable: true }) districtCode: string;
  @Column({ name: 'false_alarm_count', default: 0 }) falseAlarmCount: number;
  @Column({ name: 'cancel_deadline', nullable: true }) cancelDeadline: Date;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
  @Column({ name: 'resolved_at', type: 'timestamptz', nullable: true })
  resolvedAt: Date | null;
}
