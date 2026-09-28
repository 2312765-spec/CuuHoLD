import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SosController } from './sos.controller';
import { SosService } from './sos.service';
import { SosImagesService } from './sos-images.service';
import { SosGateway } from './sos.gateway';
import { SosRequest } from './sos.entity';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { RescueTeamsModule } from '../rescue-teams/rescue-teams.module';
import { GisModule } from '../gis/gis.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([SosRequest]),
    AuthModule,
    NotificationsModule,
    forwardRef(() => RescueTeamsModule),
    GisModule,
  ],
  controllers: [SosController],
  providers: [SosService, SosImagesService, SosGateway],
  exports: [SosGateway],
})
export class SosModule {}
