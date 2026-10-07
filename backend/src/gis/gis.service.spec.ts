import { DataSource } from 'typeorm';
import { GisService } from './gis.service';

describe('GisService', () => {
  let dataSource: { query: jest.Mock };
  let service: GisService;

  beforeEach(() => {
    dataSource = { query: jest.fn() };
    service = new GisService(dataSource as unknown as DataSource);
  });

  describe('isPointInProvince', () => {
    it('trả về true khi toạ độ nằm trong 1 xã/phường bất kỳ của Lâm Đồng', async () => {
      dataSource.query.mockResolvedValueOnce([{ inside: true }]);

      const result = await service.isPointInProvince(11.94, 108.44);

      expect(result).toBe(true);
      const [sql, params] = dataSource.query.mock.calls[0] as [
        string,
        unknown[],
      ];
      expect(sql).toContain('ST_Contains');
      // $1=lng, $2=lat — longitude TRƯỚC, latitude SAU (CLAUDE.md Mục 4).
      expect(params).toEqual([108.44, 11.94]);
    });

    it('trả về false khi toạ độ nằm ngoài mọi xã/phường của Lâm Đồng (VD: Hà Nội)', async () => {
      dataSource.query.mockResolvedValueOnce([{ inside: false }]);

      const result = await service.isPointInProvince(21.0, 105.8);

      expect(result).toBe(false);
    });
  });

  describe('getSosHeatmap', () => {
    it('group theo ward_code (xã/phường) thay vì toạ độ tuyệt đối, kèm tên xã', async () => {
      const rows = [
        {
          lat: 11.94,
          lng: 108.44,
          ward_code: '24781',
          ward_name: 'Xuân Hương - Đà Lạt',
          incident_count: 5,
        },
      ];
      dataSource.query.mockResolvedValueOnce(rows);
      const from = new Date('2026-08-01T00:00:00.000Z');
      const to = new Date('2026-08-31T23:59:59.000Z');

      const result = await service.getSosHeatmap(from, to);

      expect(result).toEqual(rows);
      const [sql, params] = dataSource.query.mock.calls[0] as [
        string,
        unknown[],
      ];
      // Không còn GROUP BY location (toạ độ tuyệt đối, luôn ra count=1 — bug cũ đã biết) —
      // phải group theo ward_code, JOIN wards lấy ward_name.
      expect(sql).toContain('GROUP BY s.ward_code, w.ward_name');
      expect(sql).not.toContain('GROUP BY location');
      expect(sql).toContain('JOIN wards w ON w.ward_code = s.ward_code');
      expect(params).toEqual([from, to]);
    });
  });

  describe('getStats', () => {
    // getStats() gọi Promise.all([...5 query...]) — 5 lệnh dataSource.query() chạy ĐỒNG BỘ
    // (khởi tạo promise) theo ĐÚNG thứ tự viết trong mảng trước khi await bất kỳ cái nào, nên
    // mockResolvedValueOnce xếp hàng theo đúng thứ tự đó: sos_by_status, sos_by_type,
    // avg_response, teams_by_status, flagged_users.
    it('gộp đúng kết quả từ 5 truy vấn, kể cả khi avg_response_minutes là null', async () => {
      dataSource.query
        .mockResolvedValueOnce([
          { status: 'cancelled', count: 6 },
          { status: 'in_progress', count: 1 },
        ])
        .mockResolvedValueOnce([
          { type: 'landslide', count: 2 },
          { type: 'fire', count: 1 },
        ])
        .mockResolvedValueOnce([{ avg_minutes: null }])
        .mockResolvedValueOnce([
          { status: 'available', count: 1 },
          { status: 'busy', count: 1 },
        ])
        .mockResolvedValueOnce([{ count: 1 }]);

      const result = await service.getStats(new Date('2020-01-01'), new Date());

      expect(result).toEqual({
        total_sos: 7, // tự cộng dồn từ sos_by_status, không phải query riêng
        sos_by_status: [
          { key: 'cancelled', count: 6 },
          { key: 'in_progress', count: 1 },
        ],
        sos_by_type: [
          { key: 'landslide', count: 2 },
          { key: 'fire', count: 1 },
        ],
        avg_response_minutes: null,
        teams_by_status: [
          { key: 'available', count: 1 },
          { key: 'busy', count: 1 },
        ],
        flagged_users_count: 1,
      });
    });

    it('trả avg_response_minutes dạng number khi có SOS đã resolved', async () => {
      dataSource.query
        .mockResolvedValueOnce([{ status: 'resolved', count: 3 }])
        .mockResolvedValueOnce([{ type: 'medical', count: 3 }])
        .mockResolvedValueOnce([{ avg_minutes: '42.5' }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ count: 0 }]);

      const result = await service.getStats(new Date('2020-01-01'), new Date());

      expect(result.avg_response_minutes).toBe(42.5);
      expect(typeof result.avg_response_minutes).toBe('number');
    });
  });
});
