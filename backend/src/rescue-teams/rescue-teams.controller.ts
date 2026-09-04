import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  UseGuards,
  Req,
  ParseUUIDPipe,
} from '@nestjs/common';
import type { Request } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RescueTeamsService } from './rescue-teams.service';
import type {
  RescueTeamListRow,
  UpdateTeamLocationResult,
  UpdateTeamStatusResult,
} from './rescue-teams.service';
import { UpdateTeamLocationDto } from './dto/update-team-location.dto';
import { UpdateTeamStatusDto } from './dto/update-team-status.dto';
import type { User } from '../users/user.entity';

interface AuthenticatedRequest extends Request {
  user: User;
}

@ApiTags('Rescue Teams')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('rescue-teams')
export class RescueTeamsController {
  constructor(private readonly rescueTeamsService: RescueTeamsService) {}

  @Get()
  @Roles('commander')
  @ApiOperation({ summary: 'Danh sách đội cứu hộ' })
  async findAll(): Promise<{
    success: true;
    data: RescueTeamListRow[];
    message: string;
  }> {
    const data = await this.rescueTeamsService.findAll();
    return { success: true, data, message: 'OK' };
  }

  @Patch(':id/location')
  @Roles('rescuer')
  @ApiOperation({ summary: 'Cập nhật vị trí GPS đội cứu hộ' })
  async updateLocation(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTeamLocationDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<{
    success: true;
    data: UpdateTeamLocationResult;
    message: string;
  }> {
    const data = await this.rescueTeamsService.updateLocation(
      id,
      dto.lat,
      dto.lng,
      req.user.id,
    );
    return { success: true, data, message: 'Đã cập nhật vị trí' };
  }

  @Patch(':id/status')
  @Roles('rescuer')
  @ApiOperation({ summary: 'Cập nhật trạng thái đội cứu hộ' })
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTeamStatusDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<{ success: true; data: UpdateTeamStatusResult; message: string }> {
    const data = await this.rescueTeamsService.updateStatus(
      id,
      dto.status,
      req.user.id,
    );
    return { success: true, data, message: 'Đã cập nhật trạng thái' };
  }
}
