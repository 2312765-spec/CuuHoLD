import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

// F-UI-01 — người dùng tự sửa hồ sơ. CHỈ có `name`: số điện thoại là tên đăng nhập (nhận SMS),
// xã/phường quyết định rescuer xem được SOS xã nào — cho tự đổi là tự mở quyền xem SOS xã khác.
// Gửi kèm field khác → ValidationPipe (forbidNonWhitelisted, main.ts) trả 400.
export class UpdateMeDto {
  @ApiProperty({ example: 'Nguyễn Văn A' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;
}

export class ChangePasswordDto {
  @ApiProperty({ example: 'matkhau123' })
  @IsString()
  @IsNotEmpty()
  currentPassword: string;

  // Tối thiểu 8 như RegisterDto. Tối đa 72: bcrypt chỉ dùng 72 byte đầu, phần thừa bị bỏ qua
  // im lặng — người dùng tưởng mật khẩu dài mạnh hơn thực tế.
  @ApiProperty({ example: 'matkhaumoi456' })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  newPassword: string;
}
