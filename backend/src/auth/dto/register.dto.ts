import {
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import type { UserRole } from '../../users/user.entity';

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

  @ApiProperty({ enum: ['victim', 'rescuer', 'commander'], default: 'victim' })
  @IsIn(['victim', 'rescuer', 'commander'])
  @IsOptional()
  role?: UserRole;

  @ApiProperty({ example: '672' })
  @IsString()
  districtCode: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  wardCode?: string;
}