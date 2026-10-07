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
  ward_code: string;
  ward_name: string;
  incident_count: number;
}

export interface CountByKey {
  key: string;
  count: number;
}

export interface StatsResult {
  total_sos: number;
  sos_by_status: CountByKey[];
  sos_by_type: CountByKey[];
  // null khi khoảng thời gian đang xem chưa có SOS nào ở trạng thái resolved.
  avg_response_minutes: number | null;
  teams_by_status: CountByKey[];
  flagged_users_count: number;
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

  // Dùng chung ranh giới 123 xã/phường đã có (wards.boundary) — hợp của toàn bộ ward chính là
  // ranh giới tỉnh Lâm Đồng, không cần thêm file/bảng riêng nào cho việc này. RoutingService
  // gọi hàm này để chặn gọi OpenRouteService (tốn quota free tier) cho toạ độ ngoài tỉnh.
  async isPointInProvince(lat: number, lng: number): Promise<boolean> {
    const rows = await this.dataSource.query<{ inside: boolean }[]>(
      `
      SELECT EXISTS (
        SELECT 1 FROM wards
        WHERE ST_Contains(boundary, ST_SetSRID(ST_MakePoint($1, $2), 4326))
      ) AS inside
    `,
      [lng, lat],
    );
    // QUAN TRỌNG: $1=lng, $2=lat — longitude TRƯỚC, latitude SAU
    return rows[0].inside;
  }

  // Trước đây GROUP BY location (toạ độ tuyệt đối) — GPS gần như không bao giờ trùng y hệt
  // nhau nên incident_count luôn ≈ 1, vô nghĩa (đã ghi nhận ở CLAUDE.md Mục 15.6/15.9). Sửa
  // group theo ward_code (xã/phường) — đơn vị hành chính thật, số liệu mới có ý nghĩa để
  // commander biết khu vực nào nhiều SOS nhất. Điểm hiển thị dùng TOẠ ĐỘ TRUNG BÌNH các SOS
  // trong xã đó (gần tâm cụm sự cố thật hơn là lấy tâm hành chính của cả xã, vốn có thể lệch
  // xa nơi thực sự xảy ra sự cố nếu xã đó rộng).
  async getSosHeatmap(from: Date, to: Date): Promise<SosHeatmapResult[]> {
    return this.dataSource.query<SosHeatmapResult[]>(
      `
      SELECT
        AVG(ST_Y(s.location::geometry)) AS lat,
        AVG(ST_X(s.location::geometry)) AS lng,
        s.ward_code,
        w.ward_name,
        COUNT(*)::int AS incident_count
      FROM sos_requests s
      JOIN wards w ON w.ward_code = s.ward_code
      WHERE s.created_at BETWEEN $1 AND $2
      GROUP BY s.ward_code, w.ward_name
      ORDER BY incident_count DESC
    `,
      [from, to],
    );
  }

  // Thống kê tổng quan cho commander — gộp nhiều truy vấn nhỏ (Promise.all, chạy song song)
  // thay vì 1 câu SQL phức tạp join hết mọi bảng: sos_by_status/sos_by_type/avg_response chỉ
  // lọc theo sos_requests (nhanh, độc lập); teams_by_status và flagged_users_count không phụ
  // thuộc khoảng thời gian đang xem (trạng thái đội/tài khoản là "hiện tại", không phải lịch
  // sử) nên tách riêng, không nhét chung WHERE created_at BETWEEN với phần SOS.
  async getStats(from: Date, to: Date): Promise<StatsResult> {
    const [
      sosByStatusRows,
      sosByTypeRows,
      avgResponseRows,
      teamsByStatusRows,
      flaggedRows,
    ] = await Promise.all([
      this.dataSource.query<{ status: string; count: string }[]>(
        `
        SELECT status, COUNT(*)::int AS count
        FROM sos_requests
        WHERE created_at BETWEEN $1 AND $2
        GROUP BY status
        ORDER BY count DESC
      `,
        [from, to],
      ),
      this.dataSource.query<{ type: string; count: string }[]>(
        `
        SELECT type, COUNT(*)::int AS count
        FROM sos_requests
        WHERE created_at BETWEEN $1 AND $2
        GROUP BY type
        ORDER BY count DESC
      `,
        [from, to],
      ),
      // Thời gian phản hồi = resolved_at - created_at, CHỈ tính SOS đã thật sự resolved
      // trong khoảng đang xem — cancelled/false_alarm không có ý nghĩa "phản hồi nhanh hay
      // chậm" nên loại khỏi phép tính này (khác sos_by_status, nơi mọi trạng thái đều đếm).
      this.dataSource.query<{ avg_minutes: string | null }[]>(
        `
        SELECT AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 60)::numeric(10,1) AS avg_minutes
        FROM sos_requests
        WHERE status = 'resolved' AND created_at BETWEEN $1 AND $2
      `,
        [from, to],
      ),
      this.dataSource.query<{ status: string; count: string }[]>(
        `SELECT status, COUNT(*)::int AS count FROM rescue_teams GROUP BY status ORDER BY count DESC`,
      ),
      this.dataSource.query<{ count: string }[]>(
        `SELECT COUNT(*)::int AS count FROM users WHERE is_flagged = true`,
      ),
    ]);

    const toCountByKey = (
      rows: { count: string }[],
      keyField: string,
    ): CountByKey[] =>
      rows.map((r) => ({
        key: (r as unknown as Record<string, string>)[keyField],
        count: Number(r.count),
      }));

    const sosByStatus = toCountByKey(sosByStatusRows, 'status');

    return {
      total_sos: sosByStatus.reduce((sum, r) => sum + r.count, 0),
      sos_by_status: sosByStatus,
      sos_by_type: toCountByKey(sosByTypeRows, 'type'),
      avg_response_minutes:
        avgResponseRows[0].avg_minutes != null
          ? Number(avgResponseRows[0].avg_minutes)
          : null,
      teams_by_status: toCountByKey(teamsByStatusRows, 'status'),
      flagged_users_count: Number(flaggedRows[0].count),
    };
  }
}
