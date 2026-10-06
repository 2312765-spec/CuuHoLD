import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';

export interface CountByKey {
  key: string;
  count: number;
}

export interface SystemStatus {
  node_env: string;
  uptime_seconds: number;
  database: { ok: boolean; latency_ms: number | null };
  // Chỉ báo ĐÃ CẤU HÌNH hay chưa — tuyệt đối không trả giá trị key/secret ra ngoài.
  integrations: {
    ors_configured: boolean;
    esms_configured: boolean;
    esms_brandname_configured: boolean;
  };
  counts: {
    users_by_role: CountByKey[];
    flagged_users: number;
    inactive_users: number;
    rescue_teams: number;
    active_hazards: number;
  };
}

export interface ActivityLogEntry {
  at: string;
  kind: 'sos' | 'hazard';
  action: string;
  actor_name: string | null;
  detail: string | null;
}

export interface HealthResult {
  status: 'ok' | 'degraded';
  database: boolean;
}

@Injectable()
export class SystemService {
  constructor(
    private dataSource: DataSource,
    private config: ConfigService,
  ) {}

  // Public (không JWT) — chỉ cho nền tảng deploy (Render) biết server còn sống; không lộ chi tiết.
  async health(): Promise<HealthResult> {
    const database = await this.pingDatabase().then((r) => r.ok);
    return { status: database ? 'ok' : 'degraded', database };
  }

  private async pingDatabase(): Promise<{
    ok: boolean;
    latency_ms: number | null;
  }> {
    const started = Date.now();
    try {
      await this.dataSource.query('SELECT 1');
      return { ok: true, latency_ms: Date.now() - started };
    } catch {
      return { ok: false, latency_ms: null };
    }
  }

  private isSet(key: string): boolean {
    const v = this.config.get<string>(key);
    return typeof v === 'string' && v.trim().length > 0;
  }

  async getStatus(): Promise<SystemStatus> {
    const [database, usersByRole, userFlags, teams, hazards] =
      await Promise.all([
        this.pingDatabase(),
        this.dataSource.query<{ role: string; count: number }[]>(
          `SELECT role, COUNT(*)::int AS count FROM users GROUP BY role ORDER BY count DESC`,
        ),
        this.dataSource.query<{ flagged: number; inactive: number }[]>(
          `SELECT COUNT(*) FILTER (WHERE is_flagged)::int AS flagged,
                  COUNT(*) FILTER (WHERE NOT is_active)::int AS inactive
           FROM users`,
        ),
        this.dataSource.query<{ count: number }[]>(
          `SELECT COUNT(*)::int AS count FROM rescue_teams`,
        ),
        this.dataSource.query<{ count: number }[]>(
          `SELECT COUNT(*)::int AS count FROM road_hazards WHERE is_active = true`,
        ),
      ]);

    return {
      node_env: this.config.get<string>('NODE_ENV') ?? 'development',
      uptime_seconds: Math.round(process.uptime()),
      database,
      integrations: {
        ors_configured: this.isSet('ORS_API_KEY'),
        esms_configured:
          this.isSet('ESMS_API_KEY') && this.isSet('ESMS_SECRET_KEY'),
        esms_brandname_configured: this.isSet('ESMS_BRANDNAME'),
      },
      counts: {
        users_by_role: usersByRole.map((r) => ({
          key: r.role,
          count: Number(r.count),
        })),
        flagged_users: Number(userFlags[0].flagged),
        inactive_users: Number(userFlags[0].inactive),
        rescue_teams: Number(teams[0].count),
        active_hazards: Number(hazards[0].count),
      },
    };
  }

  // Nhật ký hoạt động gộp từ 2 nguồn đã có sẵn trong DB (không thêm bảng audit riêng):
  // sos_timeline (tạo/phân công/tiến độ SOS) và road_hazards (tạo/gỡ cảnh báo).
  async getActivity(limit: number): Promise<ActivityLogEntry[]> {
    const rows = await this.dataSource.query<
      {
        at: Date | string;
        kind: 'sos' | 'hazard';
        action: string;
        actor_name: string | null;
        detail: string | null;
      }[]
    >(
      `
      SELECT * FROM (
        SELECT t.created_at AS at, 'sos'::text AS kind, t.action,
               u.name AS actor_name,
               COALESCE(t.note, s.type) AS detail
        FROM sos_timeline t
        LEFT JOIN users u ON u.id = t.actor_id
        LEFT JOIN sos_requests s ON s.id = t.sos_id
        UNION ALL
        SELECT h.created_at, 'hazard', 'hazard_created', u.name,
               h.type || COALESCE(' — ' || h.description, '')
        FROM road_hazards h
        LEFT JOIN users u ON u.id = h.created_by
        UNION ALL
        SELECT h.resolved_at, 'hazard', 'hazard_resolved', NULL, h.type
        FROM road_hazards h
        WHERE h.resolved_at IS NOT NULL
      ) log
      ORDER BY at DESC
      LIMIT $1
    `,
      [limit],
    );

    return rows.map((r) => ({
      ...r,
      at: new Date(r.at).toISOString(),
    }));
  }
}
