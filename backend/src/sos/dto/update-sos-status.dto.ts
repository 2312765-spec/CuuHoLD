import { IsIn, IsString, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import type { SosStatus } from '../sos.entity';

export const UPDATABLE_SOS_STATUSES = [
  'in_progress',
  'arrived',
  'resolved',
] as const;

export class UpdateSosStatusDto {
  @ApiProperty({ enum: UPDATABLE_SOS_STATUSES })
  @IsIn(UPDATABLE_SOS_STATUSES)
  status: SosStatus;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  note?: string;
}
