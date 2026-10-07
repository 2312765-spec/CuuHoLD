import { NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { HazardsService } from './hazards.service';
import type { SosGateway } from '../sos/sos.gateway';

const HAZARD_ROW = {
  id: 'h1',
  type: 'landslide',
  description: 'Sạt lở taluy dương',
  lat: 11.94,
  lng: 108.44,
  radius_meters: 200,
  severity: 'blocked',
  ward_code: '24781',
  is_active: true,
  created_at: '2026-09-25T00:00:00.000Z',
  resolved_at: null,
};

describe('HazardsService', () => {
  let dataSource: { query: jest.Mock };
  let sosGateway: { emitSystemNotification: jest.Mock };
  let service: HazardsService;

  beforeEach(() => {
    dataSource = { query: jest.fn() };
    sosGateway = { emitSystemNotification: jest.fn() };
    service = new HazardsService(
      dataSource as unknown as DataSource,
      sosGateway as unknown as SosGateway,
    );
  });

  describe('findActive', () => {
    it('chỉ lấy cảnh báo is_active=true, mới nhất trước', async () => {
      dataSource.query.mockResolvedValueOnce([HAZARD_ROW]);

      const result = await service.findActive();

      expect(result).toEqual([HAZARD_ROW]);
      const [sql] = dataSource.query.mock.calls[0] as [string];
      expect(sql).toContain('WHERE h.is_active = true');
      expect(sql).toContain('ORDER BY h.created_at DESC');
    });
  });

  describe('findAll', () => {
    it('lấy cả cảnh báo đã gỡ, không lọc is_active', async () => {
      dataSource.query.mockResolvedValueOnce([HAZARD_ROW]);

      await service.findAll();

      const [sql] = dataSource.query.mock.calls[0] as [string];
      expect(sql).not.toContain('WHERE');
    });
  });

  describe('create', () => {
    it('INSERT đúng thứ tự ST_MakePoint(lng, lat) rồi trả hazard vừa tạo, emit cảnh báo', async () => {
      dataSource.query
        .mockResolvedValueOnce([{ id: 'h1' }]) // INSERT ... RETURNING id
        .mockResolvedValueOnce([HAZARD_ROW]); // findById

      const result = await service.create(
        {
          type: 'landslide',
          description: 'Sạt lở taluy dương',
          lat: 11.94,
          lng: 108.44,
          radiusMeters: 200,
        },
        'commander-1',
      );

      expect(result).toEqual(HAZARD_ROW);
      const [insertSql, insertParams] = dataSource.query.mock.calls[0] as [
        string,
        unknown[],
      ];
      expect(insertSql).toContain('ST_MakePoint($3, $4)');
      // [type, description, lng, lat, radiusMeters, creatorId, severity] — $3=lng TRƯỚC $4=lat
      expect(insertParams).toEqual([
        'landslide',
        'Sạt lở taluy dương',
        108.44,
        11.94,
        200,
        'commander-1',
        'blocked', // mặc định ĐỎ (chặn đường) khi không chọn mức độ
      ]);

      expect(sosGateway.emitSystemNotification).toHaveBeenCalledWith(
        '24781',
        // cảnh báo ĐỎ (chặn đường) → mức 'critical'; VÀNG (cẩn trọng) → 'warning'
        expect.objectContaining({ level: 'critical' }),
      );
    });

    it('dùng bán kính mặc định 200m khi không truyền radiusMeters', async () => {
      dataSource.query
        .mockResolvedValueOnce([{ id: 'h1' }])
        .mockResolvedValueOnce([HAZARD_ROW]);

      await service.create(
        { type: 'fallen_tree', lat: 11.94, lng: 108.44 },
        'commander-1',
      );

      const [, insertParams] = dataSource.query.mock.calls[0] as [
        string,
        unknown[],
      ];
      expect(insertParams[4]).toBe(200);
    });
  });

  describe('resolve', () => {
    it('set is_active=false, resolved_at=NOW(), trả hazard đã cập nhật, emit cảnh báo info', async () => {
      const resolvedRow = { ...HAZARD_ROW, is_active: false };
      dataSource.query
        .mockResolvedValueOnce([[{ id: 'h1' }], 1]) // UPDATE...RETURNING → tuple [rows, count]
        .mockResolvedValueOnce([resolvedRow]); // findById

      const result = await service.resolve('h1');

      expect(result).toEqual(resolvedRow);
      const [updateSql] = dataSource.query.mock.calls[0] as [string];
      expect(updateSql).toContain('is_active = false');
      expect(updateSql).toContain('resolved_at = NOW()');
      expect(sosGateway.emitSystemNotification).toHaveBeenCalledWith(
        '24781',
        expect.objectContaining({ level: 'info' }),
      );
    });

    it('ném NotFoundException khi id không tồn tại', async () => {
      dataSource.query.mockResolvedValueOnce([[], 0]);

      await expect(service.resolve('khong-ton-tai')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findActiveAvoidPolygons', () => {
    it('trả null khi không có cảnh báo active nào', async () => {
      dataSource.query.mockResolvedValueOnce([]);

      const result = await service.findActiveAvoidPolygons();

      expect(result).toBeNull();
    });

    it('gộp buffer của từng cảnh báo thành 1 MultiPolygon', async () => {
      const polygonA = {
        type: 'Polygon',
        coordinates: [
          [
            [108.44, 11.94],
            [108.45, 11.94],
            [108.44, 11.94],
          ],
        ],
      };
      const polygonB = {
        type: 'Polygon',
        coordinates: [
          [
            [108.46, 11.96],
            [108.47, 11.96],
            [108.46, 11.96],
          ],
        ],
      };
      dataSource.query.mockResolvedValueOnce([
        { geojson: JSON.stringify(polygonA) },
        { geojson: JSON.stringify(polygonB) },
      ]);

      const result = await service.findActiveAvoidPolygons();

      expect(result).toEqual({
        type: 'MultiPolygon',
        coordinates: [polygonA.coordinates, polygonB.coordinates],
      });
      const [sql] = dataSource.query.mock.calls[0] as [string];
      expect(sql).toContain('ST_Buffer(location::geography, radius_meters)');
      expect(sql).toContain('WHERE is_active = true');
    });

    it("CHỈ lấy cảnh báo ĐỎ ('blocked') — cảnh báo VÀNG ('caution') chỉ hiển thị, không làm tuyến đi vòng", async () => {
      dataSource.query.mockResolvedValueOnce([]);
      await service.findActiveAvoidPolygons();
      const [sql] = dataSource.query.mock.calls[0] as [string];
      expect(sql).toContain("severity = 'blocked'");
    });
  });

  describe('create — mức độ', () => {
    it('truyền severity=caution (vàng) xuống INSERT khi được chọn', async () => {
      dataSource.query
        .mockResolvedValueOnce([{ id: 'h1' }])
        .mockResolvedValueOnce([{ ...HAZARD_ROW, severity: 'caution' }]);
      await service.create(
        { type: 'fallen_tree', lat: 11.94, lng: 108.44, severity: 'caution' },
        'commander-1',
      );
      const [, params] = dataSource.query.mock.calls[0] as [string, unknown[]];
      expect(params[6]).toBe('caution');
    });
  });
});
