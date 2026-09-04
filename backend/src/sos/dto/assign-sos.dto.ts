import { IsUUID, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AssignSosDto {
  @ApiProperty({ description: 'ID đội cứu hộ được phân công' })
  @IsUUID()
  @IsNotEmpty()
  teamId: string;
}
