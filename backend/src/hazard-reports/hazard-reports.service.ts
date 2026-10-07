import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { User } from '../users/user.entity';
import { GisService } from '../gis/gis.service';
import { HazardsService } from '../hazards/hazards.service';
import type { HazardResult } from '../hazards/hazards.service';
import { SosGateway } from '../sos/sos.gateway';
import type { HazardSeverity, HazardType } from '../hazards/hazard.types';
import type { HazardReportStatus } from '../common/socket-events.types';
import { MAX_IMAGE_BYTES, detectImageMime } from './image-validation';
import type { AllowedImageMime } from './image-validation';

export type ReportStatus = HazardReportStatus;

// Tối đa số báo cáo CHỜ DUYỆT cùng lúc của 1 người — chặn spam làm ngập hàng đợi kiểm duyệt
// (bổ sung cho rate limit theo giờ ở controller).
export const MAX_PENDING_PER_USER = 5;

// Hai báo cáo CÙNG LOẠI cách nhau không quá ngần này (mét) lúc gửi được coi là cùng một điểm và
// được gộp thành 1 mục kiểm duyệt. 100 m ≈ sai số GPS điện thoại ngoài trời (5–20 m) cộng chiều
// dài một khúc đường sạt lở thông thường; rộng hơn thì dễ gộp nhầm 2 điểm sạt KHÁC nhau trên
// cùng một con đèo, và commander sẽ duyệt cả 2 chỉ bằng 1 lần bấm.
export const DUPLICATE_RADIUS_M = 100;

// Cảnh báo đang hoạt động được coi là "ở gần" báo cáo khi báo cáo nằm trong vòng ảnh hưởng của nó
// cộng thêm biên này (mét) — bù sai số GPS của người báo.
const NEARBY_HAZARD_MARGIN_M = 50;

const DEFAULT_PAGE_SIZE = 50;

export interface NearbyHazard {
  id: string;
  type: HazardType;
  severity: HazardSeverity;
  distance_m: number;
}

export interface HazardReportRow {
  id: string;
  type: HazardType;
  description: string | null;
  lat: number;
  lng: number;
  accuracy_m: number | null;
  location_estimated: boolean;
  has_image: boolean;
  status: ReportStatus;
  ward_code: string | null;
  created_at: string;
  reviewed_at: string | null;
  review_note: string | null;
  hazard_id: string | null;
  // Khác null = báo cáo này đã được gộp vào báo cáo chính (xem DUPLICATE_RADIUS_M).
  duplicate_of: string | null;
}

// Trả cho người vừa gửi — cho biết báo cáo có được gộp không và khu vực đã có cảnh báo chưa.
export interface CreateReportResult extends HazardReportRow {
  merged: boolean;
  // Số người (khác nhau) đã báo cáo điểm này, tính cả người vừa gửi.
  group_reporter_count: number;
  nearby_hazard: NearbyHazard | null;
}

// Một báo cáo đã được gộp vào báo cáo chính — commander cần xem ảnh/mô tả của từng người.
export interface ReportFollower {
  id: string;
  reporter_id: string;
  reporter_name: string;
  reporter_phone: string;
  description: string | null;
  accuracy_m: number | null;
  has_image: boolean;
  created_at: string;
}

export interface HazardReportAdminRow extends HazardReportRow {
  reporter_id: string;
  reporter_name: string;
  reporter_phone: string;
  reviewed_by_name: string | null;
  // Chỉ có khi đã duyệt: mức độ + trạng thái hiện tại của cảnh báo được tạo ra từ báo cáo này.
  hazard_severity: HazardSeverity | null;
  hazard_is_active: boolean | null;
  // Số báo cáo trùng đã gộp vào (cùng trạng thái), và số người khác nhau đã báo điểm này.
  duplicate_count: number;
  reporter_count: number;
  // Chỉ tính cho báo cáo chờ duyệt: cảnh báo đang hoạt động đã phủ khu vực này.
  nearby_hazard: NearbyHazard | null;
  duplicates: ReportFollower[];
}

