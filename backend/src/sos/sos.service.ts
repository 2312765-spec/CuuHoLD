import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { SosRequest, SOS_STATUSES, SOS_TERMINAL_STATUSES } from './sos.entity';
import type { SosStatus, SosType } from './sos.entity';
import { CreateSosDto } from './dto/create-sos.dto';
import { User } from '../users/user.entity';
import { SosGateway } from './sos.gateway';
import { NotificationsService } from '../notifications/notifications.service';
import { GisService } from '../gis/gis.service';
import type {
  SosNewPayload,
  SosUpdatedPayload,
} from '../common/socket-events.types';
import type { RescueTeamStatus } from '../rescue-teams/rescue-team.entity';

// assigned → in_progress → arrived → resolved — thứ tự chuyển trạng thái duy nhất hợp lệ
const SOS_STATUS_TRANSITIONS: Partial<Record<SosStatus, SosStatus>> = {
  assigned: 'in_progress',
  in_progress: 'arrived',
  arrived: 'resolved',
};

// CLAUDE.md Mục 10 bước 4: "GisService.findNearestTeams() → auto-assign team đầu tiên" —
// bán kính tìm đội tự động lúc tạo SOS. Không tìm thấy đội nào trong bán kính này thì SOS
// giữ nguyên 'pending', đúng luồng cũ (commander phân công tay qua PATCH /:id/assign).
const AUTO_ASSIGN_RADIUS_M = 10000;

// Dùng chung cho findById() và findMyActive() — cùng shape cột, chỉ khác WHERE.
const SOS_DETAIL_SELECT = `
  SELECT s.id, s.victim_id, s.type, s.status, s.description, s.image_url,
         s.ward_code, s.false_alarm_count, s.cancel_deadline, s.location_estimated,
         s.created_at, s.updated_at, s.resolved_at, s.assigned_team_id,
         ST_Y(s.location::geometry) AS lat,
         ST_X(s.location::geometry) AS lng,
         u.name AS victim_name, u.phone AS victim_phone,
         rt.name AS team_name, rt.status AS team_status
  FROM sos_requests s
  JOIN users u ON u.id = s.victim_id
  LEFT JOIN rescue_teams rt ON rt.id = s.assigned_team_id
`;

export interface CreateSosResult {
  id: string;
  type: SosType;
  status: SosStatus;
  ward_code: string | null;
  created_at: Date;
  cancel_deadline: Date;
  location_estimated: boolean;
}

export interface SosListRow {
  id: string;
  type: SosType;
  status: SosStatus;
  ward_code: string | null;
  created_at: Date;
  lat: number;
  lng: number;
  location_estimated: boolean;
  victim_name: string;
  victim_phone: string;
}

interface SosRequestRow {
  id: string;
  victim_id: string;
  type: SosType;
  status: SosStatus;
  description: string | null;
  image_url: string | null;
  assigned_team_id: string | null;
  ward_code: string | null;
  false_alarm_count: number;
  cancel_deadline: Date;
  created_at: Date;
  updated_at: Date;
}

interface SosDetailRow {
  id: string;
  victim_id: string;
  type: SosType;
  status: SosStatus;
  description: string | null;
  image_url: string | null;
  ward_code: string | null;
  false_alarm_count: number;
  cancel_deadline: Date;
  location_estimated: boolean;
  created_at: Date;
  updated_at: Date;
  resolved_at: Date | null;
  lat: number;
  lng: number;
  assigned_team_id: string | null;
  team_name: string | null;
  team_status: RescueTeamStatus | null;
  victim_name: string;
  victim_phone: string;
}

interface SosTimelineRow {
  id: string;
  actor_id: string;
  action: string;
  note: string | null;
  created_at: Date;
}

export interface SosDetailResult extends SosDetailRow {
  timeline: SosTimelineRow[];
}

interface SosStatusRow {
  status: SosStatus;
  ward_code: string | null;
  assigned_team_id: string | null;
}

interface RescueTeamStatusRow {
  status: RescueTeamStatus;
}

export interface AssignSosResult {
  sosId: string;
  teamId: string;
  status: SosStatus;
  wardCode: string | null;
  updatedAt: string;
}

export interface UpdateSosStatusResult {
  sosId: string;
  status: SosStatus;
  updatedAt: string;
}

export interface CancelSosResult {
  sosId: string;
  status: 'cancelled';
  penaltyApplied: boolean;
  accountFlagged: boolean;
}

