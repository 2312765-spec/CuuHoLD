import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { HazardType, HazardSeverity } from '../hazard.types';
import { HAZARD_TYPES, HAZARD_SEVERITIES } from '../hazard.types';

export class CreateHazardDto {
  @ApiProperty({ enum: HAZARD_TYPES, example: 'landslide' })
  @IsIn(HAZARD_TYPES)
  type: HazardType;

  @ApiPropertyOptional({
    enum: HAZARD_SEVERITIES,
    example: 'blocked',
    description:
      'blocked (đỏ, chặn đường — mặc định) | caution (vàng, chỉ cảnh báo)',
  })
  @IsOptional()
  @IsIn(HAZARD_SEVERITIES)
  severity?: HazardSeverity;

  @ApiPropertyOptional({ example: 'Sạt lở taluy dương, đá lăn xuống đường' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({ example: 11.9465 })
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat: number;

  @ApiProperty({ example: 108.4419 })
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng: number;

  @ApiPropertyOptional({
    example: 200,
    description: 'Bán kính vùng ảnh hưởng (mét), tối đa 5000',
  })
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  @Min(10)
  @Max(5000)
  radiusMeters?: number;
}
