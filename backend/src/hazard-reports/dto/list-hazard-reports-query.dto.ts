import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import type { HazardReportStatus } from '../../common/socket-events.types';

const STATUSES: readonly HazardReportStatus[] = [
  'pending',
  'approved',
  'rejected',
];

export class ListHazardReportsQueryDto {
  @ApiPropertyOptional({
    enum: STATUSES,
    example: 'pending',
    description: 'Mặc định pending (hàng đợi kiểm duyệt)',
  })
  @IsOptional()
  @IsIn(STATUSES)
  status?: HazardReportStatus;

  @ApiPropertyOptional({ example: 50, description: 'Số dòng tối đa, 1..100' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({
    example: 0,
    description: 'Bỏ qua N dòng đầu (phân trang)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
}
