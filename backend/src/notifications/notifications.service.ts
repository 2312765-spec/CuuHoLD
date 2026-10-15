import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import type { SosType } from '../common/socket-events.types';

interface SosSmsData {
  id: string;
  lat: number;
  lng: number;
  type: SosType;
  victimName: string;
  victimPhone: string;
}

interface EsmsResponse {
  CodeResult: string;
  SMSID?: string;
  ErrorMessage?: string;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly URL =
    'http://rest.esms.vn/MainService.svc/json/SendMultipleMessage_V4_post_json/';

  // SMS_DRY_RUN=true — chạy thử: KHÔNG gọi eSMS (mỗi SOS là 1 tin thật, tốn tiền), chỉ ghi log.
  // Chỉ đúng chuỗi 'true' mới bật; env.validation.ts từ chối giá trị lạ ngay lúc khởi động.
  private readonly chayThu: boolean;

  constructor(private config: ConfigService) {
    this.chayThu = this.config.get<string>('SMS_DRY_RUN') === 'true';
    if (this.chayThu) {
      this.logger.warn(
        'SMS_DRY_RUN=true — KHÔNG gửi SMS thật cho SOS (chỉ ghi log). Tắt trước khi dùng thật.',
      );
    }
  }

  async sendSosSms(sos: SosSmsData): Promise<void> {
    if (this.chayThu) {
      // Chỉ mã SOS + loại sự cố — KHÔNG ghi tên, SĐT, toạ độ nạn nhân vào log.
      this.logger.log(
        `[SMS DRY RUN] Bỏ qua gửi SMS cho SOS ${sos.id} (${sos.type})`,
      );
      return;
    }
    const apiKey = this.config.get<string>('ESMS_API_KEY');
    const secretKey = this.config.get<string>('ESMS_SECRET_KEY');
    if (!apiKey || !secretKey) {
      // Trước đây vẫn gọi eSMS với khoá rỗng rồi nhận lỗi — giờ bỏ qua luôn, nói rõ lý do.
      this.logger.warn(
        `Chưa cấu hình ESMS_API_KEY/ESMS_SECRET_KEY — không gửi SMS cho SOS ${sos.id}`,
      );
      return;
    }

    const content =
      `[CUU HO LAM DONG] SOS KHAN CAP!\n` +
      `Vi tri: ${sos.lat}, ${sos.lng}\n` +
      `Loai: ${sos.type}\n` +
      `Nan nhan: ${sos.victimName} - ${sos.victimPhone}\n` +
      `Ban do: https://maps.google.com/?q=${sos.lat},${sos.lng}`;

    const payload = {
      ApiKey: apiKey,
      SecretKey: secretKey,
      Phone: this.config.get<string>('RESCUE_CENTER_PHONE'),
      Content: content,
      SmsType: this.config.get<string>('ESMS_SMS_TYPE') || '4',
      Brandname: this.config.get<string>('ESMS_BRANDNAME') || '',
      IsUnicode: '0',
    };

    try {
      const res = await axios.post<EsmsResponse>(this.URL, payload, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 5000,
      });
      if (res.data?.CodeResult === '100') {
        this.logger.log(`SMS sent. SMSID: ${res.data.SMSID}`);
      } else {
        this.logger.warn(`SMS failed: ${JSON.stringify(res.data)}`);
      }
    } catch (e: unknown) {
      // KHÔNG throw — lỗi SMS không được làm hỏng flow SOS
      const message = e instanceof Error ? e.message : String(e);
      this.logger.error(`SMS error: ${message}`);
    }
  }
}
