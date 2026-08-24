import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SosController } from './sos.controller';
import { SosService } from './sos.service';
import { SosGateway } from './sos.gateway';
import { SosRequest } from './sos.entity';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([SosRequest]),
    AuthModule,
    NotificationsModule,
  ],
  controllers: [SosController],
  providers: [SosService, SosGateway],
})
export class SosModule {}
