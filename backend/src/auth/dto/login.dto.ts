import { IsString, Matches, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: '0901234567' })
  @Matches(/^0\d{9,10}$/)
  phone: string;

  @ApiProperty({ example: 'matkhau123' })
  @IsString()
  @MinLength(8)
  password: string;
}