import { Module, forwardRef } from '@nestjs/common';
import { RoutingService } from './routing.service';
import { RoutingController } from './routing.controller';
import { GisModule } from '../gis/gis.module';
import { HazardsModule } from '../hazards/hazards.module';

// forwardRef: SosModule cần RoutingService (chọn đội theo đường bộ thật khi tự động phân công),
// còn HazardsModule cần SosGateway của SosModule — tạo vòng Sos → Routing → Hazards → Sos.
@Module({
  imports: [GisModule, forwardRef(() => HazardsModule)],
  providers: [RoutingService],
  controllers: [RoutingController],
  exports: [RoutingService],
})
export class RoutingModule {}
