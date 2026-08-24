import { Type } from 'class-transformer';
import { IsNumber, IsOptional, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class NearestTeamsQueryDto {
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
    example: 10000,
    description: 'Bán kính tìm kiếm (mét)',
  })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  @Min(1)
  radiusMeters?: number;

  @ApiPropertyOptional({ example: 5 })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  @Min(1)
  @Max(50)
  limit?: number;
}
