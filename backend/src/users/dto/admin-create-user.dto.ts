import {
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { UserRole } from '../user.entity';

// Khác RegisterDto (auth/dto/register.dto.ts) ở đúng 1 điểm: CÓ field `role`. An toàn vì
// endpoint dùng DTO này (POST /api/users) đã bị khoá role='commander' qua RolesGuard —
// không phải endpoint công khai như /api/auth/register (nơi cấm hẳn field role vì đó chính
// là lỗ hổng leo thang đặc quyền cũ, xem CLAUDE.md Mục 15.6 P0).
export class AdminCreateUserDto {
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

  @ApiProperty({ example: 'rescuer', enum: ['victim', 'rescuer', 'commander'] })
  @IsIn(['victim', 'rescuer', 'commander'])
  role: UserRole;

  @ApiPropertyOptional({
    example: '24823',
    description: 'Mã xã/phường (ma_xa)',
  })
  @IsString()
  @IsOptional()
  wardCode?: string;
}
