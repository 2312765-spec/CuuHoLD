import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Repository } from 'typeorm';
import { SosService } from './sos.service';
import { SosRequest } from './sos.entity';
import { SosGateway } from './sos.gateway';
import { NotificationsService } from '../notifications/notifications.service';
import { GisService } from '../gis/gis.service';
import { User } from '../users/user.entity';

function buildUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
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

describe('SosService', () => {
  let service: SosService;
  let dataSource: { query: jest.Mock };
  let gateway: { emitNewSos: jest.Mock; emitSosUpdated: jest.Mock };
  let notifications: { sendSosSms: jest.Mock };
  let gisService: { findNearestTeams: jest.Mock };

  beforeEach(() => {
    dataSource = { query: jest.fn() };
    gateway = { emitNewSos: jest.fn(), emitSosUpdated: jest.fn() };
    notifications = { sendSosSms: jest.fn().mockResolvedValue(undefined) };
    // Mặc định KHÔNG có đội nào gần đó — giữ nguyên hành vi 'pending' cho các test create()
    // không cố ý test auto-assign; test riêng override mock này khi cần.
    gisService = { findNearestTeams: jest.fn().mockResolvedValue([]) };
    service = new SosService(
      {} as unknown as Repository<SosRequest>,
      dataSource as unknown as DataSource,
      gateway as unknown as SosGateway,
      notifications as unknown as NotificationsService,
      gisService as unknown as GisService,
    );
  });

  describe('create', () => {
    const victim = buildUser({ id: 'victim-1' });

    // Từ khi có phép chặn "chỉ 1 SOS active/user" (SRS F-SOS-01), truy vấn ĐẦU TIÊN của
    // create() là kiểm tra SOS đang hoạt động. Mặc định cho "không có" để các test bên
    // dưới chỉ tập trung vào phần chúng thật sự kiểm; test nào cần ca ngược thì tự
    // mockResolvedValueOnce trước khi gọi (xem test 'chặn khi đã có SOS...').
    beforeEach(() => {
      dataSource.query.mockResolvedValueOnce([]);
    });

    it('lưu location_estimated=true khi client báo toạ độ chỉ là ước tính (fix P0 an toàn)', async () => {
      dataSource.query.mockResolvedValueOnce([
        {
          id: 'sos-1',
          type: 'flood',
          status: 'pending',
          ward_code: '24781',
          created_at: new Date('2026-01-01T00:00:00Z'),
          cancel_deadline: new Date('2026-01-01T00:03:00Z'),
          location_estimated: true,
        },
      ]);

      const result = await service.create(
        {
          lat: 11.94,
          lng: 108.44,
          type: 'flood',
          locationEstimated: true,
        },
        victim,
      );

      expect(result.location_estimated).toBe(true);
      // calls[0] la truy van kiem tra SOS active (F-SOS-01), INSERT la calls[1]
      const [sql, params] = dataSource.query.mock.calls[1] as [
        string,
        unknown[],
      ];
      expect(sql).toContain('location_estimated');
      expect(params).toContain(true);
      expect(gateway.emitNewSos).toHaveBeenCalledWith(
        '24781',
        expect.objectContaining({ locationEstimated: true }),
      );
    });

    it('mặc định location_estimated=false khi client không gửi field này', async () => {
      dataSource.query.mockResolvedValueOnce([
        {
          id: 'sos-2',
          type: 'medical',
          status: 'pending',
          ward_code: '24781',
          created_at: new Date('2026-01-01T00:00:00Z'),
          cancel_deadline: new Date('2026-01-01T00:03:00Z'),
          location_estimated: false,
        },
      ]);

      await service.create(
        { lat: 11.94, lng: 108.44, type: 'medical' },
        victim,
      );

      const [, params] = dataSource.query.mock.calls[1] as [string, unknown[]];
      expect(params[params.length - 1]).toBe(false);
    });

    it('tự động phân công đội gần nhất khi có đội sẵn sàng trong bán kính (CLAUDE.md Mục 10)', async () => {
      dataSource.query
        .mockResolvedValueOnce([
          {
            id: 'sos-3',
            type: 'flood',
            status: 'pending',
            ward_code: '24781',
            created_at: new Date('2026-01-01T00:00:00Z'),
            cancel_deadline: new Date('2026-01-01T00:03:00Z'),
            location_estimated: false,
          },
        ])
        .mockResolvedValueOnce(undefined) // UPDATE sos_requests
        .mockResolvedValueOnce(undefined) // UPDATE rescue_teams
        .mockResolvedValueOnce(undefined); // INSERT sos_timeline
      gisService.findNearestTeams.mockResolvedValueOnce([
        { id: 'team-1', name: 'Đội cứu hộ Đà Lạt 1' },
      ]);

      const result = await service.create(
        { lat: 11.94, lng: 108.44, type: 'flood' },
        victim,
      );

      expect(result.status).toBe('assigned');
      expect(gisService.findNearestTeams).toHaveBeenCalledWith(
        11.94,
        108.44,
        10000,
        1,
      );
      // Đã có đội trong 10km → KHÔNG mở rộng lên 20km.
      expect(gisService.findNearestTeams).toHaveBeenCalledTimes(1);
      expect(dataSource.query).toHaveBeenCalledTimes(5); // +1: kiem tra SOS active
      const [assignSql, assignParams] = dataSource.query.mock.calls[2] as [
        string,
        unknown[],
      ];
      expect(assignSql).toContain("status='assigned'");
      expect(assignParams).toEqual(['sos-3', 'team-1']);
      expect(gateway.emitNewSos).toHaveBeenCalledWith(
        '24781',
        expect.objectContaining({ status: 'assigned' }),
      );
      expect(gateway.emitSosUpdated).toHaveBeenCalledWith(
        'sos-3',
        '24781',
        expect.objectContaining({
          status: 'assigned',
          assignedTeamId: 'team-1',
        }),
      );
    });

    // SRS F-GIS-01: không có đội trong 10km → mở rộng lên 20km.
    it('mở rộng lên 20km khi không có đội nào trong 10km', async () => {
      dataSource.query
        .mockResolvedValueOnce([
          {
            id: 'sos-5',
            type: 'flood',
            status: 'pending',
            ward_code: '24781',
            created_at: new Date('2026-01-01T00:00:00Z'),
            cancel_deadline: new Date('2026-01-01T00:03:00Z'),
            location_estimated: false,
          },
        ])
        .mockResolvedValueOnce(undefined) // UPDATE sos_requests
        .mockResolvedValueOnce(undefined) // UPDATE rescue_teams
        .mockResolvedValueOnce(undefined); // INSERT sos_timeline
      gisService.findNearestTeams
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          { id: 'team-2', name: 'Đội cứu hộ Lạc Dương' },
        ]);

      const result = await service.create(
        { lat: 11.94, lng: 108.44, type: 'flood' },
        victim,
      );

      expect(result.status).toBe('assigned');
      expect(gisService.findNearestTeams.mock.calls).toEqual([
        [11.94, 108.44, 10000, 1],
        [11.94, 108.44, 20000, 1],
      ]);
      const [, assignParams] = dataSource.query.mock.calls[2] as [
        string,
        unknown[],
      ];
      expect(assignParams).toEqual(['sos-5', 'team-2']);
    });

    it('giữ nguyên pending khi không có đội nào sẵn sàng trong bán kính', async () => {
      dataSource.query.mockResolvedValueOnce([
        {
          id: 'sos-4',
          type: 'flood',
          status: 'pending',
          ward_code: '24781',
          created_at: new Date('2026-01-01T00:00:00Z'),
          cancel_deadline: new Date('2026-01-01T00:03:00Z'),
          location_estimated: false,
        },
      ]);
      gisService.findNearestTeams.mockResolvedValueOnce([]);

      const result = await service.create(
        { lat: 11.94, lng: 108.44, type: 'flood' },
        victim,
      );

      expect(result.status).toBe('pending');
      expect(dataSource.query).toHaveBeenCalledTimes(2); // kiểm tra SOS active + INSERT, không có UPDATE/timeline
      expect(gateway.emitSosUpdated).not.toHaveBeenCalled();
    });

    // SRS F-SOS-01: "Chỉ 1 SOS active cùng lúc/user".
    it('chặn khi victim đã có SOS chưa kết thúc (ConflictException, KHÔNG insert thêm)', async () => {
      // Ghi đè mock rỗng của beforeEach: lần này truy vấn kiểm tra TÌM THẤY một SOS active.
      dataSource.query.mockReset();
      dataSource.query.mockResolvedValueOnce([{ id: 'sos-dang-chay' }]);

      await expect(
        service.create({ lat: 11.94, lng: 108.44, type: 'flood' }, victim),
      ).rejects.toThrow(ConflictException);

      // Chỉ đúng 1 truy vấn (phép kiểm) — KHÔNG được chạy tới INSERT.
      expect(dataSource.query).toHaveBeenCalledTimes(1);
      expect(gateway.emitNewSos).not.toHaveBeenCalled();
      expect(notifications.sendSosSms).not.toHaveBeenCalled();

      const [sql, params] = dataSource.query.mock.calls[0] as [
        string,
        unknown[],
      ];
      expect(sql).toContain('NOT (status = ANY($2))');
      expect(params).toEqual([
        'victim-1',
        ['resolved', 'cancelled', 'false_alarm'],
      ]);
    });

    it('cho phép gửi SOS mới khi các SOS cũ đều đã kết thúc', async () => {
      // beforeEach đã cho truy vấn kiểm tra trả [] (không có SOS active) — đây chính là ca
      // ngược của test trên, xác nhận phép chặn không chặn nhầm người dùng hợp lệ.
      dataSource.query.mockResolvedValueOnce([
        {
          id: 'sos-moi',
          type: 'flood',
          status: 'pending',
          ward_code: '24781',
          created_at: new Date('2026-01-01T00:00:00Z'),
          cancel_deadline: new Date('2026-01-01T00:03:00Z'),
          location_estimated: false,
        },
      ]);

      const result = await service.create(
        { lat: 11.94, lng: 108.44, type: 'flood' },
        victim,
      );

      expect(result.id).toBe('sos-moi');
      expect(gateway.emitNewSos).toHaveBeenCalled();
    });
  });

  describe('cancel', () => {
    const victim = buildUser({ id: 'victim-1' });

    it('ném NotFoundException khi không tìm thấy SOS', async () => {
      dataSource.query.mockResolvedValueOnce([]);

      await expect(service.cancel('sos-1', victim)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('ném ForbiddenException khi người huỷ không phải chủ SOS', async () => {
      dataSource.query.mockResolvedValueOnce([
        {
          id: 'sos-1',
          victim_id: 'someone-else',
          status: 'pending',
          cancel_deadline: new Date(Date.now() + 60_000),
        },
      ]);

      await expect(service.cancel('sos-1', victim)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('ném BadRequestException khi SOS đã kết thúc', async () => {
      dataSource.query.mockResolvedValueOnce([
        {
          id: 'sos-1',
          victim_id: victim.id,
          status: 'resolved',
          cancel_deadline: new Date(Date.now() + 60_000),
        },
      ]);

      await expect(service.cancel('sos-1', victim)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('huỷ trước cancel_deadline → không bị phạt, không đổi trạng thái tài khoản', async () => {
      dataSource.query
        .mockResolvedValueOnce([
          {
            id: 'sos-1',
            victim_id: victim.id,
            status: 'pending',
            cancel_deadline: new Date(Date.now() + 60_000),
          },
        ])
        .mockResolvedValueOnce(undefined);

      const result = await service.cancel('sos-1', victim);

      expect(result).toEqual({
        sosId: 'sos-1',
        status: 'cancelled',
        penaltyApplied: false,
        accountFlagged: false,
      });
      expect(dataSource.query).toHaveBeenCalledTimes(2);
    });

    it('huỷ sau cancel_deadline → bị phạt, tăng late_cancel_count và có thể bị flag', async () => {
      dataSource.query
        .mockResolvedValueOnce([
          {
            id: 'sos-1',
            victim_id: victim.id,
            status: 'assigned',
            cancel_deadline: new Date(Date.now() - 60_000),
          },
        ])
        .mockResolvedValueOnce(undefined)
        // UPDATE users ... RETURNING → tuple [rows, affectedCount] (xem Mục 15.11).
        .mockResolvedValueOnce([
          [{ late_cancel_count: 3, is_flagged: true }],
          1,
        ]);

      const result = await service.cancel('sos-1', victim);

      expect(result).toEqual({
        sosId: 'sos-1',
        status: 'cancelled',
        penaltyApplied: true,
        accountFlagged: true,
      });
      expect(dataSource.query).toHaveBeenCalledTimes(3);
      const [, params] = dataSource.query.mock.calls[2] as [string, unknown[]];
      expect(params).toEqual(['victim-1', 3]);
    });

    it('huỷ SOS đã được phân công đội → giải phóng đội về available (tránh kẹt busy vĩnh viễn)', async () => {
      dataSource.query
        .mockResolvedValueOnce([
          {
            id: 'sos-1',
            victim_id: victim.id,
            status: 'assigned',
            assigned_team_id: 'team-1',
            cancel_deadline: new Date(Date.now() + 60_000),
          },
        ])
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined);

      await service.cancel('sos-1', victim);

      expect(dataSource.query).toHaveBeenCalledTimes(3);
      const [releaseSql, releaseParams] = dataSource.query.mock.calls[2] as [
        string,
        unknown[],
      ];
      expect(releaseSql).toContain("rescue_teams SET status='available'");
      expect(releaseParams).toEqual(['team-1']);
    });

    it('huỷ SOS chưa được phân công đội nào → không đụng tới rescue_teams', async () => {
      dataSource.query
        .mockResolvedValueOnce([
          {
            id: 'sos-1',
            victim_id: victim.id,
            status: 'pending',
            assigned_team_id: null,
            cancel_deadline: new Date(Date.now() + 60_000),
          },
        ])
        .mockResolvedValueOnce(undefined);

      await service.cancel('sos-1', victim);

      expect(dataSource.query).toHaveBeenCalledTimes(2);
    });
  });

  describe('findMyActive', () => {
    const victim = buildUser({ id: 'victim-1' });

    it('trả về null khi victim không có SOS nào đang hoạt động', async () => {
      dataSource.query.mockResolvedValueOnce([]);

      const result = await service.findMyActive(victim);

      expect(result).toBeNull();
      const [sql, params] = dataSource.query.mock.calls[0] as [
        string,
        unknown[],
      ];
      // Danh sách trạng thái kết thúc giờ truyền qua THAM SỐ ($2) thay vì nhúng thẳng vào
      // chuỗi SQL — dùng chung hằng số SOS_TERMINAL_STATUSES với phép chặn trong create().
      expect(sql).toContain('NOT (s.status = ANY($2))');
      expect(params).toEqual([
        'victim-1',
        ['resolved', 'cancelled', 'false_alarm'],
      ]);
    });

    it('trả về SOS mới nhất kèm timeline khi có SOS đang hoạt động', async () => {
      const sosRow = {
        id: 'sos-1',
        victim_id: 'victim-1',
        type: 'flood',
        status: 'assigned',
        description: null,
        image_url: null,
        ward_code: '24781',
        false_alarm_count: 0,
        cancel_deadline: new Date('2026-01-01T00:03:00Z'),
        created_at: new Date('2026-01-01T00:00:00Z'),
        updated_at: new Date('2026-01-01T00:01:00Z'),
        resolved_at: null,
        assigned_team_id: 'team-1',
        lat: 11.94,
        lng: 108.44,
        victim_name: 'Nguyen Van A',
        victim_phone: '0901234567',
        team_name: 'Đội 1',
        team_status: 'busy',
      };
      dataSource.query.mockResolvedValueOnce([sosRow]).mockResolvedValueOnce([
        {
          id: 't1',
          actor_id: 'commander-1',
          action: 'assigned',
          note: null,
          created_at: new Date('2026-01-01T00:01:00Z'),
        },
      ]);

      const result = await service.findMyActive(victim);

      expect(result).toEqual({
        ...sosRow,
        timeline: [
          {
            id: 't1',
            actor_id: 'commander-1',
            action: 'assigned',
            note: null,
            created_at: new Date('2026-01-01T00:01:00Z'),
          },
        ],
      });
      expect(dataSource.query).toHaveBeenCalledTimes(2);
    });

    // Fix #2 (Mục 15.11): victim thấy đội đang tới — lấy vị trí hiện tại của đội được giao
    // qua đúng LEFT JOIN rescue_teams sẵn có, không thêm route/socket nào.
    it('lấy kèm toạ độ hiện tại của đội được giao', async () => {
      dataSource.query.mockResolvedValueOnce([]);

      await service.findMyActive(victim);

      const [sql] = dataSource.query.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('ST_Y(rt.current_location::geometry) AS team_lat');
      expect(sql).toContain('ST_X(rt.current_location::geometry) AS team_lng');
    });
  });

  describe('assign', () => {
    const commander = buildUser({ id: 'commander-1', role: 'commander' });

    it('ném NotFoundException khi không tìm thấy SOS', async () => {
      dataSource.query.mockResolvedValueOnce([]);

      await expect(
        service.assign('sos-1', 'team-1', commander),
      ).rejects.toThrow(NotFoundException);
    });

    it('ném BadRequestException khi SOS không ở trạng thái pending', async () => {
      dataSource.query.mockResolvedValueOnce([
        { status: 'assigned', ward_code: '24781', assigned_team_id: 't0' },
      ]);

      await expect(
        service.assign('sos-1', 'team-1', commander),
      ).rejects.toThrow(BadRequestException);
    });

    it('ném NotFoundException khi không tìm thấy đội cứu hộ', async () => {
      dataSource.query
        .mockResolvedValueOnce([
          { status: 'pending', ward_code: '24781', assigned_team_id: null },
        ])
        .mockResolvedValueOnce([]);

      await expect(
        service.assign('sos-1', 'team-1', commander),
      ).rejects.toThrow(NotFoundException);
    });

    it('ném BadRequestException khi đội cứu hộ không sẵn sàng', async () => {
      dataSource.query
        .mockResolvedValueOnce([
          { status: 'pending', ward_code: '24781', assigned_team_id: null },
        ])
        .mockResolvedValueOnce([{ status: 'busy' }]);

      await expect(
        service.assign('sos-1', 'team-1', commander),
      ).rejects.toThrow(BadRequestException);
    });

    it('phân công thành công → cập nhật SOS, đội, timeline và emit socket', async () => {
      const updatedAt = new Date('2026-01-02T00:00:00Z');
      dataSource.query
        .mockResolvedValueOnce([
          { status: 'pending', ward_code: '24781', assigned_team_id: null },
        ])
        .mockResolvedValueOnce([{ status: 'available' }])
        // UPDATE...RETURNING: TypeORM trả tuple [rows, affectedCount], KHÔNG phải mảng rows
        // thẳng như SELECT/INSERT — mock phải đúng hình dạng driver thật (Mục 15.11).
        .mockResolvedValueOnce([[{ updated_at: updatedAt }], 1])
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined);

      const result = await service.assign('sos-1', 'team-1', commander);

      expect(result).toEqual({
        sosId: 'sos-1',
        teamId: 'team-1',
        status: 'assigned',
        wardCode: '24781',
        updatedAt: updatedAt.toISOString(),
      });
      expect(gateway.emitSosUpdated).toHaveBeenCalledWith(
        'sos-1',
        '24781',
        expect.objectContaining({
          status: 'assigned',
          assignedTeamId: 'team-1',
        }),
      );
    });
  });

  describe('updateStatus', () => {
    const rescuer = buildUser({ id: 'rescuer-1', role: 'rescuer' });

    it('ném NotFoundException khi không tìm thấy SOS', async () => {
      dataSource.query.mockResolvedValueOnce([]);

      await expect(
        service.updateStatus('sos-1', 'in_progress', null, rescuer),
      ).rejects.toThrow(NotFoundException);
    });

    it('ném ForbiddenException khi SOS chưa được phân công đội', async () => {
      dataSource.query.mockResolvedValueOnce([
        { status: 'pending', ward_code: '24781', assigned_team_id: null },
      ]);

      await expect(
        service.updateStatus('sos-1', 'in_progress', null, rescuer),
      ).rejects.toThrow(ForbiddenException);
    });

    it('ném ForbiddenException khi rescuer không phải leader của đội được phân công', async () => {
      dataSource.query
        .mockResolvedValueOnce([
          { status: 'assigned', ward_code: '24781', assigned_team_id: 't1' },
        ])
        .mockResolvedValueOnce([]);

      await expect(
        service.updateStatus('sos-1', 'in_progress', null, rescuer),
      ).rejects.toThrow(ForbiddenException);
    });

    it('ném BadRequestException khi chuyển trạng thái không hợp lệ (bỏ qua bước)', async () => {
      dataSource.query
        .mockResolvedValueOnce([
          { status: 'assigned', ward_code: '24781', assigned_team_id: 't1' },
        ])
        .mockResolvedValueOnce([{ id: 't1' }]);

      await expect(
        service.updateStatus('sos-1', 'arrived', null, rescuer),
      ).rejects.toThrow(BadRequestException);
    });

    it('chuyển assigned → in_progress hợp lệ, không giải phóng đội', async () => {
      const updatedAt = new Date('2026-01-03T00:00:00Z');
      dataSource.query
        .mockResolvedValueOnce([
          { status: 'assigned', ward_code: '24781', assigned_team_id: 't1' },
        ])
        .mockResolvedValueOnce([{ id: 't1' }])
        // UPDATE...RETURNING: TypeORM trả tuple [rows, affectedCount], KHÔNG phải mảng rows
        // thẳng như SELECT/INSERT — mock phải đúng hình dạng driver thật (Mục 15.11).
        .mockResolvedValueOnce([[{ updated_at: updatedAt }], 1])
        .mockResolvedValueOnce(undefined);

      const result = await service.updateStatus(
        'sos-1',
        'in_progress',
        null,
        rescuer,
      );

      expect(result).toEqual({
        sosId: 'sos-1',
        status: 'in_progress',
        updatedAt: updatedAt.toISOString(),
      });
      expect(dataSource.query).toHaveBeenCalledTimes(4);
    });

    it('chuyển arrived → resolved hợp lệ, giải phóng đội về available', async () => {
      const updatedAt = new Date('2026-01-04T00:00:00Z');
      dataSource.query
        .mockResolvedValueOnce([
          { status: 'arrived', ward_code: '24781', assigned_team_id: 't1' },
        ])
        .mockResolvedValueOnce([{ id: 't1' }])
        // UPDATE...RETURNING: TypeORM trả tuple [rows, affectedCount], KHÔNG phải mảng rows
        // thẳng như SELECT/INSERT — mock phải đúng hình dạng driver thật (Mục 15.11).
        .mockResolvedValueOnce([[{ updated_at: updatedAt }], 1])
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined);

      const result = await service.updateStatus(
        'sos-1',
        'resolved',
        'Đã cứu hộ xong',
        rescuer,
      );

      expect(result.status).toBe('resolved');
      expect(dataSource.query).toHaveBeenCalledTimes(5);
      const teamUpdateCall = dataSource.query.mock.calls[3] as [
        string,
        unknown[],
      ];
      expect(teamUpdateCall[0]).toContain("status='available'");
    });
  });

  // Bug thật báo qua test tay (2026-09-11): rescuer là leader của đội được auto-assign
  // (đội gần nhất theo GPS, có thể ở xã khác), nhưng bị ẩn khỏi danh sách vì findAll()/
  // findById() lọc theo s.ward_code === user.wardCode — không liên quan gì tới việc đội
  // của họ có được giao SOS đó hay không. Test dưới tái hiện đúng kịch bản: rescuer ở xã
  // A, SOS ở xã B, nhưng SOS đã được giao cho đội do rescuer này làm leader.
  describe('findAll — rescuer xem SOS của đội mình dù khác xã', () => {
    const rescuer = buildUser({
      id: 'leader-1',
      role: 'rescuer',
      wardCode: '24823',
    });

    it('thêm điều kiện OR theo đội mình làm leader vào WHERE, không chỉ theo ward_code', async () => {
      dataSource.query.mockResolvedValueOnce([]);

      await service.findAll(rescuer, {});

      const [sql, params] = dataSource.query.mock.calls[0] as [
        string,
        unknown[],
      ];
      expect(sql).toContain('s.ward_code = $1');
      expect(sql).toContain(
        's.assigned_team_id IN (SELECT id FROM rescue_teams WHERE leader_id = $2)',
      );
      expect(params).toEqual(['24823', 'leader-1']);
    });
  });

  describe('findById — rescuer xem chi tiết SOS của đội mình dù khác xã', () => {
    const rescuer = buildUser({
      id: 'leader-1',
      role: 'rescuer',
      wardCode: '24823',
    });

    function sosRow(overrides: Record<string, unknown> = {}) {
      return {
        id: 'sos-1',
        victim_id: 'victim-1',
        ward_code: '24778', // khác wardCode của rescuer ở trên
        assigned_team_id: 'team-1',
        team_leader_id: 'leader-1',
        status: 'assigned',
        ...overrides,
      };
    }

    it('cho xem khi khác ward nhưng là leader của đội được giao (fix bug)', async () => {
      dataSource.query
        .mockResolvedValueOnce([sosRow()])
        .mockResolvedValueOnce([]); // timeline

      await expect(service.findById('sos-1', rescuer)).resolves.toMatchObject({
        id: 'sos-1',
      });
    });

    it('vẫn chặn khi khác ward VÀ không phải leader của đội được giao', async () => {
      dataSource.query.mockResolvedValueOnce([
        sosRow({ team_leader_id: 'nguoi-khac' }),
      ]);

      await expect(service.findById('sos-1', rescuer)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('vẫn cho xem bình thường khi cùng ward (hành vi cũ không đổi)', async () => {
      dataSource.query
        .mockResolvedValueOnce([
          sosRow({
            ward_code: '24823',
            assigned_team_id: null,
            team_leader_id: null,
          }),
        ])
        .mockResolvedValueOnce([]);

      await expect(service.findById('sos-1', rescuer)).resolves.toMatchObject({
        id: 'sos-1',
      });
    });
  });
});
