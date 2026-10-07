import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { SystemService } from './system.service';

function buildConfig(values: Record<string, string> = {}): ConfigService {
  return { get: (key: string) => values[key] } as unknown as ConfigService;
}

describe('SystemService', () => {
  let dataSource: { query: jest.Mock };

  beforeEach(() => {
    dataSource = { query: jest.fn() };
  });

  const build = (cfg: Record<string, string> = {}) =>
    new SystemService(dataSource as unknown as DataSource, buildConfig(cfg));

  describe('getStatus', () => {
    // Promise.all gọi query() đồng bộ theo thứ tự mảng: ping, users_by_role, userFlags,
    // teams, hazards.
    function mockCounts() {
      dataSource.query
        .mockResolvedValueOnce([{}]) // SELECT 1
        .mockResolvedValueOnce([
          { role: 'victim', count: 5 },
          { role: 'commander', count: 1 },
        ])
        .mockResolvedValueOnce([{ flagged: 1, inactive: 2 }])
        .mockResolvedValueOnce([{ count: 2 }])
        .mockResolvedValueOnce([{ count: 3 }]);
    }

    it('tổng hợp số liệu và chỉ báo tích hợp đã cấu hình', async () => {
      mockCounts();
      const result = await build({
        ORS_API_KEY: 'secret-ors',
        ESMS_API_KEY: 'k',
        ESMS_SECRET_KEY: 's',
      }).getStatus();

      expect(result.database.ok).toBe(true);
      expect(result.integrations).toEqual({
        ors_configured: true,
        esms_configured: true,
        esms_brandname_configured: false,
      });
      expect(result.counts).toEqual({
        users_by_role: [
          { key: 'victim', count: 5 },
          { key: 'commander', count: 1 },
        ],
        flagged_users: 1,
        inactive_users: 2,
        rescue_teams: 2,
        active_hazards: 3,
      });
    });

    it('KHÔNG làm lộ giá trị key/secret trong kết quả', async () => {
      mockCounts();
      const result = await build({
        ORS_API_KEY: 'secret-ors',
        ESMS_API_KEY: 'k-esms',
        ESMS_SECRET_KEY: 's-esms',
      }).getStatus();

      const json = JSON.stringify(result);
      expect(json).not.toContain('secret-ors');
      expect(json).not.toContain('k-esms');
      expect(json).not.toContain('s-esms');
    });

    it('thiếu key → configured=false (chuỗi rỗng cũng tính là chưa cấu hình)', async () => {
      mockCounts();
      const result = await build({ ORS_API_KEY: '  ' }).getStatus();
      expect(result.integrations.ors_configured).toBe(false);
      expect(result.integrations.esms_configured).toBe(false);
    });
  });

  describe('getActivity', () => {
    it('truyền limit dạng tham số và chuẩn hoá thời gian ISO', async () => {
      dataSource.query.mockResolvedValueOnce([
        {
          at: new Date('2026-09-25T10:00:00.000Z'),
          kind: 'hazard',
          action: 'hazard_created',
          actor_name: 'Lê Văn Chính',
          detail: 'landslide',
        },
      ]);

      const result = await build().getActivity(20);

      expect(result[0].at).toBe('2026-09-25T10:00:00.000Z');
      const [sql, params] = dataSource.query.mock.calls[0] as [
        string,
        unknown[],
      ];
      expect(sql).toContain('LIMIT $1');
      expect(params).toEqual([20]);
    });
  });
});
