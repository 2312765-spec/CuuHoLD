import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateMeDto, ChangePasswordDto } from './profile.dto';

// F-UI-01. Thuộc tính lạ (phone, wardCode, role...) bị ValidationPipe (forbidNonWhitelisted)
// từ chối ở tầng HTTP — xem test/profile.e2e-spec.ts; ở đây chỉ kiểm luật từng field.
async function loi<T extends object>(
  cls: new () => T,
  body: Record<string, unknown>,
): Promise<string[]> {
  const errors = await validate(plainToInstance(cls, body));
  return errors.map((e) => e.property);
}

describe('UpdateMeDto', () => {
  it('nhận tên 2–100 ký tự', async () => {
    expect(await loi(UpdateMeDto, { name: 'An' })).toEqual([]);
    expect(await loi(UpdateMeDto, { name: 'a'.repeat(100) })).toEqual([]);
  });

  it('chặn tên thiếu, quá ngắn, chỉ có khoảng trắng, quá dài hoặc không phải chuỗi', async () => {
    expect(await loi(UpdateMeDto, {})).toEqual(['name']);
    expect(await loi(UpdateMeDto, { name: 'A' })).toEqual(['name']);
    expect(await loi(UpdateMeDto, { name: '     ' })).toEqual(['name']);
    expect(await loi(UpdateMeDto, { name: 'a'.repeat(101) })).toEqual(['name']);
    expect(await loi(UpdateMeDto, { name: 123 })).toEqual(['name']);
  });
});

describe('ChangePasswordDto', () => {
  it('nhận mật khẩu hiện tại bất kỳ (không rỗng) + mật khẩu mới ≥ 8 ký tự', async () => {
    expect(
      await loi(ChangePasswordDto, {
        currentPassword: 'x',
        newPassword: 'matkhau123',
      }),
    ).toEqual([]);
  });

  it('chặn thiếu mật khẩu hiện tại, mật khẩu mới < 8 hoặc > 72 ký tự (bcrypt bỏ qua phần thừa)', async () => {
    expect(
      await loi(ChangePasswordDto, {
        currentPassword: '',
        newPassword: 'matkhau123',
      }),
    ).toEqual(['currentPassword']);
    expect(
      await loi(ChangePasswordDto, {
        currentPassword: 'x',
        newPassword: 'ngan',
      }),
    ).toEqual(['newPassword']);
    expect(
      await loi(ChangePasswordDto, {
        currentPassword: 'x',
        newPassword: 'a'.repeat(73),
      }),
    ).toEqual(['newPassword']);
  });
});
