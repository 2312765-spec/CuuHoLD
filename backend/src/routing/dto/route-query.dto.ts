import { Type } from 'class-transformer';
import { IsNumber, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RouteQueryDto {
  @ApiProperty({
    example: 11.9465,
    description: 'Vĩ độ điểm xuất phát (rescuer)',
  })
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  fromLat: number;

  @ApiProperty({
    example: 108.4419,
    description: 'Kinh độ điểm xuất phát (rescuer)',
  })
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  fromLng: number;

  @ApiProperty({ example: 11.94, description: 'Vĩ độ điểm đến (nạn nhân)' })
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  toLat: number;

  @ApiProperty({ example: 108.44, description: 'Kinh độ điểm đến (nạn nhân)' })
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  toLng: number;
}
