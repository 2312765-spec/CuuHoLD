import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { User } from '../users/user.entity';
import { PushService } from './push.service';
import {
  PushSubscriptionDto,
  UnsubscribePushDto,
} from './dto/push-subscription.dto';

interface AuthenticatedRequest extends Request {
  user: User;
}

// F-PWA-05 — mọi vai trò đã đăng nhập bật/tắt thông báo đẩy cho THIẾT BỊ đang dùng. Route khớp
// frontend services/pushService.ts.
@ApiTags('Push (thông báo đẩy)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('push')
export class PushController {
  constructor(private readonly push: PushService) {}

  @Get('vapid-public-key')
  @ApiOperation({
    summary:
      'Khoá công khai VAPID để trình duyệt đăng ký push (503 nếu chưa cấu hình)',
  })
  layKhoa(): { success: true; data: { publicKey: string }; message: string } {
    return {
      success: true,
      data: { publicKey: this.push.layKhoaCongKhai() },
      message: 'OK',
    };
  }

  @Post('subscriptions')
  @ApiOperation({ summary: 'Đăng ký nhận thông báo đẩy cho thiết bị này' })
  async dangKy(
    @Body() dto: PushSubscriptionDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<{ success: true; data: null; message: string }> {
    await this.push.dangKy(req.user.id, dto);
    return { success: true, data: null, message: 'Đã bật thông báo' };
  }

  @Delete('subscriptions')
  @HttpCode(200)
  @ApiOperation({ summary: 'Huỷ nhận thông báo đẩy (endpoint trong body)' })
  async huyDangKy(
    @Body() dto: UnsubscribePushDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<{ success: true; data: null; message: string }> {
    await this.push.huyDangKy(req.user.id, dto.endpoint);
    return { success: true, data: null, message: 'Đã tắt thông báo' };
  }
}
