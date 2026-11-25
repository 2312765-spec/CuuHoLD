import {
  BadGatewayException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { Agent } from 'node:https';

// Upstream giữ nguyên như frontend đang gọi thẳng (frontend/src/constants/tileProvider.ts —
// lý do chọn openstreetmap.fr/hot ghi ở đó, CLAUDE.md Mục 15.12). Proxy chỉ đổi NƠI gọi.
const UPSTREAM = 'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png';
const TIMEOUT_MS = 8000;
// Chính sách tile của OSM yêu cầu User-Agent nhận diện được ứng dụng. Mặc định chung chung;
// đặt TILE_PROXY_USER_AGENT (kèm cách liên hệ) khi triển khai thật — docs/HOSTING.md Mục 0.
const USER_AGENT_MAC_DINH = 'tile-proxy/1.0';

// Bug thật trên Render (2026-11-25): trình duyệt bắn ~40 tile song song mỗi lần zoom; Render mở
// bấy nhiêu kết nối cùng lúc tới openstreetmap.fr → 26/40 lỗi kết nối nhanh (~0,5–1,5 s) → 502,
// cầu dao frontend ngắt. Cùng 40 tile mà 6 song song: 40/40 thành công, tổng thời gian không đổi.
// Máy chủ tình nguyện giới hạn kết nối đồng thời mỗi IP — mà mọi người dùng đều chung IP Render.
export const UPSTREAM_DONG_THOI_TOI_DA = 6;
// Quá số tile đang chờ này → 503 ngay: frontend coi như proxy lỗi, tự gọi thẳng upstream, thay vì
// để tile xếp hàng lâu tới mức bản đồ trống.
export const HANG_DOI_TOI_DA = 200;
// Lỗi kết nối thoáng qua (socket hang up, ECONNRESET) — thử lại 1 lần sau quãng nghỉ ngắn.
const NGHI_TRUOC_THU_LAI_MS = 300;

// Giữ kết nối để tái dùng thay vì mở TLS mới cho mỗi tile.
const KET_NOI = new Agent({
  keepAlive: true,
  maxSockets: UPSTREAM_DONG_THOI_TOI_DA,
});

export type TileResult =
  { found: true; data: Buffer; contentType: string } | { found: false };

@Injectable()
export class TilesService {
  private readonly logger = new Logger(TilesService.name);

  // Theo từng instance (Nest tạo đúng 1 — singleton), test tạo instance riêng nên không lẫn nhau.
  private dangChay = 0;
  private readonly hangDoi: Array<() => void> = [];

  constructor(private readonly config: ConfigService) {}

  async fetchTile(z: number, x: number, y: number): Promise<TileResult> {
    await this.xinCho();
    try {
      return await this.taiTile(z, x, y);
    } finally {
      this.traCho();
    }
  }

  private xinCho(): Promise<void> {
    if (this.dangChay < UPSTREAM_DONG_THOI_TOI_DA) {
      this.dangChay++;
      return Promise.resolve();
    }
    if (this.hangDoi.length >= HANG_DOI_TOI_DA) {
      return Promise.reject(
        new ServiceUnavailableException('Máy chủ bản đồ đang quá tải'),
      );
    }
    // Chỗ được chuyển thẳng cho người chờ (dangChay giữ nguyên) — xem traCho().
    return new Promise((resolve) => this.hangDoi.push(resolve));
  }

  private traCho(): void {
    const tiepTheo = this.hangDoi.shift();
    if (tiepTheo) tiepTheo();
    else this.dangChay--;
  }

  private async taiTile(z: number, x: number, y: number): Promise<TileResult> {
    const url = UPSTREAM.replace('{s}', 'abc'[Math.abs(x + y) % 3])
      .replace('{z}', String(z))
      .replace('{x}', String(x))
      .replace('{y}', String(y));

    let res: {
      status: number;
      data: Buffer;
      headers: Record<string, unknown>;
    };
    const goi = () =>
      axios.get<Buffer>(url, {
        responseType: 'arraybuffer',
        timeout: TIMEOUT_MS,
        // Tự xử lý mọi status bên dưới thay vì để axios ném lỗi cho 4xx/5xx.
        validateStatus: () => true,
        httpsAgent: KET_NOI,
        headers: {
          'User-Agent':
            this.config.get<string>('TILE_PROXY_USER_AGENT') ||
            USER_AGENT_MAC_DINH,
        },
      });
    try {
      try {
        res = await goi();
      } catch {
        await new Promise((r) => setTimeout(r, NGHI_TRUOC_THU_LAI_MS));
        res = await goi();
      }
    } catch (err) {
      this.logger.warn(
        `Upstream tile ${z}/${x}/${y} lỗi mạng: ${(err as Error).message}`,
      );
      throw new BadGatewayException('Không tải được tile từ máy chủ bản đồ');
    }

    // 404 bền vững ở vùng thưa dữ liệu (đo 2026-09-18) — KHÔNG phải lỗi: frontend tự lùi về
    // tile cha (utils/tileLayer.ts). Không được biến thành 502.
    if (res.status === 404) return { found: false };

    const ct = res.headers['content-type'];
    const contentType = typeof ct === 'string' ? ct : '';
    if (res.status !== 200 || !contentType.startsWith('image/')) {
      this.logger.warn(
        `Upstream tile ${z}/${x}/${y}: HTTP ${res.status} ${contentType}`,
      );
      throw new BadGatewayException(
        'Máy chủ bản đồ trả về dữ liệu không hợp lệ',
      );
    }
    return { found: true, data: Buffer.from(res.data), contentType };
  }
}
