import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RoutingService } from './routing.service';
import type { RouteResult } from './routing.service';
import { RouteQueryDto } from './dto/route-query.dto';

interface RouteResponse {
  success: true;
  data: RouteResult;
  message: string;
}

@ApiTags('Routing')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('routing')
export class RoutingController {
  constructor(private readonly routingService: RoutingService) {}

  @Get('route')
  @Roles('rescuer')
  @ApiOperation({
    summary:
      'Tuyến đường bộ thật từ vị trí rescuer tới nạn nhân (OpenRouteService)',
  })
  async route(@Query() query: RouteQueryDto): Promise<RouteResponse> {
    const data = await this.routingService.findRoute(
      query.fromLat,
      query.fromLng,
      query.toLat,
      query.toLng,
    );
    return { success: true, data, message: 'OK' };
  }
}
