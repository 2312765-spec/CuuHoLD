import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { SOCKET_EVENTS } from '../common/socket-events.types';
import type {
  UserRole,
  SosNewPayload,
  SosUpdatedPayload,
  TeamUpdateLocationPayload,
} from '../common/socket-events.types';

interface JwtPayload {
  sub: string;
  phone: string;
  role: UserRole;
  districtCode: string | null;
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
      if (payload.districtCode) {
        await client.join(`district:${payload.districtCode}`);
      }
      if (payload.role === 'commander') {
        await client.join('province:lamdong');
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
  emitNewSos(districtCode: string, data: SosNewPayload): void {
    this.server
      .to(`district:${districtCode}`)
      .emit(SOCKET_EVENTS.SOS_NEW, data);
    this.server.to('province:lamdong').emit(SOCKET_EVENTS.SOS_NEW, data);
  }

  emitSosUpdated(
    sosId: string,
    districtCode: string,
    data: SosUpdatedPayload,
  ): void {
    this.server.to(`sos:${sosId}`).emit(SOCKET_EVENTS.SOS_UPDATED, data);
    this.server
      .to(`district:${districtCode}`)
      .emit(SOCKET_EVENTS.SOS_UPDATED, data);
  }

  @SubscribeMessage(SOCKET_EVENTS.TEAM_UPDATE_LOCATION)
  handleTeamLocation(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: TeamUpdateLocationPayload,
  ): void {
    // Gọi GisService cập nhật vị trí + emit location-updated
    console.log(`Team location: ${JSON.stringify(data)}`);
  }
}
