import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { SosRequest, SOS_STATUSES } from './sos.entity';
import type { SosStatus, SosType } from './sos.entity';
import { CreateSosDto } from './dto/create-sos.dto';
import { User } from '../users/user.entity';
import { SosGateway } from './sos.gateway';
import { NotificationsService } from '../notifications/notifications.service';
import type { SosNewPayload } from '../common/socket-events.types';

export interface CreateSosResult {
  id: string;
  type: SosType;
  status: SosStatus;
  district_code: string | null;
  created_at: Date;
  cancel_deadline: Date;
}

interface SosListRow {
  id: string;
  type: SosType;
  status: SosStatus;
  district_code: string | null;
  created_at: Date;
  lat: number;
  lng: number;
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
  district_code: string | null;
  false_alarm_count: number;
  cancel_deadline: Date;
  created_at: Date;
  updated_at: Date;
}

@Injectable()
export class SosService {
  constructor(
    @InjectRepository(SosRequest) private sosRepo: Repository<SosRequest>,
    private dataSource: DataSource,
    private sosGateway: SosGateway,
    private notifications: NotificationsService,
  ) {}

  async create(dto: CreateSosDto, victim: User): Promise<CreateSosResult> {
    const cancelDeadline = new Date();
    cancelDeadline.setMinutes(cancelDeadline.getMinutes() + 3);

    // Dùng raw query để lưu geometry PostGIS
    // LƯU Ý: ST_MakePoint(longitude, latitude) — lng TRƯỚC, lat SAU
    const result = await this.dataSource.query<CreateSosResult[]>(
      `
      INSERT INTO sos_requests
        (victim_id, location, type, status, description,
         image_url, district_code, cancel_deadline)
      VALUES ($1, ST_SetSRID(ST_MakePoint($2, $3), 4326),
              $4, 'pending', $5, $6, $7, $8)
      RETURNING id, type, status, district_code, created_at, cancel_deadline
    `,
      [
        victim.id,
        dto.lng,
        dto.lat,
        dto.type,
        dto.description || null,
        dto.imageUrl || null,
        victim.districtCode,
        cancelDeadline,
      ],
    );
    const sos = result[0];

    const payload: SosNewPayload = {
      sosId: sos.id,
      victimId: victim.id,
      victimName: victim.name,
      victimPhone: victim.phone,
      type: sos.type,
      status: sos.status,
      lat: dto.lat,
      lng: dto.lng,
      districtCode: sos.district_code ?? '',
      createdAt: sos.created_at.toISOString(),
      cancelDeadline: sos.cancel_deadline.toISOString(),
    };
    this.sosGateway.emitNewSos(sos.district_code ?? '', payload);

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

  async findAll(user: User, filters: { status?: string } = {}) {
    let q = `SELECT s.id, s.type, s.status, s.district_code, s.created_at,
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
      q += ` AND s.district_code = $${i++}`;
      params.push(user.districtCode);
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

  async cancel(sosId: string, user: User) {
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
    await this.dataSource.query(
      `UPDATE sos_requests SET status='cancelled', updated_at=NOW() WHERE id=$1`,
      [sosId],
    );
    return { sosId, status: 'cancelled', penaltyApplied: !noPenalty };
  }
}
