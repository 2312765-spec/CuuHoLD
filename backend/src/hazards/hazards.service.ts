import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { SosGateway } from '../sos/sos.gateway';
import type { HazardType, HazardSeverity } from './hazard.types';

export interface HazardResult {
  id: string;
  type: HazardType;
  description: string | null;
  lat: number;
  lng: number;
  radius_meters: number;
  severity: HazardSeverity;
  ward_code: string | null;
  is_active: boolean;
  created_at: string;
  resolved_at: string | null;
}

export interface CreateHazardInput {
  type: HazardType;
  description?: string;
  lat: number;
  lng: number;
  radiusMeters?: number;
  severity?: HazardSeverity;
}

const HAZARD_LABEL: Record<HazardType, string> = {
  landslide: 'Sạt lở',
  fallen_tree: 'Cây đổ',
  flood: 'Ngập lụt',
  danger: 'Nguy hiểm',
  other: 'Cảnh báo khác',
};

const DEFAULT_RADIUS_M = 200;

const HAZARD_SELECT = `
  SELECT h.id, h.type, h.description,
    ST_Y(h.location::geometry) AS lat,
    ST_X(h.location::geometry) AS lng,
    h.radius_meters, h.severity, h.ward_code, h.is_active, h.created_at, h.resolved_at
  FROM road_hazards h
`;

@Injectable()
export class HazardsService {
  constructor(
    private dataSource: DataSource,
    private sosGateway: SosGateway,
  ) {}

  async findActive(): Promise<HazardResult[]> {
    return this.dataSource.query<HazardResult[]>(
      `${HAZARD_SELECT} WHERE h.is_active = true ORDER BY h.created_at DESC`,
    );
  }

  async findAll(): Promise<HazardResult[]> {
    return this.dataSource.query<HazardResult[]>(
      `${HAZARD_SELECT} ORDER BY h.created_at DESC`,
    );
  }

  async create(
    input: CreateHazardInput,
    creatorId: string,
  ): Promise<HazardResult> {
    // LƯU Ý: ST_MakePoint(longitude, latitude) — lng TRƯỚC, lat SAU
    const rows = await this.dataSource.query<{ id: string }[]>(
      `
      INSERT INTO road_hazards (type, description, location, radius_meters, created_by, severity)
      VALUES ($1, $2, ST_SetSRID(ST_MakePoint($3, $4), 4326), $5, $6, $7)
      RETURNING id
    `,
      [
        input.type,
        input.description ?? null,
        input.lng,
        input.lat,
        input.radiusMeters ?? DEFAULT_RADIUS_M,
        creatorId,
        input.severity ?? 'blocked',
      ],
    );

    const hazard = await this.findById(rows[0].id);

    this.sosGateway.emitSystemNotification(hazard.ward_code, {
      message: `${hazard.severity === 'blocked' ? 'Chặn đường' : 'Cảnh báo'} mới: ${HAZARD_LABEL[hazard.type]}${
        hazard.description ? ' — ' + hazard.description : ''
      }`,
      level: hazard.severity === 'blocked' ? 'critical' : 'warning',
      wardCode: hazard.ward_code ?? undefined,
      createdAt: hazard.created_at,
    });

    return hazard;
  }

  async resolve(id: string): Promise<HazardResult> {
    // UPDATE...RETURNING trả tuple [rows, affectedCount] qua driver TypeORM (khác SELECT/INSERT
    // trả thẳng mảng) — xem chú thích cùng bẫy này ở rescue-teams.service.ts/sos.service.ts.
    const [rows] = await this.dataSource.query<[{ id: string }[], number]>(
      `UPDATE road_hazards SET is_active = false, resolved_at = NOW() WHERE id = $1 RETURNING id`,
      [id],
    );
    if (!rows[0]) throw new NotFoundException('Không tìm thấy cảnh báo');

    const hazard = await this.findById(id);

    this.sosGateway.emitSystemNotification(hazard.ward_code, {
      message: `Đã gỡ cảnh báo: ${HAZARD_LABEL[hazard.type]}`,
      level: 'info',
      wardCode: hazard.ward_code ?? undefined,
      createdAt: new Date().toISOString(),
    });

    return hazard;
  }

  private async findById(id: string): Promise<HazardResult> {
    const rows = await this.dataSource.query<HazardResult[]>(
      `${HAZARD_SELECT} WHERE h.id = $1`,
      [id],
    );
    if (!rows[0]) throw new NotFoundException('Không tìm thấy cảnh báo');
    return rows[0];
  }

  // Dùng cho RoutingService — buffer từng cảnh báo (PostGIS geography, mét thật, không phải độ
  // kinh/vĩ) thành 1 polygon tròn rồi gộp vào 1 MultiPolygon GeoJSON để gửi ORS
  // options.avoid_polygons. Trả null khi không có cảnh báo active nào — RoutingService khi đó
  // bỏ hẳn field avoid_polygons khỏi request thay vì gửi mảng rỗng.
  async findActiveAvoidPolygons(): Promise<{
    type: 'MultiPolygon';
    coordinates: number[][][][];
  } | null> {
    const rows = await this.dataSource.query<{ geojson: string }[]>(`
      SELECT ST_AsGeoJSON(ST_Buffer(location::geography, radius_meters)::geometry) AS geojson
      FROM road_hazards
      WHERE is_active = true AND severity = 'blocked'
    `);
    if (rows.length === 0) return null;
    return {
      type: 'MultiPolygon',
      coordinates: rows.map(
        (r) =>
          (JSON.parse(r.geojson) as { coordinates: number[][][] }).coordinates,
      ),
    };
  }
}
