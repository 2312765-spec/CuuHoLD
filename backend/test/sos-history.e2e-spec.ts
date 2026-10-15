// HTTP thật (supertest) cho F-UI-02 — kiểm phần unit test không chạm tới: route
// 'mine/history' không bị ':id' nuốt mất, query string được đổi sang số, query sai → 400
// (không để OFFSET âm tới Postgres). Service + guard được giả lập (không cần DB).
import { Test } from '@nestjs/testing';
import {
  INestApplication,
  ExecutionContext,
  ValidationPipe,
} from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import type { Request } from 'express';
import { SosController } from '../src/sos/sos.controller';
import { SosService } from '../src/sos/sos.service';
import { SosImagesService } from '../src/sos/sos-images.service';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../src/auth/guards/roles.guard';

describe('HTTP lịch sử SOS', () => {
  let app: INestApplication<App>;
  const sosService = {
    findMyHistory: jest.fn<Promise<unknown>, [unknown, number, number]>(),
    findById: jest.fn<Promise<unknown>, [string, unknown]>(),
  };

  beforeAll(async () => {
    const mod = await Test.createTestingModule({
      controllers: [SosController],
      providers: [
        { provide: SosService, useValue: sosService },
        { provide: SosImagesService, useValue: {} },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (c: ExecutionContext) => {
          c.switchToHttp().getRequest<Request & { user: unknown }>().user = {
            id: 'v1',
            role: 'victim',
          };
          return true;
        },
      })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
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
    sosService.findMyHistory.mockReset();
    sosService.findById.mockReset();
  });

  it('gọi đúng findMyHistory (không rơi vào GET /:id), đổi query sang số', async () => {
    sosService.findMyHistory.mockResolvedValueOnce({
      items: [],
      total: 0,
      page: 2,
      limit: 5,
    });
    const r = await request(app.getHttpServer()).get(
      '/api/sos/mine/history?page=2&limit=5',
    );
    expect(r.status).toBe(200);
    expect(sosService.findById).not.toHaveBeenCalled();
    expect(sosService.findMyHistory).toHaveBeenCalledWith(
      { id: 'v1', role: 'victim' },
      2,
      5,
    );
  });

  it('không truyền query → mặc định trang 1, 10 dòng', async () => {
    sosService.findMyHistory.mockResolvedValueOnce({
      items: [],
      total: 0,
      page: 1,
      limit: 10,
    });
    await request(app.getHttpServer()).get('/api/sos/mine/history');
    expect(sosService.findMyHistory).toHaveBeenCalledWith(
      expect.anything(),
      1,
      10,
    );
  });

  it('query vô lý → 400, service không bị gọi', async () => {
    for (const q of ['page=0', 'page=-1', 'limit=500', 'limit=abc', 'la=1']) {
      const r = await request(app.getHttpServer()).get(
        `/api/sos/mine/history?${q}`,
      );
      expect(r.status).toBe(400);
    }
    expect(sosService.findMyHistory).not.toHaveBeenCalled();
  });
});