const LATE_CANCEL_FLAG_THRESHOLD = 3;

@Injectable()
export class SosService {
  constructor(
    @InjectRepository(SosRequest) private sosRepo: Repository<SosRequest>,
    private dataSource: DataSource,
    private sosGateway: SosGateway,
    private notifications: NotificationsService,
    private gisService: GisService,
  ) {}

  async create(dto: CreateSosDto, victim: User): Promise<CreateSosResult> {
    // SRS F-SOS-01: "Chỉ 1 SOS active cùng lúc/user". Trước đây KHÔNG được enforce —
    // giới hạn duy nhất là rate limit 5 SOS/giờ, nên victim bấm nút 2 lần (hoảng loạn,
    // hoặc tay run) là tạo ra 2 bản ghi: 2 đội có thể bị điều tới cùng một người, và
    // thẻ theo dõi phía victim chỉ bám được 1 cái, cái còn lại treo vô chủ.
    //
    // ⚠️ Đây là phép chặn ở tầng ứng dụng nên VẪN CÒN khe hở đua (race): 2 request gửi
    // đúng cùng lúc có thể cùng qua được phép kiểm này rồi cùng INSERT. Bịt kín phải dùng
    // unique partial index dưới DB (`WHERE status NOT IN (...)`) — cần chạy migration tay
    // trên Supabase, chưa làm. Với rate limit 5/giờ sẵn có thì khe hở này rất hẹp, nhưng
    // ghi rõ ra để người sau biết đây không phải bảo đảm tuyệt đối.
    const dangHoatDong = await this.dataSource.query<{ id: string }[]>(
      `SELECT id FROM sos_requests
       WHERE victim_id = $1 AND NOT (status = ANY($2))
       LIMIT 1`,
      [victim.id, SOS_TERMINAL_STATUSES],
    );
    if (dangHoatDong[0]) {
      throw new ConflictException(
        'Bạn đang có một yêu cầu cứu trợ chưa kết thúc. Hãy theo dõi hoặc huỷ yêu cầu đó trước khi gửi yêu cầu mới.',
      );
    }

    const cancelDeadline = new Date();
    cancelDeadline.setMinutes(cancelDeadline.getMinutes() + 3);

    // Dùng raw query để lưu geometry PostGIS
    // LƯU Ý: ST_MakePoint(longitude, latitude) — lng TRƯỚC, lat SAU
    // ward_code KHÔNG truyền thủ công — trigger trg_sos_set_ward tự suy ra
    // từ location qua ST_Contains (xem gis/03-migrate-existing-tables.sql),
    // tin tọa độ GPS thật thay vì districtCode/wardCode client tự khai.
    const result = await this.dataSource.query<CreateSosResult[]>(
      `
      INSERT INTO sos_requests
        (victim_id, location, type, status, description,
         image_url, cancel_deadline, location_estimated)
      VALUES ($1, ST_SetSRID(ST_MakePoint($2, $3), 4326),
              $4, 'pending', $5, $6, $7, $8)
      RETURNING id, type, status, ward_code, created_at, cancel_deadline, location_estimated
    `,
      [
        victim.id,
        dto.lng,
        dto.lat,
        dto.type,
        dto.description || null,
        dto.imageUrl || null,
        cancelDeadline,
        dto.locationEstimated ?? false,
      ],
    );
    const sos = result[0];

    // CLAUDE.md Mục 10 bước 4: tự động phân công đội gần nhất NGAY lúc tạo, thay vì luôn
    // để 'pending' chờ commander bấm tay — trước đây đây là khoảng lệch giữa spec và code
    // thật (xem CLAUDE.md Mục 15.6). Không tìm thấy đội nào sẵn sàng trong bán kính thì
    // giữ nguyên 'pending', y hệt hành vi cũ (commander vẫn phân công tay được qua
    // PATCH /:id/assign — endpoint đó không đổi).
    const assignedTeamId = await this.tryAutoAssignNearestTeam(
      sos.id,
      dto.lat,
      dto.lng,
      victim,
    );
    if (assignedTeamId) sos.status = 'assigned';

    const payload: SosNewPayload = {
      sosId: sos.id,
      victimId: victim.id,
      victimName: victim.name,
      victimPhone: victim.phone,
      type: sos.type,
      status: sos.status,
      lat: dto.lat,
      lng: dto.lng,
      locationEstimated: sos.location_estimated,
      wardCode: sos.ward_code ?? '',
      createdAt: sos.created_at.toISOString(),
      cancelDeadline: sos.cancel_deadline.toISOString(),
    };
    this.sosGateway.emitNewSos(sos.ward_code ?? '', payload);

    // Rescuer đội được auto-assign lắng nghe 'sos:updated' (đúng event RescuerView.vue đã
    // dùng cho trường hợp commander phân công tay) để thêm nhiệm vụ mới vào danh sách —
    // tái dùng nguyên payload/route lắng nghe sẵn có, không cần sửa gì ở frontend.
    if (assignedTeamId) {
      this.sosGateway.emitSosUpdated(sos.id, sos.ward_code ?? '', {
        sosId: sos.id,
        status: 'assigned',
        wardCode: sos.ward_code ?? '',
        assignedTeamId,
        updatedAt: new Date().toISOString(),
      });
    }

    // await để đảm bảo lời gọi SMS thực sự chạy trước khi request kết thúc,
    // nhưng NotificationsService tự nuốt lỗi (không throw) nên không block response 201.
    await this.notifications.sendSosSms({
      id: sos.id,
      lat: dto.lat,
      lng: dto.lng,
      type: sos.type,
      victimName: victim.name,
      victimPhone: victim.phone,
    });

    return sos;
  }

