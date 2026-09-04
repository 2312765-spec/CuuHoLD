import { IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export const CANCEL_SOS_REASONS = [
  'mistake',
  'resolved_myself',
  'other',
] as const;

export type CancelSosReason = (typeof CANCEL_SOS_REASONS)[number];

export class CancelSosDto {
  @ApiProperty({ enum: CANCEL_SOS_REASONS })
  @IsIn(CANCEL_SOS_REASONS)
  reason: CancelSosReason;
}
