import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { HazardReportsService } from './hazard-reports.service';
import { GisService } from '../gis/gis.service';
import { HazardsService } from '../hazards/hazards.service';
import { SosGateway } from '../sos/sos.gateway';
import type { User } from '../users/user.entity';

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);

const user = (over: Partial<User> = {}): User =>
  ({
    id: 'u1',
    role: 'victim',
    name: 'Dân',
    phone: '0900000001',
    ...over,
  }) as User;

const commander = user({ id: 'cmd', role: 'commander', name: 'Chỉ huy' });

const ROW = {
  id: 'r1',
  type: 'landslide',
  description: 'Đá lăn',
  lat: 11.94,
  lng: 108.44,
  accuracy_m: 12,
  location_estimated: false,
  has_image: true,
  status: 'pending',
  ward_code: '24781',
  created_at: new Date('2026-10-05T00:00:00.000Z'),
  reviewed_at: null,
  review_note: null,
  hazard_id: null,
  duplicate_of: null,
};

describe('HazardReportsService', () => {
  let ds: { query: jest.Mock };
  let gis: { isPointInProvince: jest.Mock };
  let hazards: { create: jest.Mock };
  let gateway: {
    emitHazardReportNew: jest.Mock;
    emitHazardReportReviewed: jest.Mock;
  };
  let service: HazardReportsService;

  beforeEach(() => {
    ds = { query: jest.fn() };
    gis = { isPointInProvince: jest.fn().mockResolvedValue(true) };
    hazards = { create: jest.fn() };
    gateway = {
      emitHazardReportNew: jest.fn(),
      emitHazardReportReviewed: jest.fn(),
    };
    service = new HazardReportsService(
      ds as unknown as DataSource,
      gis as unknown as GisService,
      hazards as unknown as HazardsService,
      gateway as unknown as SosGateway,
    );
  });

  // create() chạy vài truy vấn song song (Promise.all) nên KHÔNG ràng buộc thứ tự gọi: trả lời theo
  // nội dung câu SQL, và truy vấn lạ thì làm test đỏ ngay (thay vì lặng lẽ trả undefined).
  function stubCreateQueries(opts: {
    pendingCount?: number;
    sameSpotCount?: number;
    duplicateOf?: string | null;
    groupReporters?: number;
    nearby?: unknown[];
  }): void {
    ds.query.mockImplementation((sql: string) => {
      if (sql.includes('pending_count')) {
        return Promise.resolve([
          {
            pending_count: opts.pendingCount ?? 0,
            same_spot_count: opts.sameSpotCount ?? 0,
          },
        ]);
      }
      if (sql.includes('INSERT INTO hazard_reports')) {
        return Promise.resolve([
          { id: 'r1', duplicate_of: opts.duplicateOf ?? null },
        ]);
      }
      if (sql.includes('COUNT(DISTINCT reporter_id)')) {
        return Promise.resolve([{ n: opts.groupReporters ?? 1 }]);
      }
      if (sql.includes('FROM road_hazards h')) {
        return Promise.resolve(opts.nearby ?? []);
      }
      if (sql.includes('FROM hazard_reports r WHERE r.id = $1')) {
        return Promise.resolve([
          { ...ROW, duplicate_of: opts.duplicateOf ?? null },
        ]);
      }
      return Promise.reject(
        new Error('Truy vấn không mong đợi: ' + sql.slice(0, 80)),
      );
    });
  }

  const insertCall = (): [string, unknown[]] =>
    ds.query.mock.calls.find(([sql]: [string]) =>
      sql.includes('INSERT INTO hazard_reports'),
    ) as [string, unknown[]];

  describe('create', () => {
    const input = {
      type: 'landslide' as const,
      lat: 11.94,
      lng: 108.44,
      image: { buffer: JPEG, size: JPEG.length },
    };

    it('lưu chờ duyệt: ST_MakePoint(lng, lat), sai số làm tròn, ảnh + mime thật; báo ngay cho commander', async () => {
      stubCreateQueries({});

      const res = await service.create(
        { ...input, description: ' Đá lăn ', accuracyMeters: 12.4 },
        user(),
      );

      expect(res.status).toBe('pending');
      expect(res.merged).toBe(false);
      expect(res.group_reporter_count).toBe(1);
      expect(res.nearby_hazard).toBeNull();

      const [sql, params] = insertCall();
      expect(sql).toContain('ST_MakePoint($4::float8, $5::float8)');
      // [reporter, type, mô tả, lng, lat, sai số, ước tính, ảnh, mime, bán kính gộp]
      expect(params).toEqual([
        'u1',
        'landslide',
        'Đá lăn',
        108.44,
        11.94,
        12,
        false,
        JPEG,
        'image/jpeg',
        100,
      ]);
      expect(gateway.emitHazardReportNew).toHaveBeenCalledWith(
        expect.objectContaining({
          reportId: 'r1',
          mergedIntoReportId: null,
          type: 'landslide',
          reporterName: 'Dân',
          reporterCount: 1,
          createdAt: '2026-10-05T00:00:00.000Z',
        }),
      );
    });

    it('câu INSERT tự tìm báo cáo chính: CHỜ DUYỆT, chưa bị gộp, CÙNG LOẠI, trong bán kính, cũ nhất', async () => {
      stubCreateQueries({});
      await service.create(input, user());
      const [sql] = insertCall();
      expect(sql).toContain("p.status = 'pending'");
      expect(sql).toContain('p.duplicate_of IS NULL');
      expect(sql).toContain('p.type = $2::varchar');
      expect(sql).toContain('ST_DWithin');
      expect(sql).toContain('ORDER BY p.created_at ASC');
    });

    it('gộp vào báo cáo chính: báo merged + số người cùng báo, và event trỏ về báo cáo chính', async () => {
      stubCreateQueries({ duplicateOf: 'primary-1', groupReporters: 3 });

      const res = await service.create(input, user());

      expect(res.merged).toBe(true);
      expect(res.group_reporter_count).toBe(3);
      expect(res.duplicate_of).toBe('primary-1');
      expect(gateway.emitHazardReportNew).toHaveBeenCalledWith(
        expect.objectContaining({
          mergedIntoReportId: 'primary-1',
          reporterCount: 3,
        }),
      );
    });

    it('khu vực đã có cảnh báo đang hoạt động → trả nearby_hazard cho người báo biết', async () => {
      stubCreateQueries({
        nearby: [
          { id: 'h9', type: 'landslide', severity: 'blocked', distance_m: 40 },
        ],
      });
      const res = await service.create(input, user());
      expect(res.nearby_hazard).toEqual({
        id: 'h9',
        type: 'landslide',
        severity: 'blocked',
        distance_m: 40,
      });
    });

    it('KHÔNG có ảnh → 400, từ chối trước mọi truy vấn, không phát event', async () => {
      await expect(
        service.create({ type: 'landslide', lat: 11.94, lng: 108.44 }, user()),
      ).rejects.toThrow(BadRequestException);
      expect(gis.isPointInProvince).not.toHaveBeenCalled();
      expect(ds.query).not.toHaveBeenCalled();
      expect(gateway.emitHazardReportNew).not.toHaveBeenCalled();
    });

    it('từ chối file không phải ảnh dù client khai báo gì (kiểm magic bytes), không chạm DB', async () => {
      const svg = Buffer.from('<svg onload="alert(1)"></svg>');
      await expect(
        service.create(
          { ...input, image: { buffer: svg, size: svg.length } },
          user(),
        ),
      ).rejects.toThrow(BadRequestException);
      expect(ds.query).not.toHaveBeenCalled();
    });

    it('từ chối ảnh quá 2MB', async () => {
      await expect(
        service.create(
          { ...input, image: { buffer: JPEG, size: 3 * 1024 * 1024 } },
          user(),
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('từ chối vị trí ngoài tỉnh Lâm Đồng, KHÔNG ghi gì vào DB', async () => {
      gis.isPointInProvince.mockResolvedValueOnce(false);
      await expect(service.create(input, user())).rejects.toThrow(
        BadRequestException,
      );
      expect(ds.query).not.toHaveBeenCalled();
    });

    it('cùng người đã báo điểm này (cùng loại, đang chờ duyệt) → 409, không INSERT, không phát event', async () => {
      stubCreateQueries({ sameSpotCount: 1 });
      await expect(service.create(input, user())).rejects.toThrow(
        ConflictException,
      );
      expect(insertCall()).toBeUndefined();
      expect(gateway.emitHazardReportNew).not.toHaveBeenCalled();
    });

    it('đã có 5 báo cáo chờ duyệt → 409 (chống spam hàng đợi)', async () => {
      stubCreateQueries({ pendingCount: 5 });
      await expect(service.create(input, user())).rejects.toThrow(
        ConflictException,
      );
      expect(insertCall()).toBeUndefined();
    });
  });

  describe('getImage', () => {
    const rowWith = (reporter: string) => [
      { image_data: JPEG, image_mime: 'image/jpeg', reporter_id: reporter },
    ];

    it('commander xem được ảnh của người khác', async () => {
      ds.query.mockResolvedValueOnce(rowWith('u-khac'));
      const img = await service.getImage('r1', commander);
      expect(img.mime).toBe('image/jpeg');
    });

    it('chính người gửi xem được ảnh của mình', async () => {
      ds.query.mockResolvedValueOnce(rowWith('u1'));
      await expect(service.getImage('r1', user())).resolves.toBeDefined();
    });

    it('người khác (không phải commander/chủ báo cáo) bị chặn 403', async () => {
      ds.query.mockResolvedValueOnce(rowWith('u-khac'));
      await expect(service.getImage('r1', user())).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('404 khi báo cáo không có ảnh', async () => {
      ds.query.mockResolvedValueOnce([
        { image_data: null, image_mime: null, reporter_id: 'u1' },
      ]);
      await expect(service.getImage('r1', user())).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findForModeration', () => {
    const raw = (over: Record<string, unknown> = {}) => ({
      ...ROW,
      reporter_id: 'u1',
      reporter_name: 'Dân',
      reporter_phone: '0900000001',
      reviewed_by_name: null,
      hazard_severity: null,
      hazard_is_active: null,
      duplicate_count: 0,
      reporter_count: 1,
      nearby_hazard_id: null,
      nearby_hazard_type: null,
      nearby_hazard_severity: null,
      nearby_hazard_distance_m: null,
      ...over,
    });

    it('mặc định lấy hàng chờ duyệt, trang đầu 50 dòng; không có dòng nào thì KHÔNG truy vấn báo cáo gộp', async () => {
      ds.query.mockResolvedValueOnce([]);
      const res = await service.findForModeration();
      expect(res).toEqual([]);
      expect(ds.query).toHaveBeenCalledTimes(1);
      const [sql, params] = ds.query.mock.calls[0] as [string, unknown[]];
      // [status, limit, offset, biên "ở gần cảnh báo"]
      expect(params).toEqual(['pending', 50, 0, 50]);
      // báo cáo đã gộp bị ẩn khỏi danh sách; chỉ giữ báo cáo chính hoặc báo cáo "mồ côi"
      expect(sql).toContain('r.duplicate_of IS NULL OR pr.status <> r.status');
    });

    it('lịch sử đã duyệt có phân trang (limit/offset) và kèm người duyệt + mức độ cảnh báo', async () => {
      ds.query
        .mockResolvedValueOnce([
          raw({
            status: 'approved',
            reviewed_by_name: 'Chỉ huy',
            hazard_severity: 'caution',
            hazard_is_active: true,
          }),
        ])
        .mockResolvedValueOnce([]);

      const res = await service.findForModeration('approved', {
        limit: 20,
        offset: 40,
      });

      expect((ds.query.mock.calls[0] as [string, unknown[]])[1]).toEqual([
        'approved',
        20,
        40,
        50,
      ]);
      expect(res[0].reviewed_by_name).toBe('Chỉ huy');
      expect(res[0].hazard_severity).toBe('caution');
    });

    it('gom nhóm: gắn báo cáo gộp vào đúng báo cáo chính, theo CÙNG trạng thái; đổi cột cảnh báo lân cận thành đối tượng', async () => {
      ds.query
        .mockResolvedValueOnce([
          raw({
            id: 'p1',
            duplicate_count: 2,
            reporter_count: 3,
            nearby_hazard_id: 'h1',
            nearby_hazard_type: 'landslide',
            nearby_hazard_severity: 'blocked',
            nearby_hazard_distance_m: '35',
          }),
          raw({ id: 'p2' }),
        ])
        .mockResolvedValueOnce([
          {
            id: 'f1',
            duplicate_of: 'p1',
            reporter_id: 'u2',
            reporter_name: 'B',
            reporter_phone: '2',
            description: null,
            accuracy_m: 9,
            has_image: true,
            created_at: new Date(),
          },
          {
            id: 'f2',
            duplicate_of: 'p1',
            reporter_id: 'u3',
            reporter_name: 'C',
            reporter_phone: '3',
            description: null,
            accuracy_m: 9,
            has_image: true,
            created_at: new Date(),
          },
        ]);

      const res = await service.findForModeration('pending');

      expect(res[0].duplicates.map((d) => d.id)).toEqual(['f1', 'f2']);
      expect(res[0].duplicates[0]).not.toHaveProperty('duplicate_of');
      expect(res[1].duplicates).toEqual([]);
      expect(res[0].nearby_hazard).toEqual({
        id: 'h1',
        type: 'landslide',
        severity: 'blocked',
        distance_m: 35,
      });
      expect(res[1].nearby_hazard).toBeNull();
      const [followerSql, followerParams] = ds.query.mock.calls[1] as [
        string,
        unknown[],
      ];
      expect(followerSql).toContain('ANY($1::uuid[])');
      expect(followerParams).toEqual([['p1', 'p2'], 'pending']);
    });
  });

  describe('approve', () => {
    const claimed = [
      [{ type: 'landslide', description: 'Đá lăn', lat: 11.94, lng: 108.44 }],
      1,
    ];

    it('chiếm báo cáo chính → tạo cảnh báo → áp dụng theo cho báo cáo đã gộp (cùng hazard_id) → báo commander khác', async () => {
      ds.query
        .mockResolvedValueOnce(claimed) // UPDATE...RETURNING (tuple [rows, count])
        .mockResolvedValueOnce(undefined) // gắn hazard_id cho báo cáo chính
        .mockResolvedValueOnce([[{ id: 'f1' }, { id: 'f2' }], 2]) // báo cáo gộp
        .mockResolvedValueOnce([
          { ...ROW, status: 'approved', hazard_id: 'h1' },
        ]);
      hazards.create.mockResolvedValueOnce({ id: 'h1' });

      const res = await service.approve(
        'r1',
        { severity: 'caution', radiusMeters: 150, note: ' đã gọi xác minh ' },
        commander,
      );

      expect(hazards.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'landslide',
          lat: 11.94,
          lng: 108.44,
          radiusMeters: 150,
          severity: 'caution',
        }),
        'cmd',
      );
      const [claimSql] = ds.query.mock.calls[0] as [string];
      expect(claimSql).toContain("r.status = 'pending'"); // chống duyệt trùng
      // chặn duyệt thẳng báo cáo đã gộp khi báo cáo chính còn chờ (sẽ sinh 2 cảnh báo cho 1 điểm)
      expect(claimSql).toContain('NOT EXISTS');
      const [cascadeSql, cascadeParams] = ds.query.mock.calls[2] as [
        string,
        unknown[],
      ];
      expect(cascadeSql).toContain('WHERE duplicate_of = $1');
      expect(cascadeParams).toEqual(['r1', 'cmd', 'đã gọi xác minh', 'h1']);
      expect(res.merged_count).toBe(2);
      expect(res.report.hazard_id).toBe('h1');
      expect(gateway.emitHazardReportReviewed).toHaveBeenCalledWith(
        expect.objectContaining({
          reportId: 'r1',
          status: 'approved',
          hazardId: 'h1',
          reviewerName: 'Chỉ huy',
          mergedCount: 2,
        }),
      );
    });

    it('báo cáo đã được xử lý rồi → 409, KHÔNG tạo cảnh báo thứ hai, không phát event', async () => {
      ds.query
        .mockResolvedValueOnce([[], 0])
        .mockResolvedValueOnce([{ status: 'approved' }]);
      await expect(
        service.approve('r1', { severity: 'blocked' }, commander),
      ).rejects.toThrow(ConflictException);
      expect(hazards.create).not.toHaveBeenCalled();
      expect(gateway.emitHazardReportReviewed).not.toHaveBeenCalled();
    });

    it('báo cáo đã gộp vào báo cáo chính còn chờ → 409 chỉ dẫn xử lý báo cáo chính', async () => {
      ds.query
        .mockResolvedValueOnce([[], 0])
        .mockResolvedValueOnce([{ status: 'pending' }]); // vẫn pending nhưng bị điều kiện NOT EXISTS chặn
      await expect(
        service.approve('f1', { severity: 'blocked' }, commander),
      ).rejects.toThrow(/gộp vào một báo cáo chính/);
      expect(hazards.create).not.toHaveBeenCalled();
    });

    it('không tồn tại → 404', async () => {
      ds.query.mockResolvedValueOnce([[], 0]).mockResolvedValueOnce([]);
      await expect(
        service.approve('x', { severity: 'blocked' }, commander),
      ).rejects.toThrow(NotFoundException);
    });

    it('tạo cảnh báo lỗi → trả báo cáo về pending để duyệt lại, KHÔNG áp dụng cho báo cáo gộp, không phát event', async () => {
      ds.query.mockResolvedValueOnce(claimed).mockResolvedValueOnce(undefined);
      hazards.create.mockRejectedValueOnce(new Error('db down'));

      await expect(
        service.approve('r1', { severity: 'blocked' }, commander),
      ).rejects.toThrow('db down');

      expect(ds.query).toHaveBeenCalledTimes(2); // chiếm + hoàn tác, không có bước cascade
      const [revertSql] = ds.query.mock.calls[1] as [string];
      expect(revertSql).toContain("status = 'pending'");
      expect(gateway.emitHazardReportReviewed).not.toHaveBeenCalled();
    });
  });

  describe('reject', () => {
    it('từ chối báo cáo chính → các báo cáo gộp bị từ chối theo; không tạo cảnh báo; báo commander khác', async () => {
      ds.query
        .mockResolvedValueOnce([[{ id: 'r1' }], 1])
        .mockResolvedValueOnce([[{ id: 'f1' }], 1])
        .mockResolvedValueOnce([{ ...ROW, status: 'rejected' }]);

      const res = await service.reject('r1', 'Không xác minh được', commander);

      expect(res.report.status).toBe('rejected');
      expect(res.merged_count).toBe(1);
      expect(hazards.create).not.toHaveBeenCalled();
      const [sql] = ds.query.mock.calls[0] as [string];
      expect(sql).toContain("r.status = 'pending'");
      expect(gateway.emitHazardReportReviewed).toHaveBeenCalledWith(
        expect.objectContaining({
          reportId: 'r1',
          status: 'rejected',
          hazardId: null,
          mergedCount: 1,
        }),
      );
    });

    it('đã xử lý rồi → 409, không phát event', async () => {
      ds.query
        .mockResolvedValueOnce([[], 0])
        .mockResolvedValueOnce([{ status: 'rejected' }]);
      await expect(service.reject('r1', undefined, commander)).rejects.toThrow(
        ConflictException,
      );
      expect(gateway.emitHazardReportReviewed).not.toHaveBeenCalled();
    });
  });
});
