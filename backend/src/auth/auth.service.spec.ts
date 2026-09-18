import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { User } from '../users/user.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

jest.mock('bcrypt');

function buildUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    phone: '0901234567',
    name: 'Nguyen Van A',
    passwordHash: 'hashed-password',
    role: 'victim',
    wardCode: '24781',
    isActive: true,
    lateCancelCount: 0,
    isFlagged: false,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

describe('AuthService', () => {
  let service: AuthService;
  let usersService: {
    create: jest.Mock;
    findByPhone: jest.Mock;
    findById: jest.Mock;
  };
  let jwtService: { signAsync: jest.Mock; verifyAsync: jest.Mock };
  let configService: { getOrThrow: jest.Mock };

  beforeEach(() => {
    usersService = {
      create: jest.fn(),
      findByPhone: jest.fn(),
      findById: jest.fn(),
    };
    jwtService = {
      signAsync: jest.fn().mockResolvedValue('signed-token'),
      verifyAsync: jest.fn(),
    };
    configService = {
      getOrThrow: jest.fn((key: string) =>
        key === 'JWT_SECRET' ? 'access-secret' : 'refresh-secret',
      ),
    };
    service = new AuthService(
      usersService as unknown as UsersService,
      jwtService as unknown as JwtService,
      configService as unknown as ConfigService,
    );
    jest.mocked(bcrypt.compare).mockReset();
  });

  describe('register', () => {
    it('tạo user mới và trả về token kèm user không có passwordHash', async () => {
      usersService.create.mockResolvedValue(buildUser());
      const dto: RegisterDto = {
        phone: '0901234567',
        name: 'Nguyen Van A',
        password: 'matkhau123',
      };

      const result = await service.register(dto);

      expect(usersService.create).toHaveBeenCalledWith(dto);
      expect(result.accessToken).toBe('signed-token');
      expect(result.refreshToken).toBe('signed-token');
      expect(result.expiresIn).toBe(86400);
      expect(result.user).not.toHaveProperty('passwordHash');
    });
  });

  describe('login', () => {
    const dto: LoginDto = { phone: '0901234567', password: 'matkhau123' };

    it('đăng nhập thành công khi mật khẩu đúng và tài khoản active', async () => {
      usersService.findByPhone.mockResolvedValue(buildUser());
      jest.mocked(bcrypt.compare).mockResolvedValue(true as never);

      const result = await service.login(dto);

      expect(result.accessToken).toBe('signed-token');
      expect(result.user).not.toHaveProperty('passwordHash');
    });

    it('ném UnauthorizedException khi không tìm thấy user', async () => {
      usersService.findByPhone.mockResolvedValue(null);

      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
    });

    it('ném UnauthorizedException khi sai mật khẩu', async () => {
      usersService.findByPhone.mockResolvedValue(buildUser());
      jest.mocked(bcrypt.compare).mockResolvedValue(false as never);

      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
    });

    // TDD cho CLAUDE.md kế hoạch F-AUTH-02 (SRS 3.1.2): tài khoản bị khoá phải trả 403
    // (ForbiddenException), KHÔNG phải 401 (UnauthorizedException) như trước — 401 chỉ dành
    // cho sai mật khẩu/không tồn tại (kể cả 2 test phía trên vẫn đúng, không đổi). Message
    // giữ nguyên, chỉ đổi loại exception (quyết định A — xem thảo luận về đánh đổi bảo mật
    // enumeration ở phiên trước: register đã lộ số điện thoại tồn tại qua 409 rồi nên giữ
    // 401 ở đây không còn bảo vệ được gì).
    it('ném ForbiddenException (403) khi tài khoản đã bị khóa — KHÔNG phải UnauthorizedException', async () => {
      usersService.findByPhone.mockResolvedValue(
        buildUser({ isActive: false }),
      );
      jest.mocked(bcrypt.compare).mockResolvedValue(true as never);

      await expect(service.login(dto)).rejects.toThrow(ForbiddenException);
      await expect(service.login(dto)).rejects.toThrow('Tài khoản đã bị khóa');
    });
  });

  // TDD cho POST /api/auth/refresh (CLAUDE.md Mục 7 + SRS TC-15) — route chưa từng tồn tại
  // dù backend đã cấp sẵn refreshToken từ lúc login/register. Phạm vi đã chốt: CHỈ làm
  // endpoint backend, frontend cố ý chưa dùng (sessionStorage chết khi đóng tab nên luồng
  // silent-refresh gần như không có cơ hội chạy — xem docs/api-contract.md).
  describe('refresh', () => {
    const REFRESH_TOKEN = 'refresh-token-hop-le';

    it('token hợp lệ → cấp accessToken mới, verify bằng ĐÚNG refresh secret', async () => {
      jwtService.verifyAsync.mockResolvedValue({ sub: 'user-1' });
      usersService.findById.mockResolvedValue(buildUser());

      const result = await service.refresh({ refreshToken: REFRESH_TOKEN });

      // Phải verify bằng JWT_REFRESH_SECRET — nếu lỡ dùng JWT_SECRET thì accessToken
      // (24h) cũng sẽ đổi được thành accessToken mới vô hạn, hỏng toàn bộ ý nghĩa hạn token.
      expect(jwtService.verifyAsync).toHaveBeenCalledWith(REFRESH_TOKEN, {
        secret: 'refresh-secret',
      });
      expect(result.accessToken).toBe('signed-token');
      expect(result.expiresIn).toBe(86400);
      // KHÔNG cấp refreshToken mới (không rotation) — không có bảng lưu token nên rotation
      // cũng không phát hiện được tái sử dụng, chỉ thêm phức tạp mà không thêm an toàn.
      expect(result).not.toHaveProperty('refreshToken');
    });

    it('token sai/hết hạn → UnauthorizedException', async () => {
      jwtService.verifyAsync.mockRejectedValue(new Error('jwt expired'));

      await expect(
        service.refresh({ refreshToken: 'token-rac' }),
      ).rejects.toThrow(UnauthorizedException);
      expect(usersService.findById).not.toHaveBeenCalled();
    });

    it('token hợp lệ nhưng user không còn tồn tại → UnauthorizedException', async () => {
      jwtService.verifyAsync.mockResolvedValue({ sub: 'user-da-xoa' });
      usersService.findById.mockResolvedValue(null);

      await expect(
        service.refresh({ refreshToken: REFRESH_TOKEN }),
      ).rejects.toThrow(UnauthorizedException);
    });

    // Quan trọng nhất: thiếu kiểm tra này thì tài khoản vừa bị khoá vẫn tự gia hạn được
    // accessToken 24h mới, vô hiệu hoá luôn phần vừa sửa ở F-AUTH-02.
    it('tài khoản bị khoá → ForbiddenException (403), KHÔNG được tự gia hạn token', async () => {
      jwtService.verifyAsync.mockResolvedValue({ sub: 'user-1' });
      usersService.findById.mockResolvedValue(buildUser({ isActive: false }));

      await expect(
        service.refresh({ refreshToken: REFRESH_TOKEN }),
      ).rejects.toThrow(ForbiddenException);
      expect(jwtService.signAsync).not.toHaveBeenCalled();
    });
  });
});
