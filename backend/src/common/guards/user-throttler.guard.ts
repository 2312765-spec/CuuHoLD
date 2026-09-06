import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { decode } from 'jsonwebtoken';

interface AccessTokenPayload {
  sub?: string;
}

interface TrackableRequest {
  headers: Record<string, unknown>;
  ip: string;
}

// Throttle theo user.id thay vì IP — "5 SOS/giờ/user" không thể ép bằng IP vì
// nhiều victim có thể chia sẻ NAT/wifi công cộng. Đây là APP_GUARD toàn cục nên
// chạy TRƯỚC JwtAuthGuard (guard toàn cục chạy trước guard cấp controller),
// req.user chưa được Passport gán — phải tự decode JWT lấy `sub` để bucket theo
// user. Chỉ decode (không verify chữ ký): sai lệch tối đa là tự đưa chính mình
// vào nhầm bucket, JwtAuthGuard chạy sau vẫn xác thực token thật trước khi vào
// service — không phải lỗ hổng bảo mật.
@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  protected getTracker(req: TrackableRequest): Promise<string> {
    const { headers, ip } = req;
    const authHeader = headers.authorization;
    if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice('Bearer '.length);
      const payload = decode(token) as AccessTokenPayload | null;
      if (payload?.sub) return Promise.resolve(`user:${payload.sub}`);
    }
    return Promise.resolve(ip);
  }
}