  // Trả về id đội vừa được gán, hoặc null nếu không có đội nào sẵn sàng trong bán kính —
  // SOS giữ nguyên 'pending' trong trường hợp đó (đúng luồng cũ, commander phân công tay).
  private async tryAutoAssignNearestTeam(
    sosId: string,
    lat: number,
    lng: number,
    victim: User,
  ): Promise<string | null> {
    const [nearest] = await this.gisService.findNearestTeams(
      lat,
      lng,
      AUTO_ASSIGN_RADIUS_M,
      1,
    );
    if (!nearest) return null;

    await this.dataSource.query(
      `UPDATE sos_requests SET assigned_team_id=$2, status='assigned', updated_at=NOW() WHERE id=$1`,
      [sosId, nearest.id],
    );
    await this.dataSource.query(
      `UPDATE rescue_teams SET status='busy', updated_at=NOW() WHERE id=$1`,
      [nearest.id],
    );
    // actor_id gán cho chính victim — không có "commander" nào thao tác ở bước tự động
    // này, nhưng actor_id tham chiếu users.id nên không gán được giá trị hệ thống/null;
    // note phân biệt rõ đây là hành động tự động, không phải victim tự bấm.
    await this.dataSource.query(
      `INSERT INTO sos_timeline (sos_id, actor_id, action, note) VALUES ($1, $2, 'assigned', $3)`,
      [sosId, victim.id, `Tự động phân công đội gần nhất: ${nearest.name}`],
    );

    return nearest.id;
  }

  async findAll(
    user: User,
    filters: { status?: string } = {},
  ): Promise<SosListRow[]> {
    let q = `SELECT s.id, s.type, s.status, s.ward_code, s.created_at, s.location_estimated,
             ST_Y(s.location::geometry) AS lat,
             ST_X(s.location::geometry) AS lng,
             u.name AS victim_name, u.phone AS victim_phone
             FROM sos_requests s JOIN users u ON u.id = s.victim_id WHERE 1=1`;
    const params: unknown[] = [];
    let i = 1;
    if (user.role === 'victim') {
      q += ` AND s.victim_id = $${i++}`;
      params.push(user.id);
    }
    if (user.role === 'rescuer') {
      q += ` AND s.ward_code = $${i++}`;
      params.push(user.wardCode);
    }
    if (filters.status) {
      const statuses = filters.status
        .split(',')
        .filter((s): s is (typeof SOS_STATUSES)[number] =>
          (SOS_STATUSES as readonly string[]).includes(s),
        );
      if (statuses.length) {
        q += ` AND s.status = ANY($${i++}::text[])`;
        params.push(statuses);
      }
    }
    q += ' ORDER BY s.created_at DESC LIMIT 50';
    return this.dataSource.query<SosListRow[]>(q, params);
  }

