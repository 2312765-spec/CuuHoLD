import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { HazardSeverity } from '../../hazards/hazard.types';
import { HAZARD_SEVERITIES } from '../../hazards/hazard.types';

export class ApproveHazardReportDto {
  @ApiProperty({
    enum: HAZARD_SEVERITIES,
    example: 'blocked',
    description:
      'blocked = đỏ (chặn đường, tuyến đi sẽ né) | caution = vàng (chỉ cảnh báo)',
  })
  @IsIn(HAZARD_SEVERITIES)
  severity: HazardSeverity;

  @ApiPropertyOptional({
    example: 200,
    description: 'Bán kính vùng ảnh hưởng (mét), 10..5000',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(10)
  @Max(5000)
  radiusMeters?: number;

  @ApiPropertyOptional({ example: 'Đã gọi xác minh với trưởng thôn' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class RejectHazardReportDto {
  @ApiPropertyOptional({ example: 'Không xác minh được hiện trường' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
