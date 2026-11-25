// HTTP thật (supertest): sau proxy của Render, req.ip phải là IP người dùng (lấy từ
// X-Forwarded-For) — không thì UserThrottlerGuard dồn mọi request login/register chưa có token
// vào CHUNG 1 bucket IP của proxy: 5 lần đăng nhập của bất kỳ ai → cả tỉnh bị 429.
import { Controller, Get, INestApplication, Req } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import type { Request } from 'express';
import request from 'supertest';
import { App } from 'supertest/types';
import { cauHinhTrustProxy } from '../src/common/http/trust-proxy';

@Controller()
class IpController {
  @Get('ip')
  ip(@Req() req: Request): { ip: string | undefined } {
    return { ip: req.ip };
  }
}

async function taoApp(hops: number): Promise<INestApplication<App>> {
  const mod = await Test.createTestingModule({
    controllers: [IpController],
  }).compile();
  const app = mod.createNestApplication<NestExpressApplication>();
  cauHinhTrustProxy(app, hops);
  await app.init();
  return app;
}

describe('trust proxy', () => {
  let app: INestApplication<App>;
  afterEach(async () => {
    await app.close();
  });

  it('hops=1: lấy IP người dùng mà proxy gắn vào cuối X-Forwarded-For', async () => {
    app = await taoApp(1);
    const r = await request(app.getHttpServer())
      .get('/ip')
      .set('X-Forwarded-For', '203.0.113.7');
    expect((r.body as { ip: string }).ip).toBe('203.0.113.7');
  });

  it('hops=1: client tự chèn IP giả ở đầu header không đổi được bucket', async () => {
    app = await taoApp(1);
    // Proxy thật luôn NỐI IP thật vào cuối; giá trị client tự gửi nằm phía trước.
    const r = await request(app.getHttpServer())
      .get('/ip')
      .set('X-Forwarded-For', '1.1.1.1, 203.0.113.7');
    expect((r.body as { ip: string }).ip).toBe('203.0.113.7');
  });

  it('hops=0 (mặc định, chạy máy dev): bỏ qua X-Forwarded-For', async () => {
    app = await taoApp(0);
    const r = await request(app.getHttpServer())
      .get('/ip')
      .set('X-Forwarded-For', '203.0.113.7');
    expect((r.body as { ip: string }).ip).not.toBe('203.0.113.7');
  });
});
