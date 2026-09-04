import { Module, forwardRef } from '@nestjs/common';
import { RescueTeamsController } from './rescue-teams.controller';
import { RescueTeamsService } from './rescue-teams.service';
import { SosModule } from '../sos/sos.module';

@Module({
  imports: [forwardRef(() => SosModule)],
  controllers: [RescueTeamsController],
  providers: [RescueTeamsService],
  exports: [RescueTeamsService],
})
export class RescueTeamsModule {}
