import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { HazardsService } from './hazards.service';
import type { HazardResult } from './hazards.service';
import { CreateHazardDto } from './dto/create-hazard.dto';
import type { User } from '../users/user.entity';

interface AuthenticatedRequest extends Request {
  user: User;
}

interface HazardResponse {
  success: true;
  data: HazardResult;
  message: string;
}
interface HazardListResponse {
  success: true;
  data: HazardResult[];
  message: string;
}

@ApiTags('Hazards')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('hazards')
export class HazardsController {
  constructor(private readonly hazardsService: HazardsService) {}

  // Bất kỳ vai trò nào đã đăng nhập đều xem được — cảnh báo an toàn (sạt lở, cây đổ...) liên
  // quan tới victim/rescuer trên đường di chuyển thực địa, không chỉ commander.
  @Get()
  @ApiOperation({ summary: 'Danh sách cảnh báo đang hoạt động' })
  async findActive(): Promise<HazardListResponse> {
    const data = await this.hazardsService.findActive();
    return { success: true, data, message: 'OK' };
  }

  @Get('all')
  @Roles('commander')
  @ApiOperation({ summary: 'Toàn bộ cảnh báo, gồm cả đã gỡ (chỉ commander)' })
  async findAll(): Promise<HazardListResponse> {
    const data = await this.hazardsService.findAll();
    return { success: true, data, message: 'OK' };
  }

  @Post()
  @Roles('commander')
  @ApiOperation({ summary: 'Tạo cảnh báo/chặn đường mới (chỉ commander)' })
  async create(
    @Body() dto: CreateHazardDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<HazardResponse> {
    const data = await this.hazardsService.create(dto, req.user.id);
    return { success: true, data, message: 'Đã tạo cảnh báo' };
  }

  @Patch(':id/resolve')
  @Roles('commander')
  @ApiOperation({
    summary: 'Gỡ cảnh báo (đánh dấu hết hiệu lực, chỉ commander)',
  })
  async resolve(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<HazardResponse> {
    const data = await this.hazardsService.resolve(id);
    return { success: true, data, message: 'Đã gỡ cảnh báo' };
  }
}
