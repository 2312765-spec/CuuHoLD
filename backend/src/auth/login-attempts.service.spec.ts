import { LoginAttemptsService } from './login-attempts.service';

describe('LoginAttemptsService', () => {
  let now: number;
  let service: LoginAttemptsService;
  const KEY = { ip: '1.2.3.4', phone: '0901234567' };

  beforeEach(() => {
    now = Date.UTC(2026, 10, 18, 12, 0, 0);
    service = new LoginAttemptsService(() => now);
  });

  it('chưa sai lần nào → không bị khoá, còn đủ 5 lượt', () => {
    expect(service.lockedForMs(KEY)).toBe(0);
    expect(service.remainingAttempts(KEY)).toBe(5);
  });

  it('sai 4 lần → chưa khoá, còn 1 lượt; sai lần 5 → khoá 15 phút', () => {
    for (let i = 0; i < 4; i++) service.recordFailure(KEY);
    expect(service.lockedForMs(KEY)).toBe(0);
    expect(service.remainingAttempts(KEY)).toBe(1);
    service.recordFailure(KEY);
    expect(service.lockedForMs(KEY)).toBe(15 * 60_000);
  });

  it('hết 15 phút khoá → được thử lại, bộ đếm về 0', () => {
    for (let i = 0; i < 5; i++) service.recordFailure(KEY);
    now += 15 * 60_000;
    expect(service.lockedForMs(KEY)).toBe(0);
    expect(service.remainingAttempts(KEY)).toBe(5);
  });

  it('đăng nhập đúng → xoá bộ đếm (lần đúng KHÔNG bị tính như trước)', () => {
    for (let i = 0; i < 4; i++) service.recordFailure(KEY);
    service.recordSuccess(KEY);
    expect(service.remainingAttempts(KEY)).toBe(5);
  });

  it('các lần sai cách nhau quá 15 phút không cộng dồn', () => {
    for (let i = 0; i < 4; i++) service.recordFailure(KEY);
    now += 16 * 60_000;
    service.recordFailure(KEY);
    expect(service.lockedForMs(KEY)).toBe(0);
    expect(service.remainingAttempts(KEY)).toBe(4);
  });

  it('đếm riêng từng số điện thoại và từng IP', () => {
    for (let i = 0; i < 5; i++) service.recordFailure(KEY);
    expect(service.lockedForMs({ ...KEY, phone: '0909999999' })).toBe(0);
    expect(service.lockedForMs({ ...KEY, ip: '5.6.7.8' })).toBe(0);
  });

  it('số điện thoại có khoảng trắng vẫn tính là cùng một số', () => {
    for (let i = 0; i < 5; i++)
      service.recordFailure({ ...KEY, phone: ` ${KEY.phone} ` });
    expect(service.lockedForMs(KEY)).toBeGreaterThan(0);
  });
});
