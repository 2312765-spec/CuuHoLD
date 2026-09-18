import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Request,
  HttpCode,
} from '@nestjs/common';
import type { Request as ExpressRequest } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle, minutes, hours } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import type { User } from '../users/user.entity';

type AuthenticatedRequest = ExpressRequest & { user: User };

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @Throttle({ default: { limit: 3, ttl: hours(1) } })
  @ApiOperation({ summary: 'Đăng ký tài khoản' })
  async register(@Body() dto: RegisterDto) {
    const result = await this.authService.register(dto);
    return { success: true, data: result, message: 'Đăng ký thành công' };
  }

  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: minutes(15) } })
  @ApiOperation({ summary: 'Đăng nhập' })
  async login(@Body() dto: LoginDto) {
    const result = await this.authService.login(dto);
    return { success: true, data: result, message: 'Đăng nhập thành công' };
  }

  @Post('refresh')
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: minutes(15) } })
  @ApiOperation({
    summary: 'Đổi refreshToken lấy accessToken mới',
    description:
      'Frontend hiện CỐ Ý chưa gọi route này (xem docs/api-contract.md) — phiên lưu ở sessionStorage nên chết khi đóng tab, luồng silent-refresh gần như không có cơ hội chạy.',
  })
  async refresh(@Body() dto: RefreshDto) {
    const result = await this.authService.refresh(dto);
    return { success: true, data: result, message: 'Đã cấp accessToken mới' };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Thông tin user hiện tại' })
  getMe(@Request() req: AuthenticatedRequest) {
    const { passwordHash: _passwordHash, ...user } = req.user;
    return { success: true, data: user, message: 'OK' };
  }
}
