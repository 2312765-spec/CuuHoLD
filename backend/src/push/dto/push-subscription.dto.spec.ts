import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  PushSubscriptionDto,
  UnsubscribePushDto,
} from './push-subscription.dto';

// Body là nguyên PushSubscription.toJSON() của trình duyệt (frontend pushService.ts).
async function loi<T extends object>(
  cls: new () => T,
  body: Record<string, unknown>,
): Promise<string[]> {
  const errors = await validate(plainToInstance(cls, body));
  return errors.map((e) => e.property);
}

const HOP_LE = {
  endpoint: 'https://fcm.googleapis.com/fcm/send/abc',
  expirationTime: null,
  keys: { p256dh: 'BNcRd...', auth: 'tBHI...' },
};

describe('PushSubscriptionDto', () => {
  it('nhận đúng PushSubscription.toJSON() (expirationTime null hoặc số)', async () => {
    expect(await loi(PushSubscriptionDto, HOP_LE)).toEqual([]);
    expect(
      await loi(PushSubscriptionDto, {
        ...HOP_LE,
        expirationTime: 1700000000000,
      }),
    ).toEqual([]);
  });

  it('endpoint phải là URL https (chặn http, javascript:, chuỗi rác)', async () => {
    for (const endpoint of [
      'http://push.example.com/x',
      'javascript:alert(1)',
      'khong-phai-url',
    ]) {
      expect(await loi(PushSubscriptionDto, { ...HOP_LE, endpoint })).toEqual([
        'endpoint',
      ]);
    }
  });

  it('thiếu keys hoặc thiếu p256dh/auth → lỗi', async () => {
    expect(
      await loi(PushSubscriptionDto, { endpoint: HOP_LE.endpoint }),
    ).toEqual(['keys']);
    expect(
      await loi(PushSubscriptionDto, { ...HOP_LE, keys: { p256dh: 'x' } }),
    ).toEqual(['keys']);
  });
});

describe('UnsubscribePushDto', () => {
  it('cần endpoint https', async () => {
    expect(
      await loi(UnsubscribePushDto, { endpoint: HOP_LE.endpoint }),
    ).toEqual([]);
    expect(await loi(UnsubscribePushDto, {})).toEqual(['endpoint']);
  });
});
