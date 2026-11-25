import { BadGatewayException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { TilesService } from './tiles.service';

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

  it('lỗi mạng / timeout → 502', async () => {
    axiosMock.get.mockRejectedValue(new Error('timeout of 8000ms exceeded'));
    await expect(
      new TilesService(buildConfig()).fetchTile(13, 6551, 3793),
    ).rejects.toBeInstanceOf(BadGatewayException);
  });
});
