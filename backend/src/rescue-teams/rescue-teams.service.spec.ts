import { DataSource } from 'typeorm';
import { RescueTeamsService } from './rescue-teams.service';
import { SosGateway } from '../sos/sos.gateway';
import type { TeamLocationPayload } from '../common/socket-events.types';

// TDD cho CLAUDE.md kế hoạch "#2 — team:location-updated thiếu distanceToVictim/
// estimatedArrival" (SRS Phụ lục A + F-RT-01 3.4.1). File spec đầu tiên cho service này
// (chưa có trước đó) — dùng hand-rolled fake cho DataSource/SosGateway, cùng pattern với
// sos.service.spec.ts (không Test.createTestingModule vì chỉ cần constructor injection).
//
// updateLocation() SAU KHI SỬA sẽ gọi dataSource.query() theo đúng thứ tự:
//   1. assertOwnership()      → SELECT leader_id, ward_code ... (mảng thẳng, không tuple)
//   2. UPDATE ... RETURNING   → tuple [rows[], affectedCount] (xem Mục 15.11)
//   3. tìm SOS active của đội → SELECT distance_meters, eta_minutes ... (mảng thẳng, 0 hoặc 1 dòng)
// Bước 3 CHƯA TỒN TẠI trong code hiện tại — các test dưới đây phải ĐỎ cho tới khi implement.

function buildDataSource(): { query: jest.Mock } {
  return { query: jest.fn() };
}

function buildGateway(): { emitTeamLocationUpdated: jest.Mock } {
  return { emitTeamLocationUpdated: jest.fn() };
}

describe('RescueTeamsService.updateLocation — distanceToVictim/estimatedArrival', () => {
  let dataSource: { query: jest.Mock };
  let gateway: { emitTeamLocationUpdated: jest.Mock };
  let service: RescueTeamsService;

  beforeEach(() => {
    dataSource = buildDataSource();
    gateway = buildGateway();
    service = new RescueTeamsService(
      dataSource as unknown as DataSource,
      gateway as unknown as SosGateway,
    );
  });

  it('đội đang có SOS active → payload socket kèm distanceToVictim (mét) và estimatedArrival (phút)', async () => {
    dataSource.query
      // 1. assertOwnership
      .mockResolvedValueOnce([{ leader_id: 'leader-1', ward_code: '24781' }])
      // 2. UPDATE rescue_teams ... RETURNING updated_at → tuple
      .mockResolvedValueOnce([
        [{ updated_at: new Date('2026-09-17T10:00:00Z') }],
        1,
      ])
      // 3. tìm SOS active của đội, tính khoảng cách tới vị trí MỚI vừa cập nhật
      .mockResolvedValueOnce([{ distance_meters: 1626, eta_minutes: 3 }]);

    const result = await service.updateLocation(
      'team-1',
      11.9465,
      108.4419,
      'leader-1',
    );

    expect(result).toMatchObject({
      teamId: 'team-1',
      wardCode: '24781',
      lat: 11.9465,
      lng: 108.4419,
    });

    expect(dataSource.query).toHaveBeenCalledTimes(3);

    // Truy vấn thứ 3 phải dùng ĐÚNG toạ độ mới vừa cập nhật (lng trước, lat sau — quy ước
    // PostGIS của cả dự án) và đúng teamId, không phải toạ độ cũ trong DB trước khi UPDATE.
    const [thirdSql, thirdParams] = dataSource.query.mock.calls[2] as [
      string,
      unknown[],
    ];
    expect(thirdSql).toMatch(/sos_requests/);
    expect(thirdParams).toEqual([108.4419, 11.9465, 'team-1']);

    const [, payload] = gateway.emitTeamLocationUpdated.mock.calls[0] as [
      string,
      TeamLocationPayload,
    ];
    expect(payload).toMatchObject({
      teamId: 'team-1',
      lat: 11.9465,
      lng: 108.4419,
      distanceToVictim: 1626,
      estimatedArrival: 3,
    });
  });

  it('đội KHÔNG có SOS active (rảnh/giữa 2 nhiệm vụ) → payload không có distanceToVictim/estimatedArrival', async () => {
    dataSource.query
      .mockResolvedValueOnce([{ leader_id: 'leader-1', ward_code: '24781' }])
      .mockResolvedValueOnce([
        [{ updated_at: new Date('2026-09-17T10:00:00Z') }],
        1,
      ])
      // Không có SOS active nào gán cho đội này → mảng rỗng
      .mockResolvedValueOnce([]);

    await service.updateLocation('team-1', 11.9465, 108.4419, 'leader-1');

    const [, payload] = gateway.emitTeamLocationUpdated.mock.calls[0] as [
      string,
      TeamLocationPayload,
    ];
    expect(payload.distanceToVictim).toBeUndefined();
    expect(payload.estimatedArrival).toBeUndefined();
  });

  it('không phải leader của đội → ForbiddenException, không tính/emit gì cả (hành vi cũ, không đổi)', async () => {
    dataSource.query.mockResolvedValueOnce([
      { leader_id: 'leader-khac', ward_code: '24781' },
    ]);

    await expect(
      service.updateLocation('team-1', 11.9465, 108.4419, 'leader-1'),
    ).rejects.toThrow('Không có quyền cập nhật đội cứu hộ này');

    expect(gateway.emitTeamLocationUpdated).not.toHaveBeenCalled();
  });
});
