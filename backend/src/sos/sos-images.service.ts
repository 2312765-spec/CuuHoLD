import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { SosService } from './sos.service';
import { SOS_TERMINAL_STATUSES } from './sos.entity';
import type { SosStatus } from './sos.entity';
import { User } from '../users/user.entity';

// F-SOS-06 — ảnh hiện trường đính kèm SOS (CLAUDE.md Mục 15.14, gis/10-create-sos-images.sql).
// Ảnh gửi SAU khi SOS đã tạo xong: tải ảnh chậm/lỗi không bao giờ được làm chậm hay làm hỏng
// tín hiệu cứu hộ. sos_requests.image_url chỉ giữ đường dẫn ngắn (SRS: VARCHAR(500)).

// Khớp CHECK size_bytes ở gis/10 — frontend nén về ~1280px nên thực tế chỉ vài trăm KB.
export const SOS_IMAGE_MAX_BYTES = 2 * 1024 * 1024;

type SosImageMime = 'image/jpeg' | 'image/png' | 'image/webp';

export interface UploadedImage {
  buffer: Buffer;
  size: number;
}

export interface SosImage {
  mimeType: SosImageMime;
  data: Buffer;
}

// Nhận diện loại ảnh theo NỘI DUNG file (magic bytes), không tin mimetype/đuôi file do client
// khai — tránh bị dùng làm chỗ chứa HTML/script rồi phát lại dưới tên "ảnh".
function nhanDienAnh(buf: Buffer): SosImageMime | null {
  if (
    buf.length >= 3 &&
    buf[0] === 0xff &&
    buf[1] === 0xd8 &&
    buf[2] === 0xff
  ) {
    return 'image/jpeg';
  }
  if (
    buf.length >= 8 &&
    buf
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return 'image/png';
  }
  if (
    buf.length >= 12 &&
    buf.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buf.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp';
  }
  return null;
}

export function duongDanAnhSos(sosId: string): string {
  return `/api/sos/${sosId}/image`;
}

@Injectable()
export class SosImagesService {
  constructor(
    private dataSource: DataSource,
    private sosService: SosService,
  ) {}

  async attach(
    sosId: string,
    file: UploadedImage,
    victim: User,
  ): Promise<{ imageUrl: string }> {
    if (file.size > SOS_IMAGE_MAX_BYTES) {
      throw new BadRequestException('Ảnh quá lớn (tối đa 2 MB)');
    }
    const mimeType = nhanDienAnh(file.buffer);
    if (!mimeType) {
      throw new BadRequestException('Chỉ nhận ảnh JPEG, PNG hoặc WebP');
    }

    const rows = await this.dataSource.query<
      { victim_id: string; status: SosStatus }[]
    >('SELECT victim_id, status FROM sos_requests WHERE id = $1', [sosId]);
    const sos = rows[0];
    if (!sos) throw new NotFoundException('Không tìm thấy SOS');
    if (sos.victim_id !== victim.id) {
      throw new ForbiddenException('Không có quyền');
    }
    if (SOS_TERMINAL_STATUSES.includes(sos.status)) {
      throw new BadRequestException('SOS đã kết thúc, không thể đính kèm ảnh');
    }

    const imageUrl = duongDanAnhSos(sosId);
    // 1 câu lệnh (CTE) để ghi ảnh + gán image_url cùng thành công hoặc cùng thất bại.
    // Không dùng UPDATE ... RETURNING — driver trả tuple (xem CLAUDE.md Mục 15.11).
    await this.dataSource.query(
      `WITH anh AS (
         INSERT INTO sos_images (sos_id, mime_type, data, size_bytes)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (sos_id) DO UPDATE
           SET mime_type = EXCLUDED.mime_type, data = EXCLUDED.data,
               size_bytes = EXCLUDED.size_bytes, created_at = NOW()
         RETURNING sos_id
       )
       UPDATE sos_requests SET image_url = $5, updated_at = NOW()
       WHERE id IN (SELECT sos_id FROM anh)`,
      [sosId, mimeType, file.buffer, file.size, imageUrl],
    );
    return { imageUrl };
  }

  async read(sosId: string, user: User): Promise<SosImage> {
    // Ai xem được SOS thì xem được ảnh của nó — tái dùng đúng luật quyền của GET /api/sos/:id
    // (victim chủ SOS, rescuer cùng xã hoặc leader đội được giao, commander).
    await this.sosService.findById(sosId, user);
    const rows = await this.dataSource.query<
      { mime_type: SosImageMime; data: Buffer }[]
    >('SELECT mime_type, data FROM sos_images WHERE sos_id = $1', [sosId]);
    const anh = rows[0];
    if (!anh) throw new NotFoundException('SOS này không có ảnh hiện trường');
    return { mimeType: anh.mime_type, data: anh.data };
  }
}
