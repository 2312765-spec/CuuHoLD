import { IsISO8601 } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SosHeatmapQueryDto {
  @ApiProperty({ example: '2026-08-01T00:00:00.000Z' })
  @IsISO8601()
  from: string;

  @ApiProperty({ example: '2026-08-23T23:59:59.000Z' })
  @IsISO8601()
  to: string;
}