export interface CreateReportInput {
  type: HazardType;
  description?: string;
  lat: number;
  lng: number;
  accuracyMeters?: number;
  locationEstimated?: boolean;
  image?: { buffer: Buffer; size: number };
}

export interface ReportImage {
  data: Buffer;
  mime: AllowedImageMime;
}

export interface ListOptions {
  limit?: number;
  offset?: number;
}

export interface ReviewOutcome {
  report: HazardReportRow;
  // Số báo cáo trùng được xử lý theo cùng báo cáo chính.
  merged_count: number;
}

// KHÔNG chọn image_data ở đây — ảnh nặng, chỉ đọc qua getImage().
const REPORT_COLUMNS = `
  r.id, r.type, r.description,
  ST_Y(r.location::geometry) AS lat,
  ST_X(r.location::geometry) AS lng,
  r.accuracy_m, r.location_estimated,
  (r.image_data IS NOT NULL) AS has_image,
  r.status, r.ward_code, r.created_at, r.reviewed_at, r.review_note, r.hazard_id,
  r.duplicate_of
`;

interface RawAdminRow extends Omit<
  HazardReportAdminRow,
  'nearby_hazard' | 'duplicates'
> {
  nearby_hazard_id: string | null;
  nearby_hazard_type: HazardType | null;
  nearby_hazard_severity: HazardSeverity | null;
  nearby_hazard_distance_m: number | null;
}

type FollowerRow = ReportFollower & { duplicate_of: string };

@Injectable()
export class HazardReportsService {
  constructor(
    private dataSource: DataSource,
    private gisService: GisService,
    private hazardsService: HazardsService,
    private sosGateway: SosGateway,
  ) {}

