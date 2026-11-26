import { Type } from 'class-transformer';
import { IsNumber, Max, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ReverseQueryDto {
  @ApiProperty({ example: 11.9404, description: 'Vĩ độ' })
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat: number;

  @ApiProperty({ example: 108.4383, description: 'Kinh độ' })
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng: number;
}
