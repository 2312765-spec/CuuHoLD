import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RefreshDto {
  @ApiProperty({
    description: 'refreshToken nhận được từ /auth/login hoặc /auth/register',
  })
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}