  async create(
    input: CreateReportInput,
    reporter: User,
  ): Promise<CreateReportResult> {
    // Kiểm tra ảnh TRƯỚC mọi truy vấn DB: đầu vào sai thì từ chối ngay, không tốn lượt gọi nào.
    const image = this.validateImage(input.image);

    // Báo cáo ở ngoài tỉnh là vô nghĩa với hệ thống và là dấu hiệu nhiễu/spam.
    const inside = await this.gisService.isPointInProvince(
      input.lat,
      input.lng,
    );
    if (!inside) {
      throw new BadRequestException(
        'Vị trí báo cáo nằm ngoài phạm vi tỉnh Lâm Đồng',
      );
    }

    // LƯU Ý: ST_MakePoint(longitude, latitude) — lng TRƯỚC, lat SAU
    const [mine] = await this.dataSource.query<
      { pending_count: number; same_spot_count: number }[]
    >(
      `SELECT COUNT(*)::int AS pending_count,
              COUNT(*) FILTER (
                WHERE type = $2
                  AND ST_DWithin(location::geography,
                                 ST_SetSRID(ST_MakePoint($3, $4), 4326)::geography, $5)
              )::int AS same_spot_count
       FROM hazard_reports
       WHERE reporter_id = $1 AND status = 'pending'`,
      [reporter.id, input.type, input.lng, input.lat, DUPLICATE_RADIUS_M],
    );
    if (Number(mine.same_spot_count) > 0) {
      throw new ConflictException(
        'Bạn đã báo cáo điểm này và đang chờ quản trị viên xử lý. Không cần báo lại.',
      );
    }
    if (Number(mine.pending_count) >= MAX_PENDING_PER_USER) {
      throw new ConflictException(
        `Bạn đang có ${MAX_PENDING_PER_USER} báo cáo chờ duyệt. Hãy đợi quản trị viên xử lý trước khi gửi thêm.`,
      );
    }

    // Tìm báo cáo chính để gộp NGAY TRONG câu INSERT (subquery) thay vì tra cứu riêng rồi mới chèn:
    // thu hẹp khe hở đua (2 người gửi cùng lúc thì người sau thấy người trước đã commit). Báo cáo
    // chính = báo cáo CHỜ DUYỆT cũ nhất, cùng loại, trong bán kính, và bản thân nó không phải báo
    // cáo đã gộp. Cast tường minh mọi tham số vì INSERT ... SELECT không tự suy ra kiểu từ cột đích.
    // ward_code KHÔNG truyền tay — trigger trg_hazard_reports_set_ward tự suy ra từ location.
    const inserted = await this.dataSource.query<
      { id: string; duplicate_of: string | null }[]
    >(
      `
      INSERT INTO hazard_reports
        (reporter_id, type, description, location, accuracy_m, location_estimated,
         image_data, image_mime, duplicate_of)
      SELECT $1::uuid, $2::varchar, $3::text,
             ST_SetSRID(ST_MakePoint($4::float8, $5::float8), 4326),
             $6::int, $7::boolean, $8::bytea, $9::varchar,
             (SELECT p.id FROM hazard_reports p
              WHERE p.status = 'pending' AND p.duplicate_of IS NULL AND p.type = $2::varchar
                AND ST_DWithin(p.location::geography,
                               ST_SetSRID(ST_MakePoint($4::float8, $5::float8), 4326)::geography,
                               $10::float8)
              ORDER BY p.created_at ASC
              LIMIT 1)
      RETURNING id, duplicate_of
    `,
      [
        reporter.id,
        input.type,
        input.description?.trim() || null,
        input.lng,
        input.lat,
        input.accuracyMeters != null ? Math.round(input.accuracyMeters) : null,
        input.locationEstimated ?? false,
        image.data,
        image.mime,
        DUPLICATE_RADIUS_M,
      ],
    );
    const { id, duplicate_of: mergedInto } = inserted[0];

    const [row, reporterCount, nearby] = await Promise.all([
      this.findOwnById(id),
      mergedInto ? this.countGroupReporters(mergedInto) : Promise.resolve(1),
      this.findNearbyHazard(input.lat, input.lng),
    ]);

    // Báo ngay cho commander đang online (UI hiện toast + làm mới hàng đợi). Chỉ commander nhận.
    this.sosGateway.emitHazardReportNew({
      reportId: id,
      mergedIntoReportId: mergedInto,
      type: input.type,
      reporterName: reporter.name,
      wardCode: row.ward_code,
      reporterCount,
      createdAt: new Date(row.created_at).toISOString(),
    });

    return {
      ...row,
      merged: mergedInto !== null,
      group_reporter_count: reporterCount,
      nearby_hazard: nearby,
    };
  }

  private validateImage(image: CreateReportInput['image']): {
    data: Buffer;
    mime: AllowedImageMime;
  } {
    if (!image) {
      throw new BadRequestException(
        'Cần ảnh hiện trường chụp trực tiếp bằng camera để gửi báo cáo',
      );
    }
    if (image.size > MAX_IMAGE_BYTES) {
      throw new BadRequestException('Ảnh quá lớn (tối đa 2MB)');
    }
    const mime = detectImageMime(image.buffer);
    if (!mime) {
      throw new BadRequestException(
        'File tải lên không phải ảnh hợp lệ (chỉ nhận JPEG, PNG hoặc WebP)',
      );
    }
    return { data: image.buffer, mime };
  }

  private async countGroupReporters(primaryId: string): Promise<number> {
    const rows = await this.dataSource.query<{ n: number }[]>(
      `SELECT COUNT(DISTINCT reporter_id)::int AS n
       FROM hazard_reports
       WHERE id = $1 OR (duplicate_of = $1 AND status = 'pending')`,
      [primaryId],
    );
    return Number(rows[0].n);
  }

  private async findNearbyHazard(
    lat: number,
    lng: number,
  ): Promise<NearbyHazard | null> {
    const rows = await this.dataSource.query<NearbyHazard[]>(
      `SELECT h.id, h.type, h.severity,
              ROUND(ST_Distance(h.location::geography, q.pt))::int AS distance_m
       FROM road_hazards h,
            (SELECT ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography AS pt) q
       WHERE h.is_active = true
         AND ST_DWithin(h.location::geography, q.pt, h.radius_meters + $3)
       ORDER BY ST_Distance(h.location::geography, q.pt) ASC
       LIMIT 1`,
      [lng, lat, NEARBY_HAZARD_MARGIN_M],
    );
    return rows[0] ?? null;
  }

