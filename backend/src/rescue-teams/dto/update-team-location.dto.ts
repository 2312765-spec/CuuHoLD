import { IsNumber, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateTeamLocationDto {
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
}
