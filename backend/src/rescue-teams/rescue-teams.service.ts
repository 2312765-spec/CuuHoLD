import {
  Injectable,
  Inject,
  forwardRef,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { SosGateway } from '../sos/sos.gateway';
import type { TeamLocationPayload } from '../common/socket-events.types';
import type { RescueTeamStatus } from './rescue-team.entity';

export interface RescueTeamListRow {
  id: string;
  name: string;
  status: RescueTeamStatus;
  specialties: string[];
  ward_code: string;
  lat: number | null;
  lng: number | null;
  leader_id: string;
  leader_name: string;
  leader_phone: string;
}

export interface UpdateTeamLocationResult {
  teamId: string;
  wardCode: string;
  lat: number;
  lng: number;
  updatedAt: string;
}

export interface UpdateTeamStatusResult {
  teamId: string;
  status: RescueTeamStatus;
  updatedAt: string;
}

interface TeamOwnershipRow {
  leader_id: string;
  ward_code: string;
}

@Injectable()
export class RescueTeamsService {
  constructor(
    private dataSource: DataSource,
    @Inject(forwardRef(() => SosGateway)) private sosGateway: SosGateway,
  ) {}

  async findAll(): Promise<RescueTeamListRow[]> {
    return this.dataSource.query<RescueTeamListRow[]>(`
      SELECT rt.id, rt.name, rt.status, rt.specialties, rt.ward_code,
        ST_Y(rt.current_location::geometry) AS lat,
        ST_X(rt.current_location::geometry) AS lng,
        rt.leader_id AS leader_id,
        u.name AS leader_name, u.phone AS leader_phone
      FROM rescue_teams rt JOIN users u ON u.id = rt.leader_id
      ORDER BY rt.name
    `);
  }

  private async assertOwnership(
    teamId: string,
    actingUserId: string,
  ): Promise<TeamOwnershipRow> {
    const rows = await this.dataSource.query<TeamOwnershipRow[]>(
      `SELECT leader_id, ward_code FROM rescue_teams WHERE id = $1`,
      [teamId],
    );
    if (!rows[0]) throw new NotFoundException('Không tìm thấy đội cứu hộ');
    if (rows[0].leader_id !== actingUserId) {
      throw new ForbiddenException('Không có quyền cập nhật đội cứu hộ này');
    }
    return rows[0];
  }

  // Dùng chung cho REST PATCH /:id/location và WebSocket 'team:update-location'
  // — tránh 2 nơi trùng lặp logic ownership-check/SQL rồi lệch nhau theo thời gian.
  async updateLocation(
    teamId: string,
    lat: number,
    lng: number,
    actingUserId: string,
  ): Promise<UpdateTeamLocationResult> {
    const team = await this.assertOwnership(teamId, actingUserId);

    // LƯU Ý: ST_MakePoint(longitude, latitude) — lng TRƯỚC, lat SAU
    const rows = await this.dataSource.query<{ updated_at: Date }[]>(
      `
      UPDATE rescue_teams
      SET current_location = ST_SetSRID(ST_MakePoint($1, $2), 4326), updated_at = NOW()
      WHERE id = $3
      RETURNING updated_at
    `,
      [lng, lat, teamId],
    );

    const payload: TeamLocationPayload = {
      teamId,
      lat,
      lng,
      wardCode: team.ward_code,
      updatedAt: rows[0].updated_at.toISOString(),
    };
    this.sosGateway.emitTeamLocationUpdated(team.ward_code, payload);

    return {
      teamId,
      wardCode: team.ward_code,
      lat,
      lng,
      updatedAt: payload.updatedAt,
    };
  }

  async updateStatus(
    teamId: string,
    status: RescueTeamStatus,
    actingUserId: string,
  ): Promise<UpdateTeamStatusResult> {
    await this.assertOwnership(teamId, actingUserId);

    const rows = await this.dataSource.query<{ updated_at: Date }[]>(
      `UPDATE rescue_teams SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING updated_at`,
      [status, teamId],
    );

    return { teamId, status, updatedAt: rows[0].updated_at.toISOString() };
  }
}
