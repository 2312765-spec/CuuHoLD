import { Controller, Post, Body, UseGuards, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { SosService } from './sos.service';
import type { CreateSosResult } from './sos.service';
import { CreateSosDto } from './dto/create-sos.dto';
import type { User } from '../users/user.entity';

interface AuthenticatedRequest extends Request {
  user: User;
}

interface CreateSosResponse {
  success: true;
  data: CreateSosResult;
  message: string;
}

@ApiTags('SOS')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('sos')
export class SosController {
  constructor(private readonly sosService: SosService) {}

  @Post()
  @Roles('victim')
  @ApiOperation({ summary: 'Gửi tín hiệu SOS khẩn cấp' })
  async create(
    @Body() dto: CreateSosDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<CreateSosResponse> {
    const data = await this.sosService.create(dto, req.user);
    return { success: true, data, message: 'Đã gửi tín hiệu SOS' };
  }
}
