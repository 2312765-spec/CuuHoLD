// HTTP thật (supertest) cho F-PWA-05 — kiểm đúng hợp đồng mà frontend (services/pushService.ts)
// đang gọi: 3 route, DELETE nhận endpoint trong BODY, body sai → 400, thiếu VAPID → 503.
// PushService + JwtAuthGuard được giả lập (không cần DB, không gửi push thật).
import { Test } from '@nestjs/testing';
import {
  INestApplication,
  ExecutionContext,
  ValidationPipe,
  ServiceUnavailableException,
} from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import type { Request } from 'express';
import { PushController } from '../src/push/push.controller';
import { PushService } from '../src/push/push.service';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';

const SUB = {
  endpoint: 'https://fcm.googleapis.com/fcm/send/abc',
  expirationTime: null,
  keys: { p256dh: 'p256', auth: 'au' },
};

describe('HTTP thông báo đẩy (/api/push)', () => {
  let app: INestApplication<App>;
  const push = {
    layKhoaCongKhai: jest.fn<string, []>(),
    dangKy: jest.fn<Promise<void>, [string, unknown]>(),
    huyDangKy: jest.fn<Promise<void>, [string, string]>(),
  };

  beforeAll(async () => {
    const mod = await Test.createTestingModule({
      controllers: [PushController],
      providers: [{ provide: PushService, useValue: push }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (c: ExecutionContext) => {
          c.switchToHttp().getRequest<Request & { user: unknown }>().user = {
            id: 'u1',
            role: 'rescuer',
          };
          return true;
        },
      })
      .compile();
    app = mod.createNestApplication();
    app.setGlobalPrefix('api');
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
  beforeEach(() => jest.clearAllMocks());

  it('GET /push/vapid-public-key → { publicKey }', async () => {
    push.layKhoaCongKhai.mockReturnValueOnce('BPublicKey');
    const r = await request(app.getHttpServer()).get(
      '/api/push/vapid-public-key',
    );
    expect(r.status).toBe(200);
    expect((r.body as { data: unknown }).data).toEqual({
      publicKey: 'BPublicKey',
    });
  });

  it('chưa cấu hình VAPID → 503', async () => {
    push.layKhoaCongKhai.mockImplementationOnce(() => {
      throw new ServiceUnavailableException('Chưa cấu hình');
    });
    const r = await request(app.getHttpServer()).get(
      '/api/push/vapid-public-key',
    );
    expect(r.status).toBe(503);
  });

  it('POST /push/subscriptions nhận nguyên PushSubscription.toJSON(), gắn với người gọi', async () => {
    push.dangKy.mockResolvedValueOnce(undefined);
    const r = await request(app.getHttpServer())
      .post('/api/push/subscriptions')
      .send(SUB);
    expect(r.status).toBe(201);
    expect(push.dangKy).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({ endpoint: SUB.endpoint, keys: SUB.keys }),
    );
  });

  it('POST body sai (endpoint http, thiếu keys) → 400, không lưu', async () => {
    for (const body of [
      { ...SUB, endpoint: 'http://x.example.com' },
      { endpoint: SUB.endpoint },
    ]) {
      const r = await request(app.getHttpServer())
        .post('/api/push/subscriptions')
        .send(body);
      expect(r.status).toBe(400);
    }
    expect(push.dangKy).not.toHaveBeenCalled();
  });

  it('DELETE /push/subscriptions đọc endpoint trong BODY', async () => {
    push.huyDangKy.mockResolvedValueOnce(undefined);
    const r = await request(app.getHttpServer())
      .delete('/api/push/subscriptions')
      .send({ endpoint: SUB.endpoint });
    expect(r.status).toBe(200);
    expect(push.huyDangKy).toHaveBeenCalledWith('u1', SUB.endpoint);
  });
});
