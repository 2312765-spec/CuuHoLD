import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { HazardType } from '../../hazards/hazard.types';
import { HAZARD_TYPES } from '../../hazards/hazard.types';

// Gửi dạng multipart/form-data (có kèm file ảnh) nên MỌI field tới đây đều là chuỗi — cần
// @Type/@Transform để ép về number/boolean trước khi validate.
export class CreateHazardReportDto {
  @ApiProperty({ enum: HAZARD_TYPES, example: 'landslide' })
  @IsIn(HAZARD_TYPES)
  type: HazardType;

  @ApiPropertyOptional({ example: 'Đá lăn xuống chắn nửa đường' })
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
    example: 12,
    description: 'Sai số GPS (mét) do trình duyệt báo',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1000000)
  accuracyMeters?: number;

  @ApiPropertyOptional({
    description: 'true nếu toạ độ chỉ là ước tính (GPS thất bại/kém)',
  })
  @IsOptional()
  @Transform(
    ({ value }: { value: unknown }) => value === true || value === 'true',
  )
  @IsBoolean()
  locationEstimated?: boolean;
}
