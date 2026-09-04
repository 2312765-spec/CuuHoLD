import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { RESCUE_TEAM_STATUSES } from '../rescue-team.entity';
import type { RescueTeamStatus } from '../rescue-team.entity';

export class UpdateTeamStatusDto {
  @ApiProperty({ enum: RESCUE_TEAM_STATUSES })
  @IsEnum(RESCUE_TEAM_STATUSES)
  status: RescueTeamStatus;
}
