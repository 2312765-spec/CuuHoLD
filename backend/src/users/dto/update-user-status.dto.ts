import { IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateUserStatusDto {
  @ApiProperty({
    example: false,
    description: 'false = khoá tài khoản, true = mở lại',
  })
  @IsBoolean()
  isActive: boolean;
}
