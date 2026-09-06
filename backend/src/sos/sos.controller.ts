import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle, hours } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { SosService } from './sos.service';
import type {
  CreateSosResult,
  SosListRow,
  CancelSosResult,
  SosDetailResult,
  AssignSosResult,
  UpdateSosStatusResult,
} from './sos.service';
import { CreateSosDto } from './dto/create-sos.dto';
import { CancelSosDto } from './dto/cancel-sos.dto';
import { AssignSosDto } from './dto/assign-sos.dto';
import { UpdateSosStatusDto } from './dto/update-sos-status.dto';
import type { User } from '../users/user.entity';

interface AuthenticatedRequest extends Request {
  user: User;
}

interface CreateSosResponse {
  success: true;
  data: CreateSosResult;
  message: string;
}

interface ApiResponse<T> {
  success: true;
  data: T;
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
  @Throttle({ default: { limit: 5, ttl: hours(1) } })
  @ApiOperation({ summary: 'Gửi tín hiệu SOS khẩn cấp' })
  async create(
    @Body() dto: CreateSosDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<CreateSosResponse> {
    const data = await this.sosService.create(dto, req.user);
    return { success: true, data, message: 'Đã gửi tín hiệu SOS' };
  }

  @Get()
  @Roles('rescuer', 'commander')
  @ApiOperation({ summary: 'Danh sách SOS theo role' })
  async findAll(
    @Query('status') status: string | undefined,
    @Req() req: AuthenticatedRequest,
  ): Promise<ApiResponse<SosListRow[]>> {
    const data = await this.sosService.findAll(req.user, { status });
    return { success: true, data, message: 'OK' };
  }

  // Đặt TRƯỚC @Get(':id') dù không bắt buộc (path 2 đoạn 'mine/active' không khớp pattern
  // ':id' 1 đoạn) — tránh rủi ro nếu sau này ai đó đổi ':id' thành wildcard nuốt hết.
  @Get('mine/active')
  @Roles('victim')
  @ApiOperation({
    summary:
      'SOS đang hoạt động của victim hiện tại (khôi phục UI sau khi F5 mất state RAM)',
  })
  async findMyActive(
    @Req() req: AuthenticatedRequest,
  ): Promise<ApiResponse<SosDetailResult | null>> {
    const data = await this.sosService.findMyActive(req.user);
    // data:null có chủ đích khi success:true — ngoại lệ so với quy ước chung ở
    // docs/api-contract.md Mục 0 (nơi đó ghi data không bao giờ null khi success:true),
    // vì "không có SOS active" là kết quả hợp lệ, không phải lỗi — không nên ép về 404
    // (404 sẽ bị interceptor http.ts phía FE hiện toast lỗi cho một trạng thái bình thường).
    return {
      success: true,
      data,
      message: data ? 'OK' : 'Không có SOS nào đang hoạt động',
    };
  }

  @Patch(':id/cancel')
  @Roles('victim')
  @ApiOperation({ summary: 'Victim hủy SOS' })
  async cancel(
    @Param('id') id: string,
    @Body() dto: CancelSosDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<ApiResponse<CancelSosResult>> {
    const data = await this.sosService.cancel(id, req.user);
    const message = data.accountFlagged
      ? 'Đã hủy SOS. Cảnh báo: tài khoản đã huỷ trễ nhiều lần và bị đánh dấu.'
      : 'Đã hủy SOS';
    return { success: true, data, message };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết SOS + timeline' })
  async findById(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<ApiResponse<SosDetailResult>> {
    const data = await this.sosService.findById(id, req.user);
    return { success: true, data, message: 'OK' };
  }

  @Patch(':id/assign')
  @Roles('commander')
  @ApiOperation({ summary: 'Commander phân công đội cứu hộ' })
  async assign(
    @Param('id') id: string,
    @Body() dto: AssignSosDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<ApiResponse<AssignSosResult>> {
    const data = await this.sosService.assign(id, dto.teamId, req.user);
    return { success: true, data, message: 'Đã phân công đội cứu hộ' };
  }

  @Patch(':id/status')
  @Roles('rescuer')
  @ApiOperation({ summary: 'Rescuer cập nhật tiến độ SOS' })
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateSosStatusDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<ApiResponse<UpdateSosStatusResult>> {
    const data = await this.sosService.updateStatus(
      id,
      dto.status,
      dto.note ?? null,
      req.user,
    );
    return { success: true, data, message: 'Đã cập nhật tiến độ' };
  }
}
