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
