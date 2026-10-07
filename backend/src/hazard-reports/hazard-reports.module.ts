import { Module } from '@nestjs/common';
import { HazardReportsController } from './hazard-reports.controller';
import { HazardReportsService } from './hazard-reports.service';
import { GisModule } from '../gis/gis.module';
import { HazardsModule } from '../hazards/hazards.module';
import { SosModule } from '../sos/sos.module';

@Module({
  imports: [GisModule, HazardsModule, SosModule],
  controllers: [HazardReportsController],
  providers: [HazardReportsService],
})
export class HazardReportsModule {}
