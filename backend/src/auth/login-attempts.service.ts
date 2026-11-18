import { Inject, Injectable, Optional } from '@nestjs/common';

// Chống dò mật khẩu: CHỈ đếm lần đăng nhập SAI, theo cặp (IP, số điện thoại).
// Sai MAX_FAILED lần trong WINDOW_MS → khoá LOCK_MS. Đăng nhập đúng → xoá bộ đếm.
//
// Thay cho giới hạn cũ "5 lần đăng nhập/15 phút/IP" đếm CẢ lần đúng (CLAUDE.md 15.30): test
// nhiều tài khoản trên cùng một máy (chung IP) là hết lượt, nhập sai 1-2 lần đã bị chặn 15 phút.
//
// Lưu trong RAM của tiến trình (giống bộ nhớ mặc định của @nestjs/throttler): khởi động lại
// server là mất bộ đếm, và nếu sau này chạy nhiều instance thì mỗi instance đếm riêng.
// Route login vẫn có @Throttle tổng (mọi lần gọi) làm trần chống spam.
export const MAX_FAILED = 5;
export const WINDOW_MS = 15 * 60_000;
export const LOCK_MS = 15 * 60_000;
const DON_DEP_KHI_VUOT = 5000;

export interface LoginAttemptKey {
  ip: string;
  phone: string;
}

interface Entry {
  failures: number;
  firstFailureAt: number;
  lockedUntil: number;
}

@Injectable()
export class LoginAttemptsService {
  private readonly entries = new Map<string, Entry>();

  // `now` truyền vào được để test không phải chờ thời gian thật. Trong app Nest không có
  // provider cho token này (@Optional → undefined) nên dùng Date.now.
  private readonly now: () => number;

  constructor(@Optional() @Inject('LOGIN_ATTEMPTS_CLOCK') now?: () => number) {
    this.now = now ?? Date.now;
  }

  private key({ ip, phone }: LoginAttemptKey): string {
    return `${ip}|${phone.trim()}`;
  }

  // Bản ghi còn hiệu lực; hết hạn (khoá xong / cửa sổ đếm qua) thì xoá và trả undefined.
  private current(k: string): Entry | undefined {
    const e = this.entries.get(k);
    if (!e) return undefined;
    const t = this.now();
    const hetKhoa = e.lockedUntil > 0 && t >= e.lockedUntil;
    const hetCuaSo = e.lockedUntil === 0 && t - e.firstFailureAt >= WINDOW_MS;
    if (hetKhoa || hetCuaSo) {
      this.entries.delete(k);
      return undefined;
    }
    return e;
  }

  lockedForMs(key: LoginAttemptKey): number {
    const e = this.current(this.key(key));
    return e && e.lockedUntil > 0 ? e.lockedUntil - this.now() : 0;
  }

  remainingAttempts(key: LoginAttemptKey): number {
    const e = this.current(this.key(key));
    return MAX_FAILED - (e?.failures ?? 0);
  }

  recordFailure(key: LoginAttemptKey): void {
    const k = this.key(key);
    const t = this.now();
    const e = this.current(k) ?? {
      failures: 0,
      firstFailureAt: t,
      lockedUntil: 0,
    };
    e.failures += 1;
    if (e.failures >= MAX_FAILED) e.lockedUntil = t + LOCK_MS;
    this.entries.set(k, e);
    this.donDep();
  }

  recordSuccess(key: LoginAttemptKey): void {
    this.entries.delete(this.key(key));
  }

  // Không để Map phình mãi khi bị dò từ nhiều IP/số khác nhau.
  private donDep(): void {
    if (this.entries.size <= DON_DEP_KHI_VUOT) return;
    for (const k of [...this.entries.keys()]) this.current(k);
  }
}
