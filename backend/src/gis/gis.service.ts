import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

export interface NearestTeamResult {
  id: string;
  name: string;
  status: string;
  specialties: string[];
  lat: number;
  lng: number;
  distance_meters: number;
  eta_minutes: number;
  leader_name: string;
  leader_phone: string;
}

export interface SosHeatmapResult {
  lat: number;
  lng: number;
  district_code: string | null;
  incident_count: number;
}

@Injectable()
export class GisService {
  constructor(private dataSource: DataSource) {}

  // SQL này do thành viên C viết và test trên Supabase
  // B chỉ wrap vào đây, không cần viết SQL từ đầu
  async findNearestTeams(
    lat: number,
    lng: number,
    radiusM = 10000,
    limit = 5,
  ): Promise<NearestTeamResult[]> {
    return this.dataSource.query<NearestTeamResult[]>(
      `
      SELECT rt.id, rt.name, rt.status, rt.specialties,
        ST_Y(rt.current_location::geometry) AS lat,
        ST_X(rt.current_location::geometry) AS lng,
        ROUND(ST_Distance(
          rt.current_location::geography,
          ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
        )::numeric) AS distance_meters,
        ROUND(ST_Distance(
          rt.current_location::geography,
          ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
        ) / 1000 / 40 * 60) AS eta_minutes,
        u.name AS leader_name, u.phone AS leader_phone
      FROM rescue_teams rt JOIN users u ON u.id = rt.leader_id
      WHERE rt.status = 'available'
        AND rt.current_location IS NOT NULL
        AND ST_DWithin(
          rt.current_location::geography,
          ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3)
      ORDER BY distance_meters ASC LIMIT $4
    `,
      [lng, lat, radiusM, limit],
    );
    // QUAN TRỌNG: $1=lng, $2=lat — longitude TRƯỚC, latitude SAU
  }

  async getSosHeatmap(from: Date, to: Date): Promise<SosHeatmapResult[]> {
    return this.dataSource.query<SosHeatmapResult[]>(
      `
      SELECT
        ST_Y(location::geometry) AS lat,
        ST_X(location::geometry) AS lng,
        district_code,
        COUNT(*)::int AS incident_count
      FROM sos_requests
      WHERE created_at BETWEEN $1 AND $2
      GROUP BY location, district_code
      ORDER BY incident_count DESC
    `,
      [from, to],
    );
  }
}
