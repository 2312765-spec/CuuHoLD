import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import * as webpush from 'web-push';
import type { SosStatus, SosType } from '../sos/sos.entity';
import type { PushSubscriptionDto } from './dto/push-subscription.dto';

// F-PWA-05 — Web Push (CLAUDE.md Mục 15.22). Gửi qua dịch vụ push của trình duyệt (FCM, Mozilla,
// Apple...) bằng thư viện web-push + khoá VAPID trong .env.
//
// Nguyên tắc giống SMS (NotificationsService): push chỉ là kênh BÁO THÊM, KHÔNG BAO GIỜ được làm
// hỏng hay làm chậm luồng cứu hộ — mọi hàm bao* / guiChoNguoiDung tự nuốt lỗi, không ném ra.
// Thiếu khoá VAPID → bỏ qua im lặng (server vẫn khởi động bình thường), riêng GET khoá công khai
// trả 503 để frontend báo "chưa bật được".

// Nội dung đúng định dạng public/push-sw.js phía frontend đọc: { title, body, url, tag }.
// ⚠️ Đi qua máy chủ của bên thứ 3 (dù được mã hoá đầu-cuối) và hiện trên màn hình khoá — KHÔNG
// đưa tên, số điện thoại hay toạ độ nạn nhân vào đây; mở app mới xem chi tiết (đã kiểm quyền).
export interface PushPayload {
  title: string;
  body: string;
  url: string;
  tag: string;
}

interface DongDangKy {
  endpoint: string;
  p256dh: string;
  auth: string;
}

const NHAN_LOAI: Record<SosType, string> = {
  flood: 'Lũ lụt',
  landslide: 'Sạt lở',
  accident: 'Tai nạn',
  medical: 'Y tế',
  fire: 'Hoả hoạn',
  lost: 'Lạc đường',
  drowning: 'Đuối nước',
  agricultural: 'Nông nghiệp',
  adventure: 'Mạo hiểm',
  other: 'Khác',
};

// Chỉ 3 trạng thái báo cho nạn nhân (khớp mô tả ở HoSoView.vue phía frontend).
const TIN_NAN_NHAN: Partial<
  Record<SosStatus, Pick<PushPayload, 'title' | 'body'>>
> = {
  assigned: {
    title: 'Đã có đội cứu hộ nhận yêu cầu',
    body: 'Đội cứu hộ đang chuẩn bị tới. Mở ứng dụng để theo dõi.',
  },
  arrived: {
    title: 'Đội cứu hộ đã tới nơi',
    body: 'Đội cứu hộ đã tới vị trí bạn báo.',
  },
  resolved: {
    title: 'Yêu cầu cứu hộ đã hoàn tất',
    body: 'Cảm ơn bạn. Yêu cầu SOS đã được đóng.',
  },
};

