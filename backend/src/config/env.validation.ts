import * as Joi from 'joi';

// Validate lúc ConfigModule.forRoot() boot (main.ts chưa kịp gọi app.listen()),
// KHÔNG đợi tới lúc có request đầu tiên mới getOrThrow() nổ lỗi (JWT_SECRET thiếu
// trước đây chỉ lộ ra khi user đầu tiên login/gọi SOS).
export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().default(3000),
  FRONTEND_URL: Joi.string().uri().default('http://localhost:5173'),

  DATABASE_URL: Joi.string()
    .uri({ scheme: ['postgres', 'postgresql'] })
    .required(),

  JWT_SECRET: Joi.string().min(16).required(),
  JWT_EXPIRES_IN: Joi.string().default('24h'),
  JWT_REFRESH_SECRET: Joi.string().min(16).required(),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d'),

  // eSMS: không bắt buộc — NotificationsService tự nuốt lỗi khi thiếu, SMS chỉ là
  // kênh dự phòng, không được chặn boot của cả server vì thiếu cấu hình SMS.
  ESMS_API_KEY: Joi.string().allow('').optional(),
  ESMS_SECRET_KEY: Joi.string().allow('').optional(),
  ESMS_SMS_TYPE: Joi.string().allow('').optional(),
  ESMS_BRANDNAME: Joi.string().allow('').optional(),
  RESCUE_CENTER_PHONE: Joi.string().allow('').optional(),
  // Chạy thử: 'true' thì KHÔNG gửi SMS thật (NotificationsService chỉ ghi log). Chỉ nhận đúng
  // 'true'/'false'/rỗng — gõ nhầm 'yes'/'1' sẽ crash lúc boot thay vì âm thầm vẫn gửi SMS thật.
  SMS_DRY_RUN: Joi.string().valid('true', 'false', '').optional(),

  // OpenRouteService (CLAUDE.md Mục 15.13) — không bắt buộc, giống eSMS: RoutingService tự
  // trả 503 khi thiếu, không được chặn boot của cả server vì Quang có thể chưa đăng ký key.
  ORS_API_KEY: Joi.string().allow('').optional(),

  // Web Push (F-PWA-05) — không bắt buộc, giống ESMS: thiếu thì PushService tắt thông báo đẩy,
  // server vẫn khởi động. Tạo cặp khoá: npx web-push generate-vapid-keys
  VAPID_PUBLIC_KEY: Joi.string().allow('').optional(),
  VAPID_PRIVATE_KEY: Joi.string().allow('').optional(),
  // Bắt buộc dạng mailto: hoặc https: theo chuẩn VAPID (dịch vụ push dùng để liên hệ khi lạm dụng).
  VAPID_SUBJECT: Joi.string()
    .pattern(/^(mailto:|https:\/\/)/)
    .allow('')
    .optional(),
});
