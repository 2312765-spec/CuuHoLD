import {
  BadGatewayException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import {
  TilesService,
  UPSTREAM_DONG_THOI_TOI_DA,
  HANG_DOI_TOI_DA,
} from './tiles.service';

jest.mock('axios');

// Cùng cách cast với routing.service.spec.ts — tránh unbound-method false-positive.
const axiosMock = axios as unknown as {
  get: jest.Mock<Promise<unknown>, unknown[]>;
};

function buildConfig(values: Record<string, string> = {}): ConfigService {
  return { get: (key: string) => values[key] } as unknown as ConfigService;
}

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);

describe('TilesService.fetchTile', () => {
  beforeEach(() => axiosMock.get.mockReset());

  it('gọi đúng upstream openstreetmap.fr/hot với z/x/y, trả ảnh', async () => {
    axiosMock.get.mockResolvedValue({
      status: 200,
      data: PNG,
      headers: { 'content-type': 'image/png' },
    });
    const kq = await new TilesService(buildConfig()).fetchTile(13, 6551, 3793);

    expect(kq).toEqual({ found: true, data: PNG, contentType: 'image/png' });
    const [url, opts] = axiosMock.get.mock.calls[0] as [
      string,
      {
        responseType: string;
        timeout: number;
        headers: Record<string, string>;
      },
    ];
    expect(url).toMatch(
      /^https:\/\/[abc]\.tile\.openstreetmap\.fr\/hot\/13\/6551\/3793\.png$/,
    );
    expect(opts.responseType).toBe('arraybuffer');
    expect(opts.timeout).toBeGreaterThan(0);
    expect(opts.headers['User-Agent']).toBeTruthy();
  });

  it('dùng TILE_PROXY_USER_AGENT nếu có cấu hình', async () => {
    axiosMock.get.mockResolvedValue({
      status: 200,
      data: PNG,
      headers: { 'content-type': 'image/png' },
    });
    await new TilesService(
      buildConfig({ TILE_PROXY_USER_AGENT: 'ten-app/1.0 (mailto:a@b.c)' }),
    ).fetchTile(13, 6551, 3793);
    const opts = axiosMock.get.mock.calls[0][1] as {
      headers: Record<string, string>;
    };
    expect(opts.headers['User-Agent']).toBe('ten-app/1.0 (mailto:a@b.c)');
  });

  it('upstream 404 (vùng thưa không có tile) → found=false, KHÔNG ném lỗi', async () => {
    axiosMock.get.mockResolvedValue({
      status: 404,
      data: Buffer.alloc(0),
      headers: {},
    });
    const kq = await new TilesService(buildConfig()).fetchTile(18, 1, 1);
    expect(kq).toEqual({ found: false });
  });

  it('upstream 200 nhưng không phải ảnh → 502 (không chuyển tiếp trang HTML lạ)', async () => {
    axiosMock.get.mockResolvedValue({
      status: 200,
      data: Buffer.from('<html>'),
      headers: { 'content-type': 'text/html' },
    });
    await expect(
      new TilesService(buildConfig()).fetchTile(13, 6551, 3793),
    ).rejects.toBeInstanceOf(BadGatewayException);
  });

  it.each([429, 500, 503])('upstream %p → 502', async (status) => {
    axiosMock.get.mockResolvedValue({
      status,
      data: Buffer.alloc(0),
      headers: {},
    });
    await expect(
      new TilesService(buildConfig()).fetchTile(13, 6551, 3793),
    ).rejects.toBeInstanceOf(BadGatewayException);
  });

  it('lỗi mạng / timeout 2 lần liên tiếp → 502', async () => {
    axiosMock.get.mockRejectedValue(new Error('timeout of 8000ms exceeded'));
    await expect(
      new TilesService(buildConfig()).fetchTile(13, 6551, 3793),
    ).rejects.toBeInstanceOf(BadGatewayException);
  });
});

// Bug thật trên Render (2026-11-25): trình duyệt bắn ~40 tile song song mỗi lần zoom; Render mở
// bấy nhiêu kết nối cùng lúc tới openstreetmap.fr → 26/40 lỗi kết nối nhanh (~0,5–1,5 s) → 502.
// Cùng 40 tile mà 6 song song thì 40/40 thành công, tổng thời gian không đổi (~3,2 s).
describe('TilesService — giới hạn kết nối tới upstream', () => {
  beforeEach(() => axiosMock.get.mockReset());
  const ANH = {
    status: 200,
    data: PNG,
    headers: { 'content-type': 'image/png' },
  };

  it(`không bao giờ quá ${UPSTREAM_DONG_THOI_TOI_DA} request upstream cùng lúc, các tile sau xếp hàng`, async () => {
    let dangChay = 0;
    let caoNhat = 0;
    axiosMock.get.mockImplementation(async () => {
      dangChay++;
      caoNhat = Math.max(caoNhat, dangChay);
      await new Promise((r) => setTimeout(r, 5));
      dangChay--;
      return ANH;
    });
    const svc = new TilesService(buildConfig());
    const kq = await Promise.all(
      Array.from({ length: 40 }, (_, i) => svc.fetchTile(13, 6500 + i, 3800)),
    );
    expect(kq.every((k) => k.found)).toBe(true);
    expect(caoNhat).toBe(UPSTREAM_DONG_THOI_TOI_DA);
  });

  it('lỗi kết nối 1 lần → thử lại và trả tile', async () => {
    axiosMock.get
      .mockRejectedValueOnce(new Error('socket hang up'))
      .mockResolvedValueOnce(ANH);
    const kq = await new TilesService(buildConfig()).fetchTile(13, 6551, 3793);
    expect(kq.found).toBe(true);
    expect(axiosMock.get).toHaveBeenCalledTimes(2);
  });

  it('hàng đợi đầy → 503 ngay (frontend chuyển sang gọi thẳng, không chờ lâu)', async () => {
    let tha!: () => void;
    const chan = new Promise<void>((r) => (tha = r));
    axiosMock.get.mockImplementation(async () => {
      await chan;
      return ANH;
    });
    const svc = new TilesService(buildConfig());
    const dangCho = Array.from(
      { length: UPSTREAM_DONG_THOI_TOI_DA + HANG_DOI_TOI_DA },
      (_, i) => svc.fetchTile(13, 6000 + i, 3800),
    );
    await expect(svc.fetchTile(13, 1, 1)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    tha();
    await Promise.all(dangCho);
  });

  it('request lỗi vẫn trả chỗ cho hàng đợi (không kẹt vĩnh viễn)', async () => {
    axiosMock.get.mockRejectedValue(new Error('ECONNRESET'));
    const svc = new TilesService(buildConfig());
    await Promise.allSettled(
      Array.from({ length: 20 }, (_, i) => svc.fetchTile(13, 6500 + i, 3800)),
    );
    axiosMock.get.mockReset();
    axiosMock.get.mockResolvedValue(ANH);
    const kq = await Promise.all(
      Array.from({ length: 10 }, (_, i) => svc.fetchTile(13, 6600 + i, 3800)),
    );
    expect(kq.every((k) => k.found)).toBe(true);
  });
});
