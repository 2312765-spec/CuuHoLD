import {
  IsNumber,
  IsEnum,
  IsString,
  IsOptional,
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
}
