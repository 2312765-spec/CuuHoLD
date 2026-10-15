// Socket.IO THẬT (server + client qua mạng localhost) cho SosGateway — kiểm phần unit test với
// server giả lập không chứng minh được:
//  1. Commander toàn tỉnh (chỉ ở phòng province:lamdong) nhận được sos:updated khi nạn nhân huỷ.
//     Thiếu điều này là lỗi thật: Dashboard phải F5 mới thấy SOS bị huỷ / đổi tiến độ.
//  2. Ai thuộc NHIỀU phòng cùng lúc (commander có xã, leader cùng xã với SOS) nhận ĐÚNG 1 lần —
//     dựa vào việc Socket.IO tự loại trùng người nhận khi emit 1 lần tới nhiều phòng.
//  3. Người ngoài cuộc (victim/rescuer xã khác, không liên quan) KHÔNG nhận.
// Phòng được gán thẳng bằng socketsJoin (không đi qua handleConnection/JWT — phần đó không phải
// thứ đang kiểm ở đây).
import { createServer, type Server as HttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Server } from 'socket.io';
import { io as ketNoi, type Socket as ClientSocket } from 'socket.io-client';
import type { JwtService } from '@nestjs/jwt';
import type { ConfigService } from '@nestjs/config';
import { SosGateway } from '../src/sos/sos.gateway';
import type { RescueTeamsService } from '../src/rescue-teams/rescue-teams.service';

const cho = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('Socket.IO thật — sos:updated / sos:new tới đúng người, đúng 1 lần', () => {
  let http: HttpServer;
  let ioServer: Server;
  let gateway: SosGateway;
  let port: number;
  const clients: ClientSocket[] = [];

  // Tạo 1 client, chờ kết nối, gán phòng phía server, đếm số lần nhận từng sự kiện.
  async function taoClient(phong: string[]) {
    const c = ketNoi(`http://localhost:${port}`, { transports: ['websocket'] });
    clients.push(c);
    await new Promise<void>((r) => c.on('connect', () => r()));
    ioServer.in(c.id as string).socketsJoin(phong);
    const nhan: Record<string, unknown[]> = {
      'sos:updated': [],
      'sos:new': [],
    };
    c.on('sos:updated', (d: unknown) => nhan['sos:updated'].push(d));
    c.on('sos:new', (d: unknown) => nhan['sos:new'].push(d));
    return nhan;
  }

  beforeAll(async () => {
    http = createServer();
    ioServer = new Server(http);
    await new Promise<void>((r) => http.listen(0, r));
    port = (http.address() as AddressInfo).port;
    gateway = new SosGateway(
      {} as unknown as JwtService,
      {} as unknown as ConfigService,
      {} as unknown as RescueTeamsService,
    );
    gateway.server = ioServer;
  });

  afterAll(async () => {
    clients.forEach((c) => c.disconnect());
    await ioServer.close();
  });

  it('nạn nhân huỷ SOS đã có đội: commander, đội, nạn nhân nhận đúng 1 lần; người ngoài không nhận', async () => {
    const commanderToanTinh = await taoClient(['province:lamdong']);
    const commanderCoXa = await taoClient(['province:lamdong', 'ward:24781']);
    const leaderCungXa = await taoClient(['ward:24781', 'team:t1']);
    const nanNhan = await taoClient(['sos:s1']);
    const nguoiNgoai = await taoClient(['ward:99999', 'team:t9']);

    gateway.emitSosUpdated('s1', '24781', {
      sosId: 's1',
      status: 'cancelled',
      wardCode: '24781',
      assignedTeamId: 't1',
      penaltyApplied: false,
      updatedAt: new Date().toISOString(),
    });
    await cho(300);

    expect(commanderToanTinh['sos:updated']).toHaveLength(1);
    expect(commanderCoXa['sos:updated']).toHaveLength(1);
    expect(leaderCungXa['sos:updated']).toHaveLength(1);
    expect(nanNhan['sos:updated']).toHaveLength(1);
    expect(nguoiNgoai['sos:updated']).toHaveLength(0);
    expect(commanderToanTinh['sos:updated'][0]).toEqual(
      expect.objectContaining({ sosId: 's1', status: 'cancelled' }),
    );
  });

  it('sos:new: commander có xã nhận 1 lần (trước đây 2 lần → Dashboard thêm trùng SOS)', async () => {
    const commanderCoXa = await taoClient(['province:lamdong', 'ward:24781']);
    const rescuerCungXa = await taoClient(['ward:24781']);

    gateway.emitNewSos('24781', {
      sosId: 's2',
      victimId: 'v1',
      victimName: 'A',
      victimPhone: '0900000000',
      type: 'flood',
      status: 'pending',
      lat: 11.9,
      lng: 108.4,
      locationEstimated: false,
      wardCode: '24781',
      createdAt: new Date().toISOString(),
      cancelDeadline: new Date().toISOString(),
    });
    await cho(300);

    expect(commanderCoXa['sos:new']).toHaveLength(1);
    expect(rescuerCungXa['sos:new']).toHaveLength(1);
  });
});