  private async findOwnById(id: string): Promise<HazardReportRow> {
    const rows = await this.dataSource.query<HazardReportRow[]>(
      `SELECT ${REPORT_COLUMNS} FROM hazard_reports r WHERE r.id = $1`,
      [id],
    );
    if (!rows[0]) throw new NotFoundException('Không tìm thấy báo cáo');
    return rows[0];
  }

  async findMine(userId: string): Promise<HazardReportRow[]> {
    return this.dataSource.query<HazardReportRow[]>(
      `SELECT ${REPORT_COLUMNS} FROM hazard_reports r
       WHERE r.reporter_id = $1 ORDER BY r.created_at DESC LIMIT 50`,
      [userId],
    );
  }

  // Hàng đợi (status='pending') và lịch sử (approved/rejected) cho commander.
  //
  // Mỗi MỤC trong danh sách là 1 báo cáo chính; báo cáo đã gộp vào nó (cùng trạng thái) không hiện
  // thành mục riêng mà nằm trong `duplicates` + đếm ở duplicate_count/reporter_count. Điều kiện
  // `pr.status <> r.status` giữ lại báo cáo "mồ côi": báo cáo gộp vào 1 báo cáo chính mà trạng
  // thái đã khác (VD: báo cáo gửi đúng lúc báo cáo chính vừa được duyệt) — nếu ẩn đi thì nó sẽ
  // chờ duyệt mãi mà không ai thấy.
  async findForModeration(
    status: ReportStatus = 'pending',
    options: ListOptions = {},
  ): Promise<HazardReportAdminRow[]> {
    const limit = options.limit ?? DEFAULT_PAGE_SIZE;
    const offset = options.offset ?? 0;

    const rows = await this.dataSource.query<RawAdminRow[]>(
      `SELECT ${REPORT_COLUMNS},
              r.reporter_id, u.name AS reporter_name, u.phone AS reporter_phone,
              rv.name AS reviewed_by_name,
              hz.severity AS hazard_severity, hz.is_active AS hazard_is_active,
              (SELECT COUNT(*)::int FROM hazard_reports d
               WHERE d.duplicate_of = r.id AND d.status = r.status) AS duplicate_count,
              (SELECT COUNT(DISTINCT x.reporter_id)::int FROM hazard_reports x
               WHERE x.id = r.id OR (x.duplicate_of = r.id AND x.status = r.status)) AS reporter_count,
              nh.id AS nearby_hazard_id, nh.type AS nearby_hazard_type,
              nh.severity AS nearby_hazard_severity, nh.distance_m AS nearby_hazard_distance_m
       FROM hazard_reports r
       JOIN users u ON u.id = r.reporter_id
       LEFT JOIN users rv ON rv.id = r.reviewed_by
       LEFT JOIN road_hazards hz ON hz.id = r.hazard_id
       LEFT JOIN hazard_reports pr ON pr.id = r.duplicate_of
       LEFT JOIN LATERAL (
         SELECT h.id, h.type, h.severity,
                ROUND(ST_Distance(h.location::geography, r.location::geography))::int AS distance_m
         FROM road_hazards h
         WHERE r.status = 'pending' AND h.is_active = true
           AND ST_DWithin(h.location::geography, r.location::geography,
                          h.radius_meters + $4::int)
         ORDER BY ST_Distance(h.location::geography, r.location::geography) ASC
         LIMIT 1
       ) nh ON true
       WHERE r.status = $1 AND (r.duplicate_of IS NULL OR pr.status <> r.status)
       ORDER BY r.created_at DESC
       LIMIT $2 OFFSET $3`,
      [status, limit, offset, NEARBY_HAZARD_MARGIN_M],
    );
    if (rows.length === 0) return [];

    const followers = await this.dataSource.query<FollowerRow[]>(
      `SELECT d.id, d.duplicate_of, d.reporter_id,
              u.name AS reporter_name, u.phone AS reporter_phone,
              d.description, d.accuracy_m, (d.image_data IS NOT NULL) AS has_image, d.created_at
       FROM hazard_reports d JOIN users u ON u.id = d.reporter_id
       WHERE d.duplicate_of = ANY($1::uuid[]) AND d.status = $2
       ORDER BY d.created_at ASC`,
      [rows.map((r) => r.id), status],
    );
    const byPrimary = new Map<string, ReportFollower[]>();
    for (const f of followers) {
      const { duplicate_of: primaryId, ...follower } = f;
      byPrimary.set(primaryId, [...(byPrimary.get(primaryId) ?? []), follower]);
    }

    return rows.map((raw) => {
      const {
        nearby_hazard_id,
        nearby_hazard_type,
        nearby_hazard_severity,
        nearby_hazard_distance_m,
        ...rest
      } = raw;
      return {
        ...rest,
        nearby_hazard:
          nearby_hazard_id &&
          nearby_hazard_type &&
          nearby_hazard_severity &&
          nearby_hazard_distance_m !== null
            ? {
                id: nearby_hazard_id,
                type: nearby_hazard_type,
                severity: nearby_hazard_severity,
                distance_m: Number(nearby_hazard_distance_m),
              }
            : null,
        duplicates: byPrimary.get(raw.id) ?? [],
      };
    });
  }

