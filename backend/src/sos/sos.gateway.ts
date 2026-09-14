import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Inject, forwardRef } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { SOCKET_EVENTS } from '../common/socket-events.types';
import type {
  UserRole,
  SosNewPayload,
  SosUpdatedPayload,
  TeamLocationPayload,
  TeamUpdateLocationPayload,
} from '../common/socket-events.types';
import { RescueTeamsService } from '../rescue-teams/rescue-teams.service';

interface JwtPayload {
  sub: string;
  phone: string;
  role: UserRole;
  wardCode: string | null;
}

function maskPhone(phone: string): string {
  return phone.length > 3 ? `***${phone.slice(-3)}` : '***';
}

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  },
})
export class SosGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
    @Inject(forwardRef(() => RescueTeamsService))
    private rescueTeamsService: RescueTeamsService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    try {
      const rawToken: unknown = client.handshake.auth.token;
      if (typeof rawToken !== 'string') throw new Error('No token');
      const token = rawToken.replace('Bearer ', '');
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: this.configService.get('JWT_SECRET'),
      });
      (client.data as { user: JwtPayload }).user = payload;
      if (payload.wardCode) {
        await client.join(`ward:${payload.wardCode}`);
      }
      if (payload.role === 'commander') {
        await client.join('province:lamdong');
      }
      if (payload.role === 'rescuer') {
        // Đội được auto-assign/commander phân công theo khoảng cách GPS (findNearestTeams),
        // không theo ranh giới xã — đội có thể được giao SOS ở xã khác room `ward:*` của
        // leader không phủ tới. Join thêm room theo TỪNG đội leader này phụ trách để
        // emitSosUpdated() (bên dưới) chắc chắn tới được leader bất kể xã nào.
        const teamIds = await this.rescueTeamsService.findTeamIdsByLeader(
          payload.sub,
        );
        for (const id of teamIds) {
          await client.join(`team:${id}`);
        }
      }
      console.log(
        `✅ Connected: ${maskPhone(payload.phone)} (${payload.role})`,
      );
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket): void {
    console.log(`Disconnected: ${client.id}`);
  }

  // Gọi từ SosService sau khi lưu SOS
  emitNewSos(wardCode: string, data: SosNewPayload): void {
    this.server.to(`ward:${wardCode}`).emit(SOCKET_EVENTS.SOS_NEW, data);
    this.server.to('province:lamdong').emit(SOCKET_EVENTS.SOS_NEW, data);
  }

  emitSosUpdated(
    sosId: string,
    wardCode: string,
    data: SosUpdatedPayload,
  ): void {
    this.server.to(`sos:${sosId}`).emit(SOCKET_EVENTS.SOS_UPDATED, data);
    this.server.to(`ward:${wardCode}`).emit(SOCKET_EVENTS.SOS_UPDATED, data);
    // Đội được giao có thể ở khác xã với SOS (phân công theo GPS) — room ward:* ở trên
    // không phủ tới leader đội đó, nên bắn thêm vào room riêng theo đội.
    if (data.assignedTeamId) {
      this.server
        .to(`team:${data.assignedTeamId}`)
        .emit(SOCKET_EVENTS.SOS_UPDATED, data);
    }
  }

  emitTeamLocationUpdated(wardCode: string, data: TeamLocationPayload): void {
    this.server
      .to(`ward:${wardCode}`)
      .emit(SOCKET_EVENTS.TEAM_LOCATION_UPDATED, data);
    this.server
      .to('province:lamdong')
      .emit(SOCKET_EVENTS.TEAM_LOCATION_UPDATED, data);
  }

  @SubscribeMessage(SOCKET_EVENTS.TEAM_UPDATE_LOCATION)
  async handleTeamLocation(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: TeamUpdateLocationPayload,
  ): Promise<void> {
    const user = (client.data as { user?: JwtPayload }).user;
    if (!user) return; // phòng hờ — handleConnection() đã disconnect nếu JWT không hợp lệ
    try {
      await this.rescueTeamsService.updateLocation(
        data.teamId,
        data.lat,
        data.lng,
        user.sub,
      );
    } catch (err) {
      // WS không có response HTTP để trả lỗi — log và bỏ qua, không throw làm crash gateway
      console.error(`Team location update failed: ${(err as Error).message}`);
    }
  }
}
