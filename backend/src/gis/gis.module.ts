import { Module } from '@nestjs/common';
import { GisService } from './gis.service';
import { GisController } from './gis.controller';

@Module({
  providers: [GisService],
  controllers: [GisController],
  // Export để SosModule tự động phân công đội gần nhất lúc tạo SOS (xem sos.service.ts).
  exports: [GisService],
})
export class GisModule {}
