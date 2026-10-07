import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UsersService } from './users.service';
import type { User, UserRole } from './user.entity';
import { AdminCreateUserDto } from './dto/admin-create-user.dto';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';

interface AuthenticatedRequest extends Request {
  user: User;
}

// Không bao giờ trả passwordHash ra ngoài — cùng cách destructure "_passwordHash" đã dùng ở
// auth.service.ts/auth.controller.ts (quy ước ignore-pattern có sẵn, xem CLAUDE.md Mục 15.2).
type SafeUser = Omit<User, 'passwordHash'>;
function toSafeUser(user: User): SafeUser {
  const { passwordHash: _passwordHash, ...safeUser } = user;
  return safeUser;
}

// Toàn bộ module quản lý người dùng CHỈ commander gọi được — @Roles('commander') đặt ở CLASS,
// áp dụng cho mọi route bên dưới, không phải khai báo lặp lại từng route như GisController.
@ApiTags('Users (Admin)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('commander')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách người dùng (lọc theo role nếu có)' })
  async findAll(
    @Query('role') role?: UserRole,
  ): Promise<{ success: true; data: SafeUser[]; message: string }> {
    const users = await this.usersService.findAll(role);
    return { success: true, data: users.map(toSafeUser), message: 'OK' };
  }

  @Post()
  @ApiOperation({
    summary: 'Tạo tài khoản mới (chọn role tự do — chỉ commander)',
  })
  async create(
    @Body() dto: AdminCreateUserDto,
  ): Promise<{ success: true; data: SafeUser; message: string }> {
    const user = await this.usersService.createByAdmin(dto);
    return {
      success: true,
      data: toSafeUser(user),
      message: 'Đã tạo tài khoản',
    };
  }

  @Patch(':id/role')
  @ApiOperation({
    summary: 'Đổi vai trò người dùng (không tự đổi role của chính mình)',
  })
  async updateRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserRoleDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<{ success: true; data: SafeUser; message: string }> {
    const user = await this.usersService.updateRole(id, dto.role, req.user.id);
    return { success: true, data: toSafeUser(user), message: 'Đã đổi vai trò' };
  }

  @Patch(':id/status')
  @ApiOperation({
    summary: 'Khoá/mở khoá tài khoản (không tự khoá chính mình)',
  })
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserStatusDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<{ success: true; data: SafeUser; message: string }> {
    const user = await this.usersService.updateStatus(
      id,
      dto.isActive,
      req.user.id,
    );
    return {
      success: true,
      data: toSafeUser(user),
      message: dto.isActive ? 'Đã mở khoá tài khoản' : 'Đã khoá tài khoản',
    };
  }
}
