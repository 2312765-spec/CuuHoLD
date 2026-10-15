import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { NotificationsService } from './notifications.service';

jest.mock('axios');

const DAY_DU = {
  ESMS_API_KEY: 'api-key',
  ESMS_SECRET_KEY: 'secret-key',
  ESMS_SMS_TYPE: '2',
  ESMS_BRANDNAME: 'CUUHO',
  RESCUE_CENTER_PHONE: '0901234567',
};

function taoService(
  env: Record<string, string | undefined>,
): NotificationsService {
  return new NotificationsService({
    get: (k: string) => env[k],
  } as unknown as ConfigService);
}

const SOS = {
  id: 'sos-123',
  lat: 11.9404,
  lng: 108.4583,
  type: 'medical' as const,
  victimName: 'Nguyen Van A',
  victimPhone: '0912345678',
};

describe('NotificationsService — SMS eSMS', () => {
  // eslint unbound-method: axios.post được jest.mock thay hẳn, không dùng `this`.
  // eslint-disable-next-line @typescript-eslint/unbound-method
  const post = jest.mocked(axios.post);
  type SpyLog = jest.SpyInstance<void, [message: unknown, ...rest: unknown[]]>;
  let log: SpyLog;
  let warn: SpyLog;
  let error: SpyLog;

  beforeEach(() => {
    jest.clearAllMocks();
    log = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    error = jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });
  afterEach(() => jest.restoreAllMocks());

  // Tất cả dòng log trong 1 lần gọi, gộp lại để kiểm có lộ PII không.
  const tatCaLog = (): string =>
    [log, warn, error]
      .flatMap((s) => s.mock.calls.map((c) => String(c[0])))
      .join('\n');

  describe('SMS_DRY_RUN=true (chạy thử)', () => {
    it('KHÔNG gọi eSMS, chỉ ghi log có mã SOS + loại sự cố', async () => {
      const svc = taoService({ ...DAY_DU, SMS_DRY_RUN: 'true' });
      await svc.sendSosSms(SOS);
      expect(post).not.toHaveBeenCalled();
      expect(tatCaLog()).toContain('DRY RUN');
      expect(tatCaLog()).toContain('sos-123');
      expect(tatCaLog()).toContain('medical');
    });

    it('log KHÔNG chứa tên, số điện thoại hay toạ độ nạn nhân', async () => {
      const svc = taoService({ ...DAY_DU, SMS_DRY_RUN: 'true' });
      await svc.sendSosSms(SOS);
      const noiDung = tatCaLog();
      expect(noiDung).not.toContain('Nguyen Van A');
      expect(noiDung).not.toContain('0912345678');
      expect(noiDung).not.toContain('11.9404');
      expect(noiDung).not.toContain('108.4583');
    });

    it('cảnh báo ngay lúc khởi động để không lỡ để quên trên production', () => {
      taoService({ ...DAY_DU, SMS_DRY_RUN: 'true' });
      expect(warn.mock.calls.map((c) => String(c[0])).join('\n')).toContain(
        'SMS_DRY_RUN',
      );
    });

    it('vẫn chạy thử dù thiếu khoá eSMS', async () => {
      const svc = taoService({ SMS_DRY_RUN: 'true' });
      await svc.sendSosSms(SOS);
      expect(post).not.toHaveBeenCalled();
      expect(tatCaLog()).toContain('DRY RUN');
    });
  });

  describe('gửi thật', () => {
    it.each([undefined, '', 'false', 'TRUE ', '1'])(
      'SMS_DRY_RUN=%p → gửi thật qua eSMS (chỉ đúng chuỗi "true" mới bật chạy thử)',
      async (giaTri) => {
        post.mockResolvedValueOnce({ data: { CodeResult: '100', SMSID: 'x' } });
        const svc = taoService({ ...DAY_DU, SMS_DRY_RUN: giaTri });
        await svc.sendSosSms(SOS);
        expect(post).toHaveBeenCalledTimes(1);
        const [, body] = post.mock.calls[0] as [string, Record<string, string>];
        expect(body).toEqual(
          expect.objectContaining({
            ApiKey: 'api-key',
            SecretKey: 'secret-key',
            Phone: '0901234567',
            SmsType: '2',
            Brandname: 'CUUHO',
          }),
        );
        expect(body.Content).toContain('11.9404, 108.4583');
      },
    );

    it('không có SMS_DRY_RUN nào thì không cảnh báo lúc khởi động', () => {
      taoService(DAY_DU);
      expect(warn).not.toHaveBeenCalled();
    });

    it('thiếu ESMS_API_KEY hoặc ESMS_SECRET_KEY → KHÔNG gọi eSMS (tránh gửi khoá rỗng), cảnh báo', async () => {
      for (const thieu of ['ESMS_API_KEY', 'ESMS_SECRET_KEY']) {
        const svc = taoService({ ...DAY_DU, [thieu]: '' });
        await svc.sendSosSms(SOS);
      }
      expect(post).not.toHaveBeenCalled();
      expect(warn).toHaveBeenCalled();
    });

    it('eSMS lỗi mạng → KHÔNG ném lỗi (SMS không được làm hỏng luồng SOS)', async () => {
      post.mockRejectedValueOnce(new Error('ECONNRESET'));
      const svc = taoService(DAY_DU);
      await expect(svc.sendSosSms(SOS)).resolves.toBeUndefined();
      expect(error).toHaveBeenCalled();
    });

    it('eSMS trả mã lỗi (VD 104 sai Brandname) → cảnh báo, không ném lỗi', async () => {
      post.mockResolvedValueOnce({
        data: {
          CodeResult: '104',
          ErrorMessage: 'Brand name code is not exist',
        },
      });
      const svc = taoService(DAY_DU);
      await expect(svc.sendSosSms(SOS)).resolves.toBeUndefined();
      expect(warn).toHaveBeenCalled();
    });
  });
});