  async getImage(id: string, user: User): Promise<ReportImage> {
    const rows = await this.dataSource.query<
      {
        image_data: Buffer | null;
        image_mime: AllowedImageMime | null;
        reporter_id: string;
      }[]
    >(
      `SELECT image_data, image_mime, reporter_id FROM hazard_reports WHERE id = $1`,
      [id],
    );
    const row = rows[0];
    if (!row || !row.image_data || !row.image_mime) {
      throw new NotFoundException('Báo cáo không có ảnh');
    }
    // Ảnh hiện trường có thể lộ vị trí/danh tính người báo — chỉ commander và chính người báo xem.
    if (user.role !== 'commander' && row.reporter_id !== user.id) {
      throw new ForbiddenException('Không có quyền xem ảnh này');
    }
    return { data: row.image_data, mime: row.image_mime };
  }

  // Duyệt: "chiếm" báo cáo bằng UPDATE có điều kiện status='pending' (2 commander bấm cùng lúc
  // chỉ 1 người thắng, không sinh 2 cảnh báo trùng) rồi mới tạo cảnh báo thật. Nếu tạo cảnh báo
  // lỗi thì trả báo cáo về 'pending' để duyệt lại được, không để nó kẹt ở 'approved' mà không có
  // cảnh báo nào. Chỉ SAU KHI có cảnh báo mới áp dụng theo cho các báo cáo đã gộp vào nó.
  async approve(
    id: string,
    opts: { severity: HazardSeverity; radiusMeters?: number; note?: string },
    reviewer: User,
  ): Promise<ReviewOutcome & { hazard: HazardResult }> {
    const note = opts.note?.trim() || null;
    const [claimed] = await this.dataSource.query<
      [
        {
          type: HazardType;
          description: string | null;
          lat: number;
          lng: number;
        }[],
        number,
      ]
    >(
      `UPDATE hazard_reports r
       SET status = 'approved', reviewed_by = $2, reviewed_at = NOW(), review_note = $3
       WHERE r.id = $1 AND r.status = 'pending'
         AND NOT EXISTS (SELECT 1 FROM hazard_reports pr
                         WHERE pr.id = r.duplicate_of AND pr.status = 'pending')
       RETURNING r.type, r.description,
                 ST_Y(r.location::geometry) AS lat, ST_X(r.location::geometry) AS lng`,
      [id, reviewer.id, note],
    );
    if (!claimed[0]) await this.throwNotClaimable(id);

    let hazard: HazardResult;
    try {
      hazard = await this.hazardsService.create(
        {
          type: claimed[0].type,
          description: claimed[0].description ?? undefined,
          lat: claimed[0].lat,
          lng: claimed[0].lng,
          radiusMeters: opts.radiusMeters,
          severity: opts.severity,
        },
        reviewer.id,
      );
    } catch (e) {
      await this.dataSource.query(
        `UPDATE hazard_reports SET status = 'pending', reviewed_by = NULL, reviewed_at = NULL, review_note = NULL WHERE id = $1`,
        [id],
      );
      throw e;
    }

    await this.dataSource.query(
      `UPDATE hazard_reports SET hazard_id = $2 WHERE id = $1`,
      [id, hazard.id],
    );
    const [followers] = await this.dataSource.query<[{ id: string }[], number]>(
      `UPDATE hazard_reports
       SET status = 'approved', reviewed_by = $2, reviewed_at = NOW(), review_note = $3, hazard_id = $4
       WHERE duplicate_of = $1 AND status = 'pending'
       RETURNING id`,
      [id, reviewer.id, note, hazard.id],
    );

    this.sosGateway.emitHazardReportReviewed({
      reportId: id,
      status: 'approved',
      hazardId: hazard.id,
      reviewerName: reviewer.name,
      mergedCount: followers.length,
      updatedAt: new Date().toISOString(),
    });

    return {
      report: await this.findOwnById(id),
      hazard,
      merged_count: followers.length,
    };
  }

