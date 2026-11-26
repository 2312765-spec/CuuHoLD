import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { GeocodeService } from './geocode.service';
import { ReverseQueryDto } from './dto/reverse-query.dto';

interface ReverseResponse {
  success: true;
  data: { tenDuong: string | null };
  message: string;
}

@ApiTags('Geocode')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('geocode')
export class GeocodeController {
  constructor(private readonly geocodeService: GeocodeService) {}

  @Get('reverse')
  @Roles('commander')
  @ApiOperation({
    summary:
      'Tên đường gần toạ độ (Nominatim qua backend, có cache) — chỉ toạ độ trong tỉnh',
  })
  async reverse(@Query() query: ReverseQueryDto): Promise<ReverseResponse> {
    const tenDuong = await this.geocodeService.reverse(query.lat, query.lng);
    return { success: true, data: { tenDuong }, message: 'OK' };
  }
}
