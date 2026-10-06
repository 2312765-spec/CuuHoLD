import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { GisService } from './gis.service';
import type {
  NearestTeamResult,
  SosHeatmapResult,
  StatsResult,
} from './gis.service';
import { NearestTeamsQueryDto } from './dto/nearest-teams-query.dto';
import { SosHeatmapQueryDto } from './dto/sos-heatmap-query.dto';

interface NearestTeamsResponse {
  success: true;
  data: NearestTeamResult[];
  message: string;
}

interface SosHeatmapResponse {
  success: true;
  data: SosHeatmapResult[];
  message: string;
}

interface StatsResponse {
  success: true;
  data: StatsResult;
  message: string;
}

@ApiTags('GIS')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('gis')
export class GisController {
  constructor(private readonly gisService: GisService) {}

  @Get('nearest-teams')
  @Roles('commander')
  @ApiOperation({ summary: 'Tìm đội cứu hộ gần nhất (PostGIS)' })
  async nearestTeams(
    @Query() query: NearestTeamsQueryDto,
  ): Promise<NearestTeamsResponse> {
    const data = await this.gisService.findNearestTeams(
      query.lat,
      query.lng,
      query.radiusMeters,
      query.limit,
    );
    return { success: true, data, message: 'OK' };
  }

  @Get('sos-heatmap')
  @Roles('commander')
  @ApiOperation({ summary: 'Heatmap sự cố SOS theo khoảng thời gian' })
  async sosHeatmap(
    @Query() query: SosHeatmapQueryDto,
  ): Promise<SosHeatmapResponse> {
    const data = await this.gisService.getSosHeatmap(
      new Date(query.from),
      new Date(query.to),
    );
    return { success: true, data, message: 'OK' };
  }

  // Dùng chung SosHeatmapQueryDto (from/to ISO8601) — cùng shape, không tạo DTO riêng chỉ để
  // đổi tên.
  @Get('stats')
  @Roles('commander')
  @ApiOperation({
    summary:
      'Thống kê tổng quan: SOS theo trạng thái/loại, thời gian phản hồi, đội, tài khoản bị flag',
  })
  async stats(@Query() query: SosHeatmapQueryDto): Promise<StatsResponse> {
    const data = await this.gisService.getStats(
      new Date(query.from),
      new Date(query.to),
    );
    return { success: true, data, message: 'OK' };
  }
}
