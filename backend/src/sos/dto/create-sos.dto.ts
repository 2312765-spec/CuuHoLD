import {
  IsNumber,
  IsEnum,
  IsString,
  IsOptional,
  IsBoolean,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { SOS_TYPES } from '../sos.entity';
import type { SosType } from '../sos.entity';

export class CreateSosDto {
  @ApiProperty({ example: 11.9465 })
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat: number;

  @ApiProperty({ example: 108.4419 })
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng: number;

  @ApiProperty({ enum: SOS_TYPES })
  @IsEnum(SOS_TYPES)
  type: SosType;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  imageUrl?: string;

  // Client tự khai báo toạ độ có phải từ GPS thật hay chỉ là ước tính (VD: quyền định vị
  // bị từ chối, GPS timeout) — mặc định false (coi là chính xác) nếu không gửi, để không
  // phá các client cũ/Postman test không biết field này. Frontend PHẢI gửi true khi rơi
  // vào nhánh fallback (xem MapView.vue layViTriHienTai()) — không được âm thầm gửi toạ độ
  // giả mà không báo, đây chính là fix P0 an toàn ở CLAUDE.md Mục 15.
  @ApiProperty({
    required: false,
    default: false,
    description:
      'true nếu toạ độ chỉ là ước tính (không lấy được GPS thật) — hiện cảnh báo cho rescuer/commander',
  })
  @IsBoolean()
  @IsOptional()
  locationEstimated?: boolean;
}