  async reject(
    id: string,
    note: string | undefined,
    reviewer: User,
  ): Promise<ReviewOutcome> {
    const cleanNote = note?.trim() || null;
    const [updated] = await this.dataSource.query<[{ id: string }[], number]>(
      `UPDATE hazard_reports r
       SET status = 'rejected', reviewed_by = $2, reviewed_at = NOW(), review_note = $3
       WHERE r.id = $1 AND r.status = 'pending'
         AND NOT EXISTS (SELECT 1 FROM hazard_reports pr
                         WHERE pr.id = r.duplicate_of AND pr.status = 'pending')
       RETURNING r.id`,
      [id, reviewer.id, cleanNote],
    );
    if (!updated[0]) await this.throwNotClaimable(id);

    const [followers] = await this.dataSource.query<[{ id: string }[], number]>(
      `UPDATE hazard_reports
       SET status = 'rejected', reviewed_by = $2, reviewed_at = NOW(), review_note = $3
       WHERE duplicate_of = $1 AND status = 'pending'
       RETURNING id`,
      [id, reviewer.id, cleanNote],
    );

    this.sosGateway.emitHazardReportReviewed({
      reportId: id,
      status: 'rejected',
      hazardId: null,
      reviewerName: reviewer.name,
      mergedCount: followers.length,
      updatedAt: new Date().toISOString(),
    });

    return {
      report: await this.findOwnById(id),
      merged_count: followers.length,
    };
  }

  // Phân biệt 3 lý do không "chiếm" được báo cáo: không tồn tại (404), đã được xử lý rồi (409), hoặc
  // đã gộp vào báo cáo chính khác còn đang chờ (409) — phải xử lý báo cáo chính, nếu không sẽ sinh
  // 2 cảnh báo cho cùng 1 điểm.
  private async throwNotClaimable(id: string): Promise<never> {
    const rows = await this.dataSource.query<{ status: ReportStatus }[]>(
      `SELECT status FROM hazard_reports WHERE id = $1`,
      [id],
    );
    if (!rows[0]) throw new NotFoundException('Không tìm thấy báo cáo');
    if (rows[0].status !== 'pending') {
      throw new ConflictException('Báo cáo này đã được xử lý trước đó');
    }
    throw new ConflictException(
      'Báo cáo này đã được gộp vào một báo cáo chính khác — hãy duyệt/từ chối báo cáo chính',
    );
  }
}
