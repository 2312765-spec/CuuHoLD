import { Body, Controller, Patch, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle, minutes } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UsersService } from './users.service';
import type { User } from './user.entity';
import { toSafeUser } from './users.controller';
import type { SafeUser } from './users.controller';
import { UpdateMeDto, ChangePasswordDto } from './dto/profile.dto';

interface AuthenticatedRequest extends Request {
  user: User;
}

// F-UI-01 — hồ sơ của CHÍNH người đang đăng nhập, mọi vai trò. Tách khỏi UsersController vì
// controller đó gắn @Roles('commander') ở cấp class. Không có @Roles ở đây: chỉ cần JWT hợp lệ,
// và mọi thao tác luôn dùng req.user.id — không có tham số id nào để sửa hồ sơ người khác.
@ApiTags('Users (hồ sơ cá nhân)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users/me')
export class ProfileController {
  constructor(private readonly usersService: UsersService) {}

  @Patch()
  @ApiOperation({
    summary: 'Tự sửa tên (số điện thoại, xã/phường không tự đổi được)',
  })
  async updateMe(
    @Body() dto: UpdateMeDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<{ success: true; data: SafeUser; message: string }> {
    const user = await this.usersService.updateMyName(req.user.id, dto.name);
    return {
      success: true,
      data: toSafeUser(user),
      message: 'Đã cập nhật hồ sơ',
    };
  }

  // Giới hạn như đăng nhập (5 lần/15 phút, theo user — UserThrottlerGuard): chặn dò mật khẩu
  // hiện tại bằng một token bị lộ.
  @Patch('password')
  @Throttle({ default: { limit: 5, ttl: minutes(15) } })
  @ApiOperation({ summary: 'Đổi mật khẩu (bắt buộc đúng mật khẩu hiện tại)' })
  async changePassword(
    @Body() dto: ChangePasswordDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<{ success: true; data: null; message: string }> {
    await this.usersService.changeMyPassword(
      req.user.id,
      dto.currentPassword,
      dto.newPassword,
    );
    return { success: true, data: null, message: 'Đã đổi mật khẩu' };
  }
}