  async cancel(sosId: string, user: User): Promise<CancelSosResult> {
    const rows = await this.dataSource.query<SosRequestRow[]>(
      `SELECT * FROM sos_requests WHERE id = $1`,
      [sosId],
    );
    if (!rows[0]) throw new NotFoundException('Không tìm thấy SOS');
    if (rows[0].victim_id !== user.id)
      throw new ForbiddenException('Không có quyền');
    if (['resolved', 'cancelled', 'false_alarm'].includes(rows[0].status))
      throw new BadRequestException('SOS đã kết thúc');
    const noPenalty = new Date() < new Date(rows[0].cancel_deadline);
    const penaltyApplied = !noPenalty;

    await this.dataSource.query(
      `UPDATE sos_requests SET status='cancelled', updated_at=NOW()${
        penaltyApplied ? ', false_alarm_count = false_alarm_count + 1' : ''
      } WHERE id=$1`,
      [sosId],
    );

    // Nếu SOS đã được phân công đội (auto-assign lúc tạo hoặc commander phân công tay)
    // trước khi bị huỷ, phải giải phóng đội về 'available' — nếu không đội bị kẹt 'busy'
    // vĩnh viễn dù không còn nhiệm vụ nào đang hoạt động (cùng quy tắc với updateStatus()
    // khi SOS chuyển 'resolved', chỉ khác điểm kích hoạt).
    if (rows[0].assigned_team_id) {
      await this.dataSource.query(
        `UPDATE rescue_teams SET status='available', updated_at=NOW() WHERE id=$1`,
        [rows[0].assigned_team_id],
      );
    }

    // Quy tắc Mục 10: huỷ trễ (sau cancel_deadline) 3 lần → tài khoản bị flag.
    // Không chặn login/gửi SOS khi bị flag — đây là app cứu hộ, chặn tín hiệu
    // khẩn cấp vì lịch sử huỷ trễ rủi ro hơn nhiều so với vài lần báo giả.
    // Flag chỉ để hiện cảnh báo cho victim + hiển thị cho commander.
    let accountFlagged = user.isFlagged;
    if (penaltyApplied) {
      const updated = await this.dataSource.query<
        { late_cancel_count: number; is_flagged: boolean }[]
      >(
        `UPDATE users SET late_cancel_count = late_cancel_count + 1,
           is_flagged = (late_cancel_count + 1) >= $2, updated_at = NOW()
         WHERE id = $1
         RETURNING late_cancel_count, is_flagged`,
        [user.id, LATE_CANCEL_FLAG_THRESHOLD],
      );
      accountFlagged = updated[0].is_flagged;
    }

    return { sosId, status: 'cancelled', penaltyApplied, accountFlagged };
  }

  async findById(sosId: string, user: User): Promise<SosDetailResult> {
    const rows = await this.dataSource.query<SosDetailRow[]>(
      `${SOS_DETAIL_SELECT} WHERE s.id = $1`,
      [sosId],
    );
    const sos = rows[0];
    if (!sos) throw new NotFoundException('Không tìm thấy SOS');
    if (user.role === 'victim' && sos.victim_id !== user.id) {
      throw new ForbiddenException('Không có quyền');
    }
    if (user.role === 'rescuer' && sos.ward_code !== user.wardCode) {
      throw new ForbiddenException('Không có quyền');
    }

    return this.attachTimeline(sos);
  }

  // SOS đang hoạt động (chưa resolved/cancelled/false_alarm) của chính victim đang gọi —
  // dùng để frontend khôi phục marker/thẻ theo dõi sau khi F5 mất hết state trong RAM
  // (trước đây không có cách nào hỏi lại vì GET /api/sos bị chặn với role victim, và
  // GET /api/sos/:id cần biết trước id — đúng cái bị mất lúc reload).
  async findMyActive(victim: User): Promise<SosDetailResult | null> {
    const rows = await this.dataSource.query<SosDetailRow[]>(
      `${SOS_DETAIL_SELECT}
       WHERE s.victim_id = $1
         AND NOT (s.status = ANY($2))
       ORDER BY s.created_at DESC
       LIMIT 1`,
      [victim.id, SOS_TERMINAL_STATUSES],
    );
    const sos = rows[0];
    if (!sos) return null;
    return this.attachTimeline(sos);
  }

  private async attachTimeline(sos: SosDetailRow): Promise<SosDetailResult> {
    const timeline = await this.dataSource.query<SosTimelineRow[]>(
      `SELECT id, actor_id, action, note, created_at
       FROM sos_timeline WHERE sos_id = $1 ORDER BY created_at ASC`,
      [sos.id],
    );
    return { ...sos, timeline };
  }

