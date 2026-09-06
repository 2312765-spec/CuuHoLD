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
});
