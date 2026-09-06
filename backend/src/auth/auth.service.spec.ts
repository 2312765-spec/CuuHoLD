import { UnauthorizedException } from '@nestjs/common';
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
  let usersService: { create: jest.Mock; findByPhone: jest.Mock };
  let jwtService: { signAsync: jest.Mock };
  let configService: { getOrThrow: jest.Mock };

  beforeEach(() => {
    usersService = { create: jest.fn(), findByPhone: jest.fn() };
    jwtService = { signAsync: jest.fn().mockResolvedValue('signed-token') };
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

    it('ném UnauthorizedException khi tài khoản đã bị khóa', async () => {
      usersService.findByPhone.mockResolvedValue(
        buildUser({ isActive: false }),
      );
      jest.mocked(bcrypt.compare).mockResolvedValue(true as never);

      await expect(service.login(dto)).rejects.toThrow('Tài khoản đã bị khóa');
    });
  });
});
