import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { SystemService } from './system.service';
import type { ActivityLogEntry, SystemStatus } from './system.service';
import { ActivityQueryDto } from './dto/activity-query.dto';

const DEFAULT_ACTIVITY_LIMIT = 50;

interface Wrapped<T> {
  success: true;
  data: T;
  message: string;
}

@ApiTags('System')
@Controller()
export class SystemController {
  constructor(private readonly systemService: SystemService) {}

  @Get('system/status')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('commander')
  @ApiOperation({
    summary:
      'Trạng thái hệ thống: DB, tích hợp ngoài (ORS/eSMS), số liệu tổng quan',
  })
  async status(): Promise<Wrapped<SystemStatus>> {
    return {
      success: true,
      data: await this.systemService.getStatus(),
      message: 'OK',
    };
  }

  @Get('system/activity')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('commander')
  @ApiOperation({
    summary: 'Nhật ký hoạt động gần đây (SOS + cảnh báo chặn đường)',
  })
  async activity(
    @Query() query: ActivityQueryDto,
  ): Promise<Wrapped<ActivityLogEntry[]>> {
    const data = await this.systemService.getActivity(
      query.limit ?? DEFAULT_ACTIVITY_LIMIT,
    );
    return { success: true, data, message: 'OK' };
  }
}
