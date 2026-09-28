import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min, Max } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

// GET /api/sos/mine/history — F-UI-02. Chặn page < 1 (OFFSET âm → Postgres ném 500) và
// limit > 50 (kéo cả bảng về 1 lần), cùng trần 50 với NearestTeamsQueryDto.
export class SosHistoryQueryDto {
  @ApiPropertyOptional({ example: 1, default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({ example: 10, default: 10 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  @IsOptional()
  limit?: number;
}
