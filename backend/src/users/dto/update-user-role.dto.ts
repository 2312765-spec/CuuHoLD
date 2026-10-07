import { IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import type { UserRole } from '../user.entity';

export class UpdateUserRoleDto {
  @ApiProperty({ example: 'rescuer', enum: ['victim', 'rescuer', 'commander'] })
  @IsIn(['victim', 'rescuer', 'commander'])
  role: UserRole;
}
