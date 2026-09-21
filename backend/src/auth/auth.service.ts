import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { RegisterDto } from './dto/register.dto';
import type { JwtPayload } from './jwt-payload.interface';
import { User } from '../users/user.entity';
import { UsersService } from '../users/users.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    const user = await this.usersService.create(dto);
    return this.createAuthResponse(user);
  }

  async login(dto: LoginDto) {
    const user = await this.usersService.findByPhone(dto.phone);
    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Sai thông tin đăng nhập');
    }
    if (!user.isActive) {
      // 403 chứ không phải 401 (SRS 3.1.2): 401 = "chưa chứng minh được danh tính",
      // còn đây danh tính ĐÚNG nhưng bị từ chối quyền vào. Chấp nhận việc này để lộ
      // "số điện thoại này có tài khoản đang bị khoá" — register đã lộ sự tồn tại của
      // số qua 409 Conflict rồi, giữ 401 ở đây không bảo vệ thêm được gì.
      throw new ForbiddenException('Tài khoản đã bị khóa');
    }
    return this.createAuthResponse(user);
  }

  // Đổi refreshToken (7 ngày) lấy accessToken mới. KHÔNG cấp refreshToken mới (không
  // rotation): chưa có bảng lưu token nên rotation cũng không phát hiện được tái sử dụng,
  // chỉ thêm phức tạp mà không thêm an toàn. Hệ quả cần biết: token bị lộ dùng được đủ
  // 7 ngày, không có đường thu hồi — muốn thu hồi phải thêm bảng refresh_tokens.
  async refresh(dto: RefreshDto) {
    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(
        dto.refreshToken,
        // BẮT BUỘC dùng JWT_REFRESH_SECRET. Nếu lỡ dùng JWT_SECRET, chính accessToken
        // đang cầm cũng đổi được thành accessToken mới, lặp vô hạn → hạn 24h vô nghĩa.
        { secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET') },
      );
    } catch {
      throw new UnauthorizedException(
        'Refresh token không hợp lệ hoặc đã hết hạn',
      );
    }

    const user = await this.usersService.findById(payload.sub);
    if (!user) throw new UnauthorizedException('Tài khoản không còn tồn tại');
    // Cùng lý do với login (SRS 3.1.2): thiếu kiểm tra này thì tài khoản vừa bị khoá
    // vẫn tự gia hạn được accessToken 24h mới qua đường refresh.
    if (!user.isActive) throw new ForbiddenException('Tài khoản đã bị khóa');

    return {
      accessToken: await this.signAccessToken(user),
      expiresIn: 86400,
    };
  }

  private buildPayload(user: User): JwtPayload {
    return {
      sub: user.id,
      phone: user.phone,
      role: user.role,
      wardCode: user.wardCode,
    };
  }

  private signAccessToken(user: User): Promise<string> {
    return this.jwtService.signAsync(this.buildPayload(user), {
      secret: this.configService.getOrThrow<string>('JWT_SECRET'),
      expiresIn: '24h',
    });
  }

  private async createAuthResponse(user: User) {
    const refreshSecret =
      this.configService.getOrThrow<string>('JWT_REFRESH_SECRET');
    const [accessToken, refreshToken] = await Promise.all([
      this.signAccessToken(user),
      this.jwtService.signAsync(this.buildPayload(user), {
        secret: refreshSecret,
        expiresIn: '7d',
      }),
    ]);
    const { passwordHash: _passwordHash, ...safeUser } = user;
    return {
      user: safeUser,
      accessToken,
      refreshToken,
      expiresIn: 86400,
    };
  }
}
