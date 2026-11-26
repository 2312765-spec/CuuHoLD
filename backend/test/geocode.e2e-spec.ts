// HTTP thật (supertest) cho GET /api/geocode/reverse (CLAUDE.md 15.32): chỉ commander gọi được
// (RolesGuard chạy THẬT), lat/lng sai → 400, đúng shape { data: { tenDuong } }. Service giả lập
// — không gọi Nominatim thật.
import { Test } from '@nestjs/testing';
import {
  INestApplication,
  ExecutionContext,
  ValidationPipe,
} from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import type { Request } from 'express';
import { GeocodeController } from '../src/geocode/geocode.controller';
import { GeocodeService } from '../src/geocode/geocode.service';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';

describe('HTTP tra tên đường (/api/geocode/reverse)', () => {
  let app: INestApplication<App>;
  let role = 'commander';
  const geocodeService = {
    reverse: jest.fn<Promise<string | null>, [number, number]>(),
  };

  beforeAll(async () => {
    const mod = await Test.createTestingModule({
      controllers: [GeocodeController],
      providers: [{ provide: GeocodeService, useValue: geocodeService }],
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
    role = 'commander';
  });

  it('commander nhận tên đường, lat/lng được ép sang số', async () => {
    geocodeService.reverse.mockResolvedValueOnce('Đường Hùng Vương');
    const res = await request(app.getHttpServer())
      .get('/api/geocode/reverse')
      .query({ lat: '11.9404', lng: '108.4383' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      data: { tenDuong: 'Đường Hùng Vương' },
    });
    expect(geocodeService.reverse).toHaveBeenCalledWith(11.9404, 108.4383);
  });

  it.each(['victim', 'rescuer'])('%s bị 403', async (r) => {
    role = r;
    const res = await request(app.getHttpServer())
      .get('/api/geocode/reverse')
      .query({ lat: 11.94, lng: 108.43 });
    expect(res.status).toBe(403);
    expect(geocodeService.reverse).not.toHaveBeenCalled();
  });

  it('thiếu/sai lat → 400, không gọi service', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/geocode/reverse')
      .query({ lat: 'abc', lng: 108.43 });
    expect(res.status).toBe(400);
    expect(geocodeService.reverse).not.toHaveBeenCalled();
  });
});