// Dịch vụ push trả 404/410 khi thiết bị đã huỷ đăng ký/hết hạn → xoá khỏi DB cho khỏi gửi mãi.
const MA_HET_HAN = new Set([404, 410]);

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private readonly khoaCongKhai: string | null;

  constructor(
    private readonly dataSource: DataSource,
    config: ConfigService,
  ) {
    const pub = config.get<string>('VAPID_PUBLIC_KEY');
    const priv = config.get<string>('VAPID_PRIVATE_KEY');
    const subject =
      config.get<string>('VAPID_SUBJECT') || 'mailto:admin@example.com';
    if (pub && priv) {
      webpush.setVapidDetails(subject, pub, priv);
      this.khoaCongKhai = pub;
    } else {
      this.khoaCongKhai = null;
      this.logger.warn(
        'Chưa cấu hình VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY — tắt thông báo đẩy',
      );
    }
  }

  layKhoaCongKhai(): string {
    if (!this.khoaCongKhai) {
      throw new ServiceUnavailableException('Máy chủ chưa bật thông báo đẩy');
    }
    return this.khoaCongKhai;
  }

  // Upsert theo endpoint và GÁN LẠI user_id: 1 máy đăng xuất rồi người khác đăng nhập bật thông
  // báo → endpoint chuyển sang người mới, người trước không còn nhận tin trên máy đó.
  async dangKy(userId: string, sub: PushSubscriptionDto): Promise<void> {
    await this.dataSource.query(
      `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (endpoint) DO UPDATE
         SET user_id = EXCLUDED.user_id, p256dh = EXCLUDED.p256dh,
             auth = EXCLUDED.auth, updated_at = NOW()`,
      [userId, sub.endpoint, sub.keys.p256dh, sub.keys.auth],
    );
  }

  // Chỉ xoá endpoint của CHÍNH người gọi — không cho huỷ đăng ký của người khác.
  async huyDangKy(userId: string, endpoint: string): Promise<void> {
    await this.dataSource.query(
      `DELETE FROM push_subscriptions WHERE endpoint = $1 AND user_id = $2`,
      [endpoint, userId],
    );
  }

  async guiChoNguoiDung(userIds: string[], tin: PushPayload): Promise<void> {
    if (!this.khoaCongKhai || userIds.length === 0) return;
    try {
      const ds = await this.dataSource.query<DongDangKy[]>(
        `SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ANY($1)`,
        [userIds],
      );
      const noiDung = JSON.stringify(tin);
      await Promise.all(ds.map((d) => this.guiMotThietBi(d, noiDung)));
    } catch (err) {
      this.logger.error(`Gửi thông báo đẩy lỗi: ${(err as Error).message}`);
    }
  }

  async baoSosMoiChuaCoDoi(sosId: string, type: SosType): Promise<void> {
    if (!this.khoaCongKhai) return;
    try {
      const ds = await this.dataSource.query<{ id: string }[]>(
        `SELECT id FROM users WHERE role = 'commander' AND is_active = true`,
      );
      await this.guiChoNguoiDung(
        ds.map((d) => d.id),
        {
          title: 'SOS mới chưa có đội nhận',
          body: `${NHAN_LOAI[type]} — cần phân công đội cứu hộ.`,
          url: '/dashboard',
          tag: `sos-${sosId}`,
        },
      );
    } catch (err) {
      this.logger.error(`Báo commander lỗi: ${(err as Error).message}`);
    }
  }

  async baoDoiDuocGiao(
    sosId: string,
    teamId: string,
    type: SosType,
  ): Promise<void> {
    if (!this.khoaCongKhai) return;
    try {
      const ds = await this.dataSource.query<{ leader_id: string | null }[]>(
        `SELECT leader_id FROM rescue_teams WHERE id = $1`,
        [teamId],
      );
      const leader = ds[0]?.leader_id;
      if (!leader) return;
      await this.guiChoNguoiDung([leader], {
        title: 'Nhiệm vụ cứu hộ mới',
        body: `${NHAN_LOAI[type]} — mở ứng dụng để xem vị trí và dẫn đường.`,
        url: '/rescuer',
        tag: `sos-${sosId}`,
      });
    } catch (err) {
      this.logger.error(`Báo trưởng đội lỗi: ${(err as Error).message}`);
    }
  }

  async baoNanNhan(sosId: string, status: SosStatus): Promise<void> {
    const tin = TIN_NAN_NHAN[status];
    if (!this.khoaCongKhai || !tin) return;
    try {
      const ds = await this.dataSource.query<{ victim_id: string }[]>(
        `SELECT victim_id FROM sos_requests WHERE id = $1`,
        [sosId],
      );
      if (!ds[0]) return;
      await this.guiChoNguoiDung([ds[0].victim_id], {
        ...tin,
        url: '/map',
        tag: `sos-${sosId}`,
      });
    } catch (err) {
      this.logger.error(`Báo nạn nhân lỗi: ${(err as Error).message}`);
    }
  }

  private async guiMotThietBi(d: DongDangKy, noiDung: string): Promise<void> {
    try {
      // TTL 1 giờ: máy đang tắt quá lâu thì tin cứu hộ đã cũ, không cần giữ. urgency 'high'
      // để Android không gom/hoãn thông báo khi máy ở chế độ tiết kiệm pin.
      await webpush.sendNotification(
        { endpoint: d.endpoint, keys: { p256dh: d.p256dh, auth: d.auth } },
        noiDung,
        { TTL: 3600, urgency: 'high' },
      );
    } catch (err) {
      // Đọc statusCode trực tiếp (web-push ném WebPushError có field này) thay vì instanceof —
      // không phụ thuộc lớp lỗi cụ thể của thư viện.
      const ma = (err as { statusCode?: unknown }).statusCode;
      if (typeof ma === 'number' && MA_HET_HAN.has(ma)) {
        await this.dataSource.query(
          `DELETE FROM push_subscriptions WHERE endpoint = $1`,
          [d.endpoint],
        );
        return;
      }
      // Không ghi endpoint ra log (định danh thiết bị của người dùng).
      this.logger.warn(`Gửi push 1 thiết bị lỗi: ${(err as Error).message}`);
    }
  }
}
