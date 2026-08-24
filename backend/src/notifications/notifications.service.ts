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

  constructor(private config: ConfigService) {}

  async sendSosSms(sos: SosSmsData): Promise<void> {
    const content =
      `[CUU HO LAM DONG] SOS KHAN CAP!\n` +
      `Vi tri: ${sos.lat}, ${sos.lng}\n` +
      `Loai: ${sos.type}\n` +
      `Nan nhan: ${sos.victimName} - ${sos.victimPhone}\n` +
      `Ban do: https://maps.google.com/?q=${sos.lat},${sos.lng}`;

    const payload = {
      ApiKey: this.config.get<string>('ESMS_API_KEY'),
      SecretKey: this.config.get<string>('ESMS_SECRET_KEY'),
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
