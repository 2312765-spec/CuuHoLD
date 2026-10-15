import { ServiceUnavailableException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { DataSource } from 'typeorm';
import * as webpush from 'web-push';
import { PushService } from './push.service';
import type { PushPayload } from './push.service';

jest.mock('web-push');

const KHOA = {
  VAPID_PUBLIC_KEY: 'BPublicKey',
  VAPID_PRIVATE_KEY: 'privateKey',
  VAPID_SUBJECT: 'mailto:admin@example.com',
};

function cauHinh(giaTri: Record<string, string | undefined>): ConfigService {
  return { get: (k: string) => giaTri[k] } as unknown as ConfigService;
}

const SUB = {
  endpoint: 'https://fcm.googleapis.com/fcm/send/abc',
  expirationTime: null,
  keys: { p256dh: 'p256', auth: 'au' },
};

describe('PushService', () => {
  let dataSource: { query: jest.Mock };
  let service: PushService;
  const send = jest.mocked(webpush.sendNotification);

  beforeEach(() => {
    jest.clearAllMocks();
    dataSource = { query: jest.fn().mockResolvedValue([]) };
    service = new PushService(
      dataSource as unknown as DataSource,
      cauHinh(KHOA),
    );
  });

  describe('cấu hình VAPID', () => {
    it('có đủ khoá → khai báo với web-push và trả khoá công khai', () => {
      expect(webpush.setVapidDetails).toHaveBeenCalledWith(
        'mailto:admin@example.com',
        'BPublicKey',
        'privateKey',
      );
      expect(service.layKhoaCongKhai()).toBe('BPublicKey');
    });

    it('thiếu khoá → 503 khi xin khoá công khai, và KHÔNG gửi/không truy vấn gì khi báo', async () => {
      const chuaCau = new PushService(
        dataSource as unknown as DataSource,
        cauHinh({}),
      );
      expect(() => chuaCau.layKhoaCongKhai()).toThrow(
        ServiceUnavailableException,
      );
      await chuaCau.guiChoNguoiDung(['u1'], {
        title: 't',
        body: 'b',
        url: '/',
        tag: 'x',
      });
      expect(dataSource.query).not.toHaveBeenCalled();
      expect(send).not.toHaveBeenCalled();
    });
  });

  describe('đăng ký / huỷ', () => {
    it('đăng ký: upsert theo endpoint và GÁN LẠI user_id cho người đang đăng nhập', async () => {
      await service.dangKy('u1', SUB);
      const [sql, params] = dataSource.query.mock.calls[0] as [
        string,
        unknown[],
      ];
      expect(sql).toContain('INSERT INTO push_subscriptions');
      expect(sql).toContain('ON CONFLICT (endpoint) DO UPDATE');
      expect(sql).toContain('user_id = EXCLUDED.user_id');
      expect(params).toEqual(['u1', SUB.endpoint, 'p256', 'au']);
    });

    it('huỷ: chỉ xoá đúng endpoint CỦA CHÍNH người gọi', async () => {
      await service.huyDangKy('u1', SUB.endpoint);
      const [sql, params] = dataSource.query.mock.calls[0] as [
        string,
        unknown[],
      ];
      expect(sql).toContain('DELETE FROM push_subscriptions');
      expect(sql).toContain('user_id = $2');
      expect(params).toEqual([SUB.endpoint, 'u1']);
    });
  });

  describe('guiChoNguoiDung', () => {
    const tin = { title: 'T', body: 'B', url: '/map', tag: 'sos-1' };
    const dong = (endpoint: string) => ({ endpoint, p256dh: 'p', auth: 'a' });

    it('gửi tới mọi thiết bị của người nhận, nội dung JSON {title, body, url, tag}', async () => {
      dataSource.query.mockResolvedValueOnce([
        dong('https://push/1'),
        dong('https://push/2'),
      ]);
      send.mockResolvedValue({} as webpush.SendResult);

      await service.guiChoNguoiDung(['u1', 'u2'], tin);

      const [sql, params] = dataSource.query.mock.calls[0] as [
        string,
        unknown[],
      ];
      expect(sql).toContain('user_id = ANY($1)');
      expect(params).toEqual([['u1', 'u2']]);
      expect(send).toHaveBeenCalledTimes(2);
      const [sub, noiDung] = send.mock.calls[0];
      expect(sub).toEqual({
        endpoint: 'https://push/1',
        keys: { p256dh: 'p', auth: 'a' },
      });
      expect(JSON.parse(noiDung as string)).toEqual(tin);
    });

    it('danh sách người nhận rỗng → không truy vấn, không gửi', async () => {
      await service.guiChoNguoiDung([], tin);
      expect(dataSource.query).not.toHaveBeenCalled();
      expect(send).not.toHaveBeenCalled();
    });

    it('thiết bị đã huỷ (410/404) → xoá đăng ký đó khỏi DB, vẫn gửi tiếp các thiết bị khác', async () => {
      dataSource.query
        .mockResolvedValueOnce([
          dong('https://push/het-han'),
          dong('https://push/con'),
        ])
        .mockResolvedValue([]);
      send
        .mockRejectedValueOnce(
          // Hình dạng lỗi web-push ném khi thiết bị đã huỷ: có statusCode 410.
          Object.assign(new Error('Gone'), { statusCode: 410 }),
        )
        .mockResolvedValueOnce({} as webpush.SendResult);

      await service.guiChoNguoiDung(['u1'], tin);

      expect(send).toHaveBeenCalledTimes(2);
      const [sqlXoa, paramsXoa] = dataSource.query.mock.calls[1] as [
        string,
        unknown[],
      ];
      expect(sqlXoa).toContain('DELETE FROM push_subscriptions');
      expect(paramsXoa).toEqual(['https://push/het-han']);
    });

    it('lỗi khác (mạng, 500 từ dịch vụ push, DB lỗi) → KHÔNG ném lỗi ra ngoài, không xoá đăng ký', async () => {
      dataSource.query.mockResolvedValueOnce([dong('https://push/1')]);
      send.mockRejectedValueOnce(new Error('ECONNRESET'));
      await expect(
        service.guiChoNguoiDung(['u1'], tin),
      ).resolves.toBeUndefined();
      expect(dataSource.query).toHaveBeenCalledTimes(1);

      dataSource.query.mockRejectedValueOnce(new Error('DB down'));
      await expect(
        service.guiChoNguoiDung(['u1'], tin),
      ).resolves.toBeUndefined();
    });
  });

  // Ai nhận gì — khớp mô tả ở HoSoView.vue (moTaThongBao) phía frontend.
  describe('chọn người nhận theo sự kiện SOS', () => {
    let gui: jest.SpyInstance<Promise<void>, [string[], PushPayload]>;
    beforeEach(() => {
      gui = jest.spyOn(service, 'guiChoNguoiDung').mockResolvedValue();
    });

    it('SOS mới chưa có đội nhận → mọi commander đang hoạt động, mở /dashboard', async () => {
      dataSource.query.mockResolvedValueOnce([{ id: 'c1' }, { id: 'c2' }]);
      await service.baoSosMoiChuaCoDoi('sos-1', 'flood');
      const [sql] = dataSource.query.mock.calls[0] as [string];
      expect(sql).toContain("role = 'commander'");
      expect(sql).toContain('is_active');
      expect(gui).toHaveBeenCalledWith(
        ['c1', 'c2'],
        expect.objectContaining({ url: '/dashboard', tag: 'sos-sos-1' }),
      );
    });

    it('đội được giao nhiệm vụ → trưởng đội, mở /rescuer', async () => {
      dataSource.query.mockResolvedValueOnce([{ leader_id: 'r1' }]);
      await service.baoDoiDuocGiao('sos-1', 'team-1', 'medical');
      const [sql, params] = dataSource.query.mock.calls[0] as [
        string,
        unknown[],
      ];
      expect(sql).toContain('FROM rescue_teams');
      expect(params).toEqual(['team-1']);
      expect(gui).toHaveBeenCalledWith(
        ['r1'],
        expect.objectContaining({ url: '/rescuer', tag: 'sos-sos-1' }),
      );
    });

    it.each(['assigned', 'arrived', 'resolved'] as const)(
      'nạn nhân nhận khi SOS chuyển sang %s, mở /map',
      async (st) => {
        dataSource.query.mockResolvedValueOnce([{ victim_id: 'v1' }]);
        await service.baoNanNhan('sos-1', st);
        expect(gui).toHaveBeenCalledWith(
          ['v1'],
          expect.objectContaining({ url: '/map', tag: 'sos-sos-1' }),
        );
      },
    );

    it('trạng thái khác (in_progress, cancelled...) → không báo nạn nhân', async () => {
      await service.baoNanNhan('sos-1', 'in_progress');
      await service.baoNanNhan('sos-1', 'cancelled');
      expect(dataSource.query).not.toHaveBeenCalled();
      expect(gui).not.toHaveBeenCalled();
    });

    it('nội dung thông báo KHÔNG chứa tên/SĐT/toạ độ nạn nhân (đi qua dịch vụ push bên thứ 3)', async () => {
      dataSource.query.mockResolvedValueOnce([{ leader_id: 'r1' }]);
      await service.baoDoiDuocGiao('sos-1', 'team-1', 'medical');
      const tin = gui.mock.calls[0][1];
      expect(Object.keys(tin).sort()).toEqual(['body', 'tag', 'title', 'url']);
      expect(JSON.stringify(tin)).not.toMatch(/\d{9,}|\d+\.\d{3,}/);
    });

    it('chưa cấu hình VAPID → không truy vấn người nhận', async () => {
      const chuaCau = new PushService(
        dataSource as unknown as DataSource,
        cauHinh({}),
      );
      await chuaCau.baoSosMoiChuaCoDoi('sos-1', 'flood');
      await chuaCau.baoDoiDuocGiao('sos-1', 'team-1', 'flood');
      await chuaCau.baoNanNhan('sos-1', 'assigned');
      expect(dataSource.query).not.toHaveBeenCalled();
    });
  });
});
