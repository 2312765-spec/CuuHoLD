import type { Server } from 'socket.io';
import type { JwtService } from '@nestjs/jwt';
import type { ConfigService } from '@nestjs/config';
import { SosGateway } from './sos.gateway';
import type { RescueTeamsService } from '../rescue-teams/rescue-teams.service';

describe('SosGateway — sự kiện báo cáo cộng đồng', () => {
  let emit: jest.Mock;
  let to: jest.Mock;
  let gateway: SosGateway;

  beforeEach(() => {
    emit = jest.fn();
    to = jest.fn().mockReturnValue({ emit });
    gateway = new SosGateway(
      {} as unknown as JwtService,
      {} as unknown as ConfigService,
      {} as unknown as RescueTeamsService,
    );
    gateway.server = { to } as unknown as Server;
  });

  const newPayload = {
    reportId: 'r1',
    mergedIntoReportId: null,
    type: 'landslide' as const,
    reporterName: 'Nguyễn Văn An',
    wardCode: '24781',
    reporterCount: 1,
    createdAt: '2026-10-05T00:00:00.000Z',
  };

  it('báo cáo mới chỉ bắn vào phòng toàn tỉnh (commander) — payload có tên người báo nên KHÔNG được lọt vào phòng xã', () => {
    gateway.emitHazardReportNew(newPayload);

    expect(to).toHaveBeenCalledTimes(1);
    expect(to).toHaveBeenCalledWith('province:lamdong');
    expect(emit).toHaveBeenCalledWith('hazard-report:new', newPayload);
    expect(to).not.toHaveBeenCalledWith(expect.stringMatching(/^ward:/));
  });

  it('kết quả duyệt cũng chỉ bắn vào phòng commander', () => {
    const payload = {
      reportId: 'r1',
      status: 'approved' as const,
      hazardId: 'h1',
      reviewerName: 'Chỉ huy',
      mergedCount: 2,
      updatedAt: '2026-10-05T00:00:00.000Z',
    };

    gateway.emitHazardReportReviewed(payload);

    expect(to).toHaveBeenCalledTimes(1);
    expect(to).toHaveBeenCalledWith('province:lamdong');
    expect(emit).toHaveBeenCalledWith('hazard-report:reviewed', payload);
  });
});

// Lỗi thật: commander toàn tỉnh (không có wardCode) CHỈ ở phòng province:lamdong, nhưng
// emitSosUpdated không bắn vào phòng đó → Dashboard không tự cập nhật khi nạn nhân huỷ, khi
// rescuer đổi tiến độ, khi tự động phân công — phải F5. Đồng thời mỗi người phải nhận ĐÚNG 1
// lần dù thuộc nhiều phòng (commander có xã nằm ở cả ward:* lẫn province:lamdong): gộp mọi phòng
// vào MỘT lần emit — Socket.IO tự loại trùng người nhận giữa các phòng trong cùng 1 lần emit.
describe('SosGateway — sự kiện SOS', () => {
  let emit: jest.Mock;
  let to: jest.Mock;
  let gateway: SosGateway;

  beforeEach(() => {
    emit = jest.fn();
    to = jest.fn().mockReturnValue({ emit });
    gateway = new SosGateway(
      {} as unknown as JwtService,
      {} as unknown as ConfigService,
      {} as unknown as RescueTeamsService,
    );
    gateway.server = { to } as unknown as Server;
  });

  const phongDaGui = (): string[] =>
    to.mock.calls.flatMap((c: unknown[]) =>
      Array.isArray(c[0]) ? (c[0] as string[]) : [c[0] as string],
    );

  const capNhat = {
    sosId: 's1',
    status: 'cancelled' as const,
    wardCode: '24781',
    assignedTeamId: 't1',
    penaltyApplied: false,
    updatedAt: '2026-10-15T00:00:00.000Z',
  };

  it('sos:updated tới cả phòng commander toàn tỉnh, phòng SOS, phòng xã, phòng đội — trong ĐÚNG 1 lần emit', () => {
    gateway.emitSosUpdated('s1', '24781', capNhat);

    expect(emit).toHaveBeenCalledTimes(1);
    expect(emit).toHaveBeenCalledWith('sos:updated', capNhat);
    expect(phongDaGui().sort()).toEqual(
      ['province:lamdong', 'sos:s1', 'team:t1', 'ward:24781'].sort(),
    );
  });

  it('chưa có đội / chưa suy ra được xã → không bắn vào phòng team:undefined hay ward: rỗng', () => {
    gateway.emitSosUpdated('s1', '', {
      ...capNhat,
      wardCode: '',
      assignedTeamId: undefined,
    });

    expect(emit).toHaveBeenCalledTimes(1);
    expect(phongDaGui().sort()).toEqual(['province:lamdong', 'sos:s1']);
  });

  it('sos:new tới phòng xã + toàn tỉnh trong 1 lần emit (commander có xã không nhận 2 lần)', () => {
    const moi = {
      sosId: 's1',
      victimId: 'v1',
      victimName: 'A',
      victimPhone: '0900000000',
      type: 'flood' as const,
      status: 'pending' as const,
      lat: 11.9,
      lng: 108.4,
      locationEstimated: false,
      wardCode: '24781',
      createdAt: '2026-10-15T00:00:00.000Z',
      cancelDeadline: '2026-10-15T00:03:00.000Z',
    };
    gateway.emitNewSos('24781', moi);

    expect(emit).toHaveBeenCalledTimes(1);
    expect(emit).toHaveBeenCalledWith('sos:new', moi);
    expect(phongDaGui().sort()).toEqual(['province:lamdong', 'ward:24781']);
  });
});
