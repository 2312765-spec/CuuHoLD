import { Module } from '@nestjs/common';
import { PushController } from './push.controller';
import { PushService } from './push.service';

// F-PWA-05. ConfigModule là global (app.module.ts) nên không cần import ở đây.
@Module({
  controllers: [PushController],
  providers: [PushService],
  exports: [PushService],
})
export class PushModule {}
