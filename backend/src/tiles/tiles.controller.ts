import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Res,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle, minutes } from '@nestjs/throttler';
import type { Response } from 'express';
import { tileTrongVungPhucVu } from './tile-bounds';
import { TilesService } from './tiles.service';

// Proxy tile nền bản đồ (docs/tile-proxy-plan.md). CỐ Ý không có JwtAuthGuard: tile tải bằng
// thẻ <img>, không gửi được Bearer token. Bù lại: chỉ phục vụ tile trong tỉnh (tile-bounds.ts)
// + rate limit riêng theo IP (cần TRUST_PROXY_HOPS đúng, CLAUDE.md Mục 15.28).
@ApiTags('Tiles')
@Controller('tiles')
export class TilesController {
  constructor(private readonly tiles: TilesService) {}

  // 600/phút/IP: mỗi màn hình bản đồ ~20–40 tile, kéo/zoom liên tục vài chục màn hình mỗi phút
  // vẫn dưới ngưỡng; mặc định toàn cục 100/phút thì một lần zoom nhanh đã chạm.
  @Get(':z/:x/:y.png')
  @Throttle({ default: { limit: 600, ttl: minutes(1) } })
  @ApiOperation({
    summary: 'Tile nền bản đồ (proxy openstreetmap.fr/hot, chỉ vùng Lâm Đồng)',
  })
  async getTile(
    @Param('z', ParseIntPipe) z: number,
    @Param('x', ParseIntPipe) x: number,
    @Param('y', ParseIntPipe) y: number,
    @Res() res: Response,
  ): Promise<void> {
    if (!tileTrongVungPhucVu(z, x, y)) {
      throw new BadRequestException(
        'Tile nằm ngoài vùng phục vụ (tỉnh Lâm Đồng)',
      );
    }
    const kq = await this.tiles.fetchTile(z, x, y);
    if (!kq.found) throw new NotFoundException('Không có tile ở mức zoom này');

    res.set({
      'Content-Type': kq.contentType,
      // Tile z/x/y gần như bất biến (OSM đổi theo tháng) — trình duyệt giữ 1 ngày.
      'Cache-Control': 'public, max-age=86400',
      // helmet() mặc định 'same-origin' → trình duyệt chặn ảnh khi FE (Vercel) khác tên miền BE.
      'Cross-Origin-Resource-Policy': 'cross-origin',
    });
    res.send(kq.data);
  }
}
