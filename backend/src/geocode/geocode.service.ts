import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { LAMDONG_BBOX } from '../tiles/tile-bounds';

// Tra TÊN ĐƯỜNG từ toạ độ (reverse geocode) cho thẻ SOS / ghim cảnh báo trên Bảng điều phối
// (CLAUDE.md 15.32). Trước đây trình duyệt commander gọi thẳng nominatim.openstreetmap.org — hai
// vấn đề: (1) DNS Viettel chặn cả tên miền openstreetmap.org (Mục 15.12) → mạng Viettel không bao
// giờ có tên đường; (2) toạ độ nạn nhân rời trình duyệt đi kèm IP + Referer của commander. Gọi
// qua backend: chỉ server (Render, không qua DNS Viettel) nói chuyện với Nominatim, có cache CHUNG
// cho mọi commander, và hàng đợi bảo đảm cả server ≤ 1 yêu cầu/giây (chính sách Nominatim).
const URL_NOMINATIM = 'https://nominatim.openstreetmap.org/reverse';
const TIMEOUT_MS = 8000;
// Chính sách Nominatim yêu cầu User-Agent nhận diện được ứng dụng — đặt GEOCODE_USER_AGENT
// (kèm cách liên hệ) khi triển khai thật; không có thì dùng chung biến của proxy tile.
const USER_AGENT_MAC_DINH = 'rescue-gis-geocode/1.0';
export const KHOANG_CACH_MS = 1100;
// Quá số yêu cầu đang chờ này → 503 ngay, tránh dồn hàng chục giây chờ.
export const HANG_DOI_TOI_DA = 50;
// Tên đường hầu như không đổi; giữ 7 ngày. Giới hạn số mục để RAM không phình.
const CACHE_TTL_MS = 7 * 24 * 3600_000;
const CACHE_TOI_DA = 5000;

type DiaChi = Record<string, string | undefined>;

// Ưu tiên tên đường; không có đường (giữa rừng, ruộng) thì lùi về thôn/khu phố gần nhất.
export function tenDuongTuDiaChi(addr: DiaChi | undefined): string | null {
  if (!addr) return null;
  const duong =
    addr.road ?? addr.pedestrian ?? addr.footway ?? addr.path ?? addr.track;
  if (duong) return addr.house_number ? `${addr.house_number} ${duong}` : duong;
  const khuVuc =
    addr.hamlet ??
    addr.neighbourhood ??
    addr.quarter ??
    addr.village ??
    addr.suburb;
  return khuVuc ? `Gần ${khuVuc}` : null;
}

function cho(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

@Injectable()
export class GeocodeService {
  private readonly logger = new Logger(GeocodeService.name);
  private readonly cache = new Map<
    string,
    { ten: string | null; hetHan: number }
  >();
  private readonly dangTra = new Map<string, Promise<string | null>>();
  private hangDoi: Promise<unknown> = Promise.resolve();
  private soDangCho = 0;
  private lanGoiCuoi = 0;

  constructor(private readonly config: ConfigService) {}

  async reverse(lat: number, lng: number): Promise<string | null> {
    const b = LAMDONG_BBOX;
    if (lat < b.minLat || lat > b.maxLat || lng < b.minLng || lng > b.maxLng) {
      throw new BadRequestException(
        'Toạ độ nằm ngoài tỉnh Lâm Đồng — không tra tên đường',
      );
    }
    const khoa = `${lat.toFixed(4)},${lng.toFixed(4)}`;
    const daCo = this.cache.get(khoa);
    if (daCo && daCo.hetHan > Date.now()) return daCo.ten;
    const dangTra = this.dangTra.get(khoa);
    if (dangTra) return dangTra;

    if (this.soDangCho >= HANG_DOI_TOI_DA) {
      throw new ServiceUnavailableException('Dịch vụ tra tên đường đang bận');
    }
    this.soDangCho++;
    const viec = this.hangDoi.then(async () => {
      const doiThem = this.lanGoiCuoi + KHOANG_CACH_MS - Date.now();
      if (doiThem > 0) await cho(doiThem);
      this.lanGoiCuoi = Date.now();
      return this.goiNominatim(lat, lng);
    });
    this.hangDoi = viec.catch(() => undefined);
    const ketQua = viec
      .then((ten) => {
        this.ghiCache(khoa, ten);
        return ten;
      })
      .finally(() => {
        this.soDangCho--;
        this.dangTra.delete(khoa);
      });
    this.dangTra.set(khoa, ketQua);
    return ketQua;
  }

  private ghiCache(khoa: string, ten: string | null): void {
    this.cache.delete(khoa);
    this.cache.set(khoa, { ten, hetHan: Date.now() + CACHE_TTL_MS });
    // Map giữ thứ tự chèn → mục đầu là mục cũ nhất.
    for (const cuNhat of this.cache.keys()) {
      if (this.cache.size <= CACHE_TOI_DA) break;
      this.cache.delete(cuNhat);
    }
  }

  private async goiNominatim(lat: number, lng: number): Promise<string | null> {
    try {
      const { data } = await axios.get<{ address?: DiaChi }>(URL_NOMINATIM, {
        params: {
          format: 'jsonv2',
          lat,
          lon: lng,
          zoom: 17,
          'accept-language': 'vi',
        },
        headers: {
          'User-Agent':
            this.config.get<string>('GEOCODE_USER_AGENT') ||
            this.config.get<string>('TILE_PROXY_USER_AGENT') ||
            USER_AGENT_MAC_DINH,
        },
        timeout: TIMEOUT_MS,
      });
      return tenDuongTuDiaChi(data?.address);
    } catch (err) {
      // Không ghi toạ độ vào log (vị trí nạn nhân là dữ liệu cá nhân).
      this.logger.warn(
        `Nominatim lỗi: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw new ServiceUnavailableException('Không tra được tên đường');
    }
  }
}
