import { NestExpressApplication } from '@nestjs/platform-express';

// Số tầng proxy đứng trước app (Render = 1). Express lấy req.ip từ X-Forwarded-For, đếm từ
// PHẢI sang đúng `hops` tầng — giá trị client tự chèn phía trước bị bỏ qua, không giả IP được.
// 0 = không tin header (chạy thẳng trên máy dev, không có proxy). Đặt sai số tầng thì
// UserThrottlerGuard bucket nhầm IP — kiểm lại sau mỗi lần đổi hạ tầng (docs/HOSTING.md).
export function cauHinhTrustProxy(
  app: NestExpressApplication,
  hops: number,
): void {
  app.set('trust proxy', hops > 0 ? hops : false);
}
