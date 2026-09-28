import {
  IsNumber,
  IsEnum,
  IsString,
  IsOptional,
  IsBoolean,
  IsUrl,
  MaxLength,
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

  // SRS Chương 5: image_url VARCHAR(500); api-contract: đường dẫn https. Ảnh chụp từ app
  // KHÔNG đi qua field này nữa — gửi riêng bằng POST /api/sos/:id/image sau khi tạo SOS
  // (CLAUDE.md Mục 15.14). Siết @IsUrl chặn luôn data-URI/base64 (từng làm POST /api/sos
  // vượt giới hạn body → mất tín hiệu SOS) và chuỗi 'javascript:...' (15.6 P2).
  @ApiProperty({ required: false, example: 'https://example.com/anh.jpg' })
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @MaxLength(500)
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
