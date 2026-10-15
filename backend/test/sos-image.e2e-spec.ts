// HTTP thật (supertest) cho F-SOS-06 — kiểm phần unit test không chạm tới: multer đọc đúng
// field "image", giới hạn 2 MB chặn ở tầng HTTP (413) trước khi tới service, ParseUUIDPipe trả
// 400 thay vì để Postgres ném 500, header trả ảnh. Service + guard được giả lập (không cần DB).
import { Test } from '@nestjs/testing';
import { INestApplication, ExecutionContext } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import type { Request } from 'express';
import { SosController } from '../src/sos/sos.controller';
import { SosService } from '../src/sos/sos.service';
import { SosImagesService } from '../src/sos/sos-images.service';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../src/auth/guards/roles.guard';

const ID = '11111111-1111-4111-8111-111111111111';
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);

describe('HTTP ảnh SOS', () => {
  let app: INestApplication<App>;
  const images = {
    attach: jest.fn<
      Promise<{ imageUrl: string }>,
      [string, { buffer: Buffer; size: number }, unknown]
    >(),
    read: jest.fn<
      Promise<{ mimeType: string; data: Buffer }>,
      [string, unknown]
    >(),
  };
  beforeAll(async () => {
    const mod = await Test.createTestingModule({
      controllers: [SosController],
      providers: [
        { provide: SosService, useValue: {} },
        { provide: SosImagesService, useValue: images },
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
    await app.init();
  });
  afterAll(() => app.close());

  it('multipart field image → service nhận buffer + size', async () => {
    images.attach.mockResolvedValueOnce({ imageUrl: `/api/sos/${ID}/image` });
    const r = await request(app.getHttpServer())
      .post(`/api/sos/${ID}/image`)
      .attach('image', JPEG, 'a.jpg');
    expect(r.status).toBe(201);
    const [id, file] = images.attach.mock.calls[0];
    expect(id).toBe(ID);
    expect(Buffer.compare(file.buffer, JPEG)).toBe(0);
    expect(file.size).toBe(JPEG.length);
  });
  it('thiếu file → 400', async () => {
    const r = await request(app.getHttpServer()).post(`/api/sos/${ID}/image`);
    expect(r.status).toBe(400);
  });
  it('id không phải UUID → 400 (không để Postgres ném 500)', async () => {
    const r = await request(app.getHttpServer())
      .post(`/api/sos/abc/image`)
      .attach('image', JPEG, 'a.jpg');
    expect(r.status).toBe(400);
  });
  it('file > 2MB → 413, service không bị gọi', async () => {
    images.attach.mockClear();
    const r = await request(app.getHttpServer())
      .post(`/api/sos/${ID}/image`)
      .attach('image', Buffer.alloc(2 * 1024 * 1024 + 10, 1), 'big.jpg');
    expect(r.status).toBe(413);
    expect(images.attach).not.toHaveBeenCalled();
  });
  it('GET trả đúng bytes + content-type + cache private', async () => {
    images.read.mockResolvedValueOnce({ mimeType: 'image/jpeg', data: JPEG });
    const r = await request(app.getHttpServer())
      .get(`/api/sos/${ID}/image`)
      .buffer(true)
      .parse((res, cb) => {
        const c: Buffer[] = [];
        res.on('data', (d: Buffer) => c.push(d));
        res.on('end', () => cb(null, Buffer.concat(c)));
      });
    expect(r.status).toBe(200);
    expect(r.headers['content-type']).toBe('image/jpeg');
    expect(r.headers['cache-control']).toBe('private, max-age=3600');
    expect(Buffer.compare(r.body as Buffer, JPEG)).toBe(0);
  });
});
