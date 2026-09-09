import {
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

// KHÔNG có field `role` ở đây — cố ý. Đăng ký công khai (không cần đăng nhập) CHỈ được
// tạo tài khoản `victim`; để client tự chọn role từng là lỗ hổng leo thang đặc quyền thật
// (ai gọi thẳng API cũng tự phong mình làm `commander` được, xem toàn bộ PII nạn nhân +
// tự phân công đội cho SOS thật — xem CLAUDE.md Mục 15, audit 2026-09-06). Nhờ
// `forbidNonWhitelisted: true` ở main.ts, gửi kèm `role` trong body giờ bị từ chối thẳng
// với 400 thay vì âm thầm bỏ qua. Tài khoản rescuer/commander tạo qua gis/06-seed-demo-users.sql
// (demo) hoặc thao tác trực tiếp trên DB — không có đường API công khai nào tạo được.
export class RegisterDto {
  @ApiProperty({ example: '0901234567' })
  @Matches(/^0\d{9,10}$/)
  phone: string;

  @ApiProperty({ example: 'Nguyễn Văn A' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @ApiProperty({ example: 'matkhau123' })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({
    example: '24823',
    description: 'Mã xã/phường (ma_xa)',
    required: false,
  })
  @IsString()
  @IsOptional()
  wardCode?: string;
}
