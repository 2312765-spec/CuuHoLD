// HTTP thật (supertest) cho chống dò mật khẩu (CLAUDE.md 15.30): đăng nhập đúng nhiều lần
// không bị chặn; sai 5 lần → 429 kèm số phút. Kiểm phần unit test không chạm tới: Nest tự
// khởi tạo LoginAttemptsService (tham số đồng hồ @Optional), @Ip() truyền đúng IP, và mã
// 429 + câu tiếng Việt đi tới client. UsersService/JwtService giả lập — không cần DB.
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { App } from 'supertest/types';
import * as bcrypt from 'bcrypt';
import { AuthController } from '../src/auth/auth.controller';
import { AuthService } from '../src/auth/auth.service';
import { LoginAttemptsService } from '../src/auth/login-attempts.service';
import { UsersService } from '../src/users/users.service';

jest.mock('bcrypt');

describe('HTTP đăng nhập — khoá khi sai nhiều lần', () => {
  let app: INestApplication<App>;
  const user = {
    id: 'u1',
    phone: '0901234567',
    name: 'A',
    passwordHash: 'h',
    role: 'victim',
    wardCode: null,
    isActive: true,
  };

  beforeAll(async () => {
    const mod = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        AuthService,
        LoginAttemptsService,
        {
          provide: UsersService,
          useValue: { findByPhone: jest.fn().mockResolvedValue(user) },
        },
        {
          provide: JwtService,
          useValue: { signAsync: jest.fn().mockResolvedValue('tok') },
        },
        { provide: ConfigService, useValue: { getOrThrow: () => 's' } },
      ],
    }).compile();
    app = mod.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();
  });
  afterAll(() => app.close());

  const dangNhap = () =>
    request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ phone: user.phone, password: 'matkhau123' });

  it('đăng nhập đúng 8 lần liên tiếp đều 200 (trước đây lần thứ 6 đã bị chặn)', async () => {
    jest.mocked(bcrypt.compare).mockResolvedValue(true as never);
    for (let i = 0; i < 8; i++) await dangNhap().expect(200);
  });

  it('sai 5 lần → 429 kèm số phút, kể cả khi lần sau nhập đúng', async () => {
    jest.mocked(bcrypt.compare).mockResolvedValue(false as never);
    for (let i = 0; i < 4; i++) await dangNhap().expect(401);
    const lan5 = await dangNhap().expect(401);
    expect(JSON.stringify(lan5.body)).toContain('Sai thông tin đăng nhập');

    jest.mocked(bcrypt.compare).mockResolvedValue(true as never);
    const biKhoa = await dangNhap().expect(429);
    expect(JSON.stringify(biKhoa.body)).toContain('15 phút');
  });
});
