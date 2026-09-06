import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Repository } from 'typeorm';
import { SosService } from './sos.service';
import { SosRequest } from './sos.entity';
import { SosGateway } from './sos.gateway';
import { NotificationsService } from '../notifications/notifications.service';
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

  beforeEach(() => {
    dataSource = { query: jest.fn() };
    gateway = { emitNewSos: jest.fn(), emitSosUpdated: jest.fn() };
    notifications = { sendSosSms: jest.fn().mockResolvedValue(undefined) };
    service = new SosService(
      {} as unknown as Repository<SosRequest>,
      dataSource as unknown as DataSource,
      gateway as unknown as SosGateway,
      notifications as unknown as NotificationsService,
    );
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
        .mockResolvedValueOnce([{ late_cancel_count: 3, is_flagged: true }]);

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
      expect(sql).toContain("NOT IN ('resolved', 'cancelled', 'false_alarm')");
      expect(params).toEqual(['victim-1']);
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
        .mockResolvedValueOnce([{ updated_at: updatedAt }])
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
        .mockResolvedValueOnce([{ updated_at: updatedAt }])
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
        .mockResolvedValueOnce([{ updated_at: updatedAt }])
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
});