  async assign(
    sosId: string,
    teamId: string,
    commander: User,
  ): Promise<AssignSosResult> {
    const sosRows = await this.dataSource.query<SosStatusRow[]>(
      `SELECT status, ward_code, assigned_team_id FROM sos_requests WHERE id = $1`,
      [sosId],
    );
    if (!sosRows[0]) throw new NotFoundException('Không tìm thấy SOS');
    if (sosRows[0].status !== 'pending') {
      throw new BadRequestException('SOS không ở trạng thái chờ phân công');
    }

    const teamRows = await this.dataSource.query<RescueTeamStatusRow[]>(
      `SELECT status FROM rescue_teams WHERE id = $1`,
      [teamId],
    );
    if (!teamRows[0]) throw new NotFoundException('Không tìm thấy đội cứu hộ');
    if (teamRows[0].status !== 'available') {
      throw new BadRequestException('Đội cứu hộ hiện không sẵn sàng');
    }

    const updated = await this.dataSource.query<{ updated_at: Date }[]>(
      `UPDATE sos_requests SET assigned_team_id=$2, status='assigned', updated_at=NOW()
       WHERE id=$1 RETURNING updated_at`,
      [sosId, teamId],
    );
    await this.dataSource.query(
      `UPDATE rescue_teams SET status='busy', updated_at=NOW() WHERE id=$1`,
      [teamId],
    );
    await this.dataSource.query(
      `INSERT INTO sos_timeline (sos_id, actor_id, action, note) VALUES ($1, $2, 'assigned', $3)`,
      [sosId, commander.id, null],
    );

    const updatedAt = updated[0].updated_at.toISOString();
    const payload: SosUpdatedPayload = {
      sosId,
      status: 'assigned',
      wardCode: sosRows[0].ward_code ?? '',
      assignedTeamId: teamId,
      updatedAt,
    };
    this.sosGateway.emitSosUpdated(sosId, sosRows[0].ward_code ?? '', payload);

    return {
      sosId,
      teamId,
      status: 'assigned',
      wardCode: sosRows[0].ward_code,
      updatedAt,
    };
  }

  async updateStatus(
    sosId: string,
    newStatus: SosStatus,
    note: string | null,
    rescuer: User,
  ): Promise<UpdateSosStatusResult> {
    const sosRows = await this.dataSource.query<SosStatusRow[]>(
      `SELECT status, ward_code, assigned_team_id FROM sos_requests WHERE id = $1`,
      [sosId],
    );
    const sos = sosRows[0];
    if (!sos) throw new NotFoundException('Không tìm thấy SOS');

    if (!sos.assigned_team_id) {
      throw new ForbiddenException('SOS chưa được phân công đội cứu hộ');
    }
    const ownershipRows = await this.dataSource.query<{ id: string }[]>(
      `SELECT id FROM rescue_teams WHERE id = $1 AND leader_id = $2`,
      [sos.assigned_team_id, rescuer.id],
    );
    if (!ownershipRows[0]) {
      throw new ForbiddenException('Không có quyền cập nhật SOS này');
    }

    if (SOS_STATUS_TRANSITIONS[sos.status] !== newStatus) {
      throw new BadRequestException(
        `Không thể chuyển trạng thái từ '${sos.status}' sang '${newStatus}'`,
      );
    }

    const updated = await this.dataSource.query<{ updated_at: Date }[]>(
      `UPDATE sos_requests SET status=$2, updated_at=NOW()${
        newStatus === 'resolved' ? ', resolved_at=NOW()' : ''
      } WHERE id=$1 RETURNING updated_at`,
      [sosId, newStatus],
    );

    if (newStatus === 'resolved') {
      await this.dataSource.query(
        `UPDATE rescue_teams SET status='available', updated_at=NOW() WHERE id=$1`,
        [sos.assigned_team_id],
      );
    }

    await this.dataSource.query(
      `INSERT INTO sos_timeline (sos_id, actor_id, action, note) VALUES ($1, $2, $3, $4)`,
      [sosId, rescuer.id, newStatus, note],
    );

    const updatedAt = updated[0].updated_at.toISOString();
    const payload: SosUpdatedPayload = {
      sosId,
      status: newStatus,
      wardCode: sos.ward_code ?? '',
      assignedTeamId: sos.assigned_team_id,
      updatedAt,
    };
    this.sosGateway.emitSosUpdated(sosId, sos.ward_code ?? '', payload);

    return { sosId, status: newStatus, updatedAt };
  }
}
