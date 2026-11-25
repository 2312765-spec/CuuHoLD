import { envValidationSchema } from './env.validation';

// Chỉ kiểm phần SMS_DRY_RUN. Biến bắt buộc (DATABASE_URL, JWT_*) điền giá trị hợp lệ tối thiểu.
const CO_BAN = {
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
  JWT_SECRET: 'a'.repeat(32),
  JWT_REFRESH_SECRET: 'b'.repeat(32),
};

describe('envValidationSchema — SMS_DRY_RUN', () => {
  it.each(['true', 'false', ''])('chấp nhận SMS_DRY_RUN=%p', (v) => {
    const { error } = envValidationSchema.validate({
      ...CO_BAN,
      SMS_DRY_RUN: v,
    });
    expect(error).toBeUndefined();
  });

  it('không đặt SMS_DRY_RUN vẫn hợp lệ (mặc định gửi thật)', () => {
    const { error } = envValidationSchema.validate(CO_BAN);
    expect(error).toBeUndefined();
  });

  it.each(['yes', '1', 'on'])(
    'từ chối SMS_DRY_RUN=%p ngay lúc khởi động (gõ nhầm tưởng đã tắt SMS)',
    (v) => {
      const { error } = envValidationSchema.validate({
        ...CO_BAN,
        SMS_DRY_RUN: v,
      });
      expect(error?.message).toContain('SMS_DRY_RUN');
    },
  );
});

describe('envValidationSchema — TRUST_PROXY_HOPS', () => {
  it('không đặt → mặc định 0 (máy dev, không có proxy)', () => {
    const kq = envValidationSchema.validate(CO_BAN);
    expect(kq.error).toBeUndefined();
    expect((kq.value as { TRUST_PROXY_HOPS: number }).TRUST_PROXY_HOPS).toBe(0);
  });

  it('nhận "1" (Render) và đổi thành số', () => {
    const kq = envValidationSchema.validate({
      ...CO_BAN,
      TRUST_PROXY_HOPS: '1',
    });
    expect(kq.error).toBeUndefined();
    expect((kq.value as { TRUST_PROXY_HOPS: number }).TRUST_PROXY_HOPS).toBe(1);
  });

  it.each(['true', '-1', '1.5', '99'])(
    'từ chối TRUST_PROXY_HOPS=%p lúc khởi động',
    (v) => {
      const { error } = envValidationSchema.validate({
        ...CO_BAN,
        TRUST_PROXY_HOPS: v,
      });
      expect(error).toBeDefined();
    },
  );
});
