import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { SosImagesService, SOS_IMAGE_MAX_BYTES } from './sos-images.service';
import { SosService } from './sos.service';
import { User } from '../users/user.entity';

function buildUser(overrides: Partial<User> = {}): User {
  return {
    id: 'victim-1',
    phone: '0901234567',
    name: 'Nguyen Van A',
    passwordHash: 'hashed',
    role: 'victim',
    wardCode: '24781',
    isActive: true,
    lateCancelCount: 0,
    isFlagged: false,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

// Vài byte đầu đúng "chữ ký" định dạng thật — service kiểm nội dung file, KHÔNG tin
// mimetype do client khai (đổi đuôi .exe thành .jpg là qua được mimetype).
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const HTML = Buffer.from('<html><script>alert(1)</script></html>');

const SOS_ID = '11111111-1111-4111-8111-111111111111';

describe('SosImagesService', () => {
  let service: SosImagesService;
  let dataSource: { query: jest.Mock };
  let sosService: { findById: jest.Mock };

  beforeEach(() => {
    dataSource = { query: jest.fn() };
    sosService = { findById: jest.fn() };
    service = new SosImagesService(
      dataSource as unknown as DataSource,
      sosService as unknown as SosService,
    );
  });

  describe('attach', () => {
    const victim = buildUser();

    it('từ chối file không phải ảnh dù client khai mimetype image/jpeg', async () => {
      await expect(
        service.attach(SOS_ID, { buffer: HTML, size: HTML.length }, victim),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(dataSource.query).not.toHaveBeenCalled();
    });

    it('từ chối ảnh vượt giới hạn dung lượng', async () => {
      await expect(
        service.attach(
          SOS_ID,
          { buffer: JPEG, size: SOS_IMAGE_MAX_BYTES + 1 },
          victim,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(dataSource.query).not.toHaveBeenCalled();
    });

    it('ném NotFoundException khi SOS không tồn tại', async () => {
      dataSource.query.mockResolvedValueOnce([]);
      await expect(
        service.attach(SOS_ID, { buffer: JPEG, size: JPEG.length }, victim),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('ném ForbiddenException khi đính ảnh vào SOS của người khác', async () => {
      dataSource.query.mockResolvedValueOnce([
        { victim_id: 'victim-KHAC', status: 'pending' },
      ]);
      await expect(
        service.attach(SOS_ID, { buffer: JPEG, size: JPEG.length }, victim),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(dataSource.query).toHaveBeenCalledTimes(1);
    });

    it('từ chối đính ảnh khi SOS đã kết thúc', async () => {
      dataSource.query.mockResolvedValueOnce([
        { victim_id: 'victim-1', status: 'resolved' },
      ]);
      await expect(
        service.attach(SOS_ID, { buffer: JPEG, size: JPEG.length }, victim),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(dataSource.query).toHaveBeenCalledTimes(1);
    });

    it('lưu ảnh + gán image_url là đường dẫn ngắn (vừa VARCHAR(500) theo SRS)', async () => {
      dataSource.query
        .mockResolvedValueOnce([{ victim_id: 'victim-1', status: 'pending' }])
        .mockResolvedValueOnce([]);

      const result = await service.attach(
        SOS_ID,
        { buffer: PNG, size: PNG.length },
        victim,
      );

      expect(result).toEqual({ imageUrl: `/api/sos/${SOS_ID}/image` });
      expect(result.imageUrl.length).toBeLessThanOrEqual(500);
      const [sql, params] = dataSource.query.mock.calls[1] as [
        string,
        unknown[],
      ];
      expect(sql).toContain('INSERT INTO sos_images');
      expect(sql).toContain('UPDATE sos_requests');
      // Loại ảnh suy từ NỘI DUNG file (PNG), không phải từ client.
      expect(params).toEqual([
        SOS_ID,
        'image/png',
        PNG,
        PNG.length,
        `/api/sos/${SOS_ID}/image`,
      ]);
    });
  });

  describe('read', () => {
    it('kiểm quyền qua SosService.findById trước khi trả ảnh', async () => {
      const commander = buildUser({ id: 'cmd-1', role: 'commander' });
      sosService.findById.mockResolvedValueOnce({ id: SOS_ID });
      dataSource.query.mockResolvedValueOnce([
        { mime_type: 'image/jpeg', data: JPEG },
      ]);

      const anh = await service.read(SOS_ID, commander);

      expect(sosService.findById).toHaveBeenCalledWith(SOS_ID, commander);
      expect(anh).toEqual({ mimeType: 'image/jpeg', data: JPEG });
    });

    it('không có quyền xem SOS thì không đọc ảnh', async () => {
      const nguoiLa = buildUser({ id: 'victim-2' });
      sosService.findById.mockRejectedValueOnce(
        new ForbiddenException('Không có quyền'),
      );

      await expect(service.read(SOS_ID, nguoiLa)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(dataSource.query).not.toHaveBeenCalled();
    });

    it('ném NotFoundException khi SOS không có ảnh', async () => {
      sosService.findById.mockResolvedValueOnce({ id: SOS_ID });
      dataSource.query.mockResolvedValueOnce([]);

      await expect(
        service.read(SOS_ID, buildUser({ role: 'commander' })),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
