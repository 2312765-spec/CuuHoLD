import { Module, forwardRef } from '@nestjs/common';
import { HazardsController } from './hazards.controller';
import { HazardsService } from './hazards.service';
import { SosModule } from '../sos/sos.module';

// forwardRef: xem chú thích ở RoutingModule (vòng Sos → Routing → Hazards → Sos).
@Module({
  imports: [forwardRef(() => SosModule)],
  controllers: [HazardsController],
  providers: [HazardsService],
  exports: [HazardsService],
})
export class HazardsModule {}
