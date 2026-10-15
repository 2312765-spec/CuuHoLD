import { Type } from 'class-transformer';
import {
  IsDefined,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

// F-PWA-05 — body là nguyên PushSubscription.toJSON() của trình duyệt (frontend pushService.ts).

export class PushKeysDto {
  @ApiProperty()
  @IsString()
  @MaxLength(200)
  p256dh: string;

  @ApiProperty()
  @IsString()
  @MaxLength(100)
  auth: string;
}

export class PushSubscriptionDto {
  // Endpoint do dịch vụ push của trình duyệt cấp (FCM, Mozilla, Apple...) — luôn https.
  // Chặn http/javascript:/chuỗi rác để backend không bị dùng làm công cụ gọi URL tuỳ ý.
  @ApiProperty({ example: 'https://fcm.googleapis.com/fcm/send/...' })
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @MaxLength(1000)
  endpoint: string;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsNumber()
  expirationTime?: number | null;

  @ApiProperty({ type: PushKeysDto })
  @IsDefined()
  @ValidateNested()
  @Type(() => PushKeysDto)
  keys: PushKeysDto;
}

export class UnsubscribePushDto {
  @ApiProperty({ example: 'https://fcm.googleapis.com/fcm/send/...' })
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @MaxLength(1000)
  endpoint: string;
}
