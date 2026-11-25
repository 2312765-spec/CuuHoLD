import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

// Upstream giữ nguyên như frontend đang gọi thẳng (frontend/src/constants/tileProvider.ts —
// lý do chọn openstreetmap.fr/hot ghi ở đó, CLAUDE.md Mục 15.12). Proxy chỉ đổi NƠI gọi.
const UPSTREAM = 'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png';
const TIMEOUT_MS = 8000;
// Chính sách tile của OSM yêu cầu User-Agent nhận diện được ứng dụng. Mặc định chung chung;
// đặt TILE_PROXY_USER_AGENT (kèm cách liên hệ) khi triển khai thật — docs/HOSTING.md Mục 0.
const USER_AGENT_MAC_DINH = 'tile-proxy/1.0';

export type TileResult =
  { found: true; data: Buffer; contentType: string } | { found: false };

@Injectable()
export class TilesService {
  private readonly logger = new Logger(TilesService.name);

  constructor(private readonly config: ConfigService) {}

  async fetchTile(z: number, x: number, y: number): Promise<TileResult> {
    const url = UPSTREAM.replace('{s}', 'abc'[Math.abs(x + y) % 3])
      .replace('{z}', String(z))
      .replace('{x}', String(x))
      .replace('{y}', String(y));

    let res: {
      status: number;
      data: Buffer;
      headers: Record<string, unknown>;
    };
    try {
      res = await axios.get<Buffer>(url, {
        responseType: 'arraybuffer',
        timeout: TIMEOUT_MS,
        // Tự xử lý mọi status bên dưới thay vì để axios ném lỗi cho 4xx/5xx.
        validateStatus: () => true,
        headers: {
          'User-Agent':
            this.config.get<string>('TILE_PROXY_USER_AGENT') ||
            USER_AGENT_MAC_DINH,
        },
      });
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
