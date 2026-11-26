// Tra tên đường qua backend (CLAUDE.md 15.32): cache chung cho mọi commander, hàng đợi 1 yêu
// cầu/KHOANG_CACH_MS cho CẢ server (chính sách Nominatim), chỉ nhận toạ độ trong tỉnh.
import {
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import axios from 'axios';
import {
  GeocodeService,
  KHOANG_CACH_MS,
  tenDuongTuDiaChi,
} from './geocode.service';

jest.mock('axios');
const axiosGet = (
  axios as unknown as {
    get: jest.Mock<
      Promise<unknown>,
      [string, { params?: unknown; headers?: unknown }?]
    >;
  }
).get;

function buildConfig(env: Record<string, string> = {}): ConfigService {
  return { get: (k: string) => env[k] } as unknown as ConfigService;
}

function phanHoi(address: Record<string, string>) {
  return { data: { address } };
}

// Đà Lạt — trong tỉnh.
const LAT = 11.94041;
const LNG = 108.43831;

describe('tenDuongTuDiaChi', () => {
  it('số nhà + đường → ghép; không có đường → "Gần <thôn>"; không có gì → null', () => {
    expect(
      tenDuongTuDiaChi({ road: 'Đường Trần Hưng Đạo', house_number: '12' }),
    ).toBe('12 Đường Trần Hưng Đạo');
    expect(tenDuongTuDiaChi({ hamlet: 'Thôn 3' })).toBe('Gần Thôn 3');
    expect(tenDuongTuDiaChi({})).toBeNull();
    expect(tenDuongTuDiaChi(undefined)).toBeNull();
  });
});

describe('GeocodeService', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    axiosGet.mockReset();
  });
  afterEach(() => jest.useRealTimers());

  it('toạ độ ngoài tỉnh → 400, không gọi Nominatim', async () => {
    const svc = new GeocodeService(buildConfig());
    await expect(svc.reverse(21.03, 105.85)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(axiosGet).not.toHaveBeenCalled();
  });

  it('gửi tiếng Việt + User-Agent nhận diện được, trả tên đường', async () => {
    axiosGet.mockResolvedValueOnce(phanHoi({ road: 'Đường Hùng Vương' }));
    const svc = new GeocodeService(
      buildConfig({ GEOCODE_USER_AGENT: 'ten-app/1.0' }),
    );
    await expect(svc.reverse(LAT, LNG)).resolves.toBe('Đường Hùng Vương');
    const [url, opts] = axiosGet.mock.calls[0];
    expect(url).toContain('nominatim.openstreetmap.org/reverse');
    expect(opts?.params).toMatchObject({ 'accept-language': 'vi' });
    expect(opts?.headers).toMatchObject({ 'User-Agent': 'ten-app/1.0' });
  });

  it('cùng toạ độ (làm tròn ~11 m) chỉ gọi 1 lần, kể cả khi hỏi đồng thời', async () => {
    axiosGet.mockResolvedValue(phanHoi({ road: 'Đường Hùng Vương' }));
    const svc = new GeocodeService(buildConfig());
    const a = svc.reverse(LAT, LNG);
    const b = svc.reverse(LAT + 0.00001, LNG + 0.00001);
    await jest.runAllTimersAsync();
    expect(await a).toBe('Đường Hùng Vương');
    expect(await b).toBe('Đường Hùng Vương');
    await expect(svc.reverse(LAT, LNG)).resolves.toBe('Đường Hùng Vương');
    expect(axiosGet).toHaveBeenCalledTimes(1);
  });

  it('"không có đường" (null) cũng được cache — không hỏi lại điểm giữa rừng', async () => {
    axiosGet.mockResolvedValue(phanHoi({}));
    const svc = new GeocodeService(buildConfig());
    await expect(svc.reverse(LAT, LNG)).resolves.toBeNull();
    await expect(svc.reverse(LAT, LNG)).resolves.toBeNull();
    expect(axiosGet).toHaveBeenCalledTimes(1);
  });

  it('Nominatim lỗi → 503 và KHÔNG cache, lần sau hỏi lại được', async () => {
    axiosGet
      .mockRejectedValueOnce(new Error('ECONNRESET'))
      .mockResolvedValueOnce(phanHoi({ road: 'Đường 3 Tháng 2' }));
    const svc = new GeocodeService(buildConfig());
    const lan1 = svc.reverse(LAT, LNG);
    const kiem1 = expect(lan1).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    await jest.runAllTimersAsync();
    await kiem1;
    const lan2 = svc.reverse(LAT, LNG);
    await jest.runAllTimersAsync();
    await expect(lan2).resolves.toBe('Đường 3 Tháng 2');
  });

  it('các toạ độ khác nhau gọi tuần tự, cách nhau ≥ KHOANG_CACH_MS', async () => {
    const thoiDiem: number[] = [];
    axiosGet.mockImplementation(() => {
      thoiDiem.push(Date.now());
      return Promise.resolve(phanHoi({ road: 'X' }));
    });
    const svc = new GeocodeService(buildConfig());
    const ds = [0, 1, 2].map((i) => svc.reverse(LAT + i * 0.01, LNG));
    await jest.runAllTimersAsync();
    await Promise.all(ds);
    expect(thoiDiem).toHaveLength(3);
    expect(thoiDiem[1] - thoiDiem[0]).toBeGreaterThanOrEqual(KHOANG_CACH_MS);
    expect(thoiDiem[2] - thoiDiem[1]).toBeGreaterThanOrEqual(KHOANG_CACH_MS);
  });
});
