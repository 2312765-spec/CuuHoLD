// HTTP thật (supertest) cho proxy tile: route khớp đúng `/tiles/:z/:x/:y.png`, z/x/y sai hoặc
// ngoài tỉnh → 400 không gọi upstream, header cache + CORP đúng kể cả khi có helmet() như
// main.ts (helmet mặc định đặt Cross-Origin-Resource-Policy: same-origin → ảnh từ FE ở tên miền
// khác sẽ bị trình duyệt chặn). Service giả lập — không gọi mạng.
import { BadGatewayException, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import helmet from 'helmet';
import request from 'supertest';
import { App } from 'supertest/types';
import { TilesController } from '../src/tiles/tiles.controller';
import { TilesService, TileResult } from '../src/tiles/tiles.service';
import { tileX, tileY } from '../src/tiles/tile-bounds';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);
const Z = 13;
const X = tileX(108.44, Z);
const Y = tileY(11.94, Z);

describe('HTTP proxy tile', () => {
  let app: INestApplication<App>;
  const tiles = {
    fetchTile: jest.fn<Promise<TileResult>, [number, number, number]>(),
  };

  beforeAll(async () => {
    const mod = await Test.createTestingModule({
      controllers: [TilesController],
      providers: [{ provide: TilesService, useValue: tiles }],
    }).compile();
    app = mod.createNestApplication();
    app.use(helmet());
    app.setGlobalPrefix('api');
    await app.init();
  });
  afterAll(async () => {
    await app.close();
  });
  beforeEach(() => tiles.fetchTile.mockReset());

  it('200: trả ảnh + cache 1 ngày + CORP cross-origin', async () => {
    tiles.fetchTile.mockResolvedValue({
      found: true,
      data: PNG,
      contentType: 'image/png',
    });
    const r = await request(app.getHttpServer()).get(
      `/api/tiles/${Z}/${X}/${Y}.png`,
    );

    expect(r.status).toBe(200);
    expect(tiles.fetchTile).toHaveBeenCalledWith(Z, X, Y);
    expect(r.headers['content-type']).toBe('image/png');
    expect(r.headers['cache-control']).toBe('public, max-age=86400');
    expect(r.headers['cross-origin-resource-policy']).toBe('cross-origin');
    expect(Buffer.compare(r.body as Buffer, PNG)).toBe(0);
  });

  it('404 khi upstream không có tile (frontend tự lùi về tile cha)', async () => {
    tiles.fetchTile.mockResolvedValue({ found: false });
    const r = await request(app.getHttpServer()).get(
      `/api/tiles/${Z}/${X}/${Y}.png`,
    );
    expect(r.status).toBe(404);
  });

  it('502 khi upstream lỗi', async () => {
    tiles.fetchTile.mockRejectedValue(new BadGatewayException());
    const r = await request(app.getHttpServer()).get(
      `/api/tiles/${Z}/${X}/${Y}.png`,
    );
    expect(r.status).toBe(502);
  });

  it.each([
    ['z không phải số', `/api/tiles/abc/${X}/${Y}.png`],
    ['z âm', `/api/tiles/-1/${X}/${Y}.png`],
    [
      'ngoài tỉnh (Hà Nội)',
      `/api/tiles/${Z}/${tileX(105.85, Z)}/${tileY(21.03, Z)}.png`,
    ],
    ['z quá sâu', `/api/tiles/25/${X}/${Y}.png`],
  ])('400: %s — không gọi upstream', async (_ten, url) => {
    const r = await request(app.getHttpServer()).get(url);
    expect(r.status).toBe(400);
    expect(tiles.fetchTile).not.toHaveBeenCalled();
  });
});
