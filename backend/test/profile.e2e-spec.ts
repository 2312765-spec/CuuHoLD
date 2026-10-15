// HTTP thật (supertest) cho F-UI-01 — kiểm phần unit test không chạm tới: 2 route /users/me
// nằm cạnh UsersController (commander-only, có PATCH ':id/role', ':id/status') mà KHÔNG bị nó
// nuốt hay chặn quyền; mọi vai trò dùng được; body có phone/wardCode/role → 400; không trả
// passwordHash. Service + JwtAuthGuard được giả lập (không cần DB), RolesGuard chạy THẬT.
import { Test } from '@nestjs/testing';
import {
  INestApplication,
  ExecutionContext,
  ValidationPipe,
} from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import type { Request } from 'express';
import { UsersController } from '../src/users/users.controller';
import { ProfileController } from '../src/users/profile.controller';
import { UsersService } from '../src/users/users.service';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';

describe('HTTP hồ sơ cá nhân (/api/users/me)', () => {
  let app: INestApplication<App>;
  let role = 'victim';
  const usersService = {
    updateMyName: jest.fn<Promise<unknown>, [string, string]>(),
    changeMyPassword: jest.fn<Promise<void>, [string, string, string]>(),
    updateRole: jest.fn(),
    updateStatus: jest.fn(),
  };

  beforeAll(async () => {
    const mod = await Test.createTestingModule({
      controllers: [UsersController, ProfileController],
      providers: [{ provide: UsersService, useValue: usersService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (c: ExecutionContext) => {
          c.switchToHttp().getRequest<Request & { user: unknown }>().user = {
            id: 'u1',
            role,
          };
          return true;
        },
      })
      .compile();
    app = mod.createNestApplication();
    app.setGlobalPrefix('api');
    // Cùng cấu hình ValidationPipe với src/main.ts.
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });
  afterAll(() => app.close());
  beforeEach(() => {
    jest.clearAllMocks();
    role = 'victim';
  });

  it.each(['victim', 'rescuer', 'commander'])(
    '%s sửa được tên của mình; response không có passwordHash',
    async (r) => {
      role = r;
      usersService.updateMyName.mockResolvedValueOnce({
        id: 'u1',
        name: 'Ten Moi',
        phone: '0901234567',
        passwordHash: 'bi-mat',
      });
      const res = await request(app.getHttpServer())
        .patch('/api/users/me')
        .send({ name: 'Ten Moi' });
      expect(res.status).toBe(200);
      expect(usersService.updateMyName).toHaveBeenCalledWith('u1', 'Ten Moi');
      const body = res.body as { data: Record<string, unknown> };
      expect(body.data.name).toBe('Ten Moi');
      expect(body.data).not.toHaveProperty('passwordHash');
      expect(usersService.updateRole).not.toHaveBeenCalled();
    },
  );

  it('gửi kèm phone/wardCode/role → 400, service không bị gọi', async () => {
    for (const them of [
      { phone: '0999999999' },
      { wardCode: '99999' },
      { role: 'commander' },
    ]) {
      const res = await request(app.getHttpServer())
        .patch('/api/users/me')
        .send({ name: 'Ten Moi', ...them });
      expect(res.status).toBe(400);
    }
    expect(usersService.updateMyName).not.toHaveBeenCalled();
  });

  it('đổi mật khẩu: gọi service đúng tham số, trả 200', async () => {
    role = 'rescuer';
    usersService.changeMyPassword.mockResolvedValueOnce(undefined);
    const res = await request(app.getHttpServer())
      .patch('/api/users/me/password')
      .send({ currentPassword: 'cu', newPassword: 'matkhau-moi' });
    expect(res.status).toBe(200);
    expect(usersService.changeMyPassword).toHaveBeenCalledWith(
      'u1',
      'cu',
      'matkhau-moi',
    );
    expect(usersService.updateStatus).not.toHaveBeenCalled();
  });

  it('mật khẩu mới quá ngắn → 400, service không bị gọi', async () => {
    const res = await request(app.getHttpServer())
      .patch('/api/users/me/password')
      .send({ currentPassword: 'cu', newPassword: 'ngan' });
    expect(res.status).toBe(400);
    expect(usersService.changeMyPassword).not.toHaveBeenCalled();
  });

  it('route quản trị /users/:id/role vẫn chỉ cho commander (route /me không làm hở)', async () => {
    role = 'victim';
    const res = await request(app.getHttpServer())
      .patch('/api/users/u2/role')
      .send({ role: 'commander' });
    expect(res.status).toBe(403);
  });
});
